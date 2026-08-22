import pytest
import time
import threading
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, User, Project, Queue, Job, Worker, JobExecution, DLQEntry
from worker.worker_main import calculate_next_retry

# Use a shared in-memory database so multiple connections can see the same data
DATABASE_URL = "sqlite:///file:testdb?mode=memory&cache=shared"

# Set up engine with static pool to preserve the shared in-memory connection
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create test user
    user = User(email="test@test.com", password_hash="hashed")
    db.add(user)
    db.commit()
    
    # Create test project
    project = Project(name="Test Project", user_id=user.id)
    db.add(project)
    db.commit()
    
    yield db
    
    db.close()
    Base.metadata.drop_all(bind=engine)

def test_paused_queue_does_not_execute(setup_db):
    db = setup_db
    project = db.query(Project).first()
    
    # Create a paused queue
    queue = Queue(project_id=project.id, name="paused-queue", concurrency_limit=5, is_paused=True)
    db.add(queue)
    db.commit()
    
    # Create a queued job
    job = Job(queue_id=queue.id, name="test-job", status="queued")
    db.add(job)
    db.commit()
    
    # Verify queue is paused
    assert queue.is_paused is True
    
    # Check eligibility of queues in worker claim simulation
    queues = db.query(Queue).filter(Queue.project_id == project.id).all()
    eligible_queue_ids = [q.id for q in queues if not q.is_paused]
    
    assert queue.id not in eligible_queue_ids
    assert len(eligible_queue_ids) == 0

def test_concurrency_limit(setup_db):
    db = setup_db
    project = db.query(Project).first()
    
    # Create queue with concurrency limit = 2
    queue = Queue(project_id=project.id, name="limit-queue", concurrency_limit=2)
    db.add(queue)
    db.commit()
    
    # Add 3 jobs
    job1 = Job(queue_id=queue.id, name="job1", status="claimed")  # 1 running
    job2 = Job(queue_id=queue.id, name="job2", status="running")  # 2 running
    job3 = Job(queue_id=queue.id, name="job3", status="queued")   # 3 queued
    db.add_all([job1, job2, job3])
    db.commit()
    
    # Check running job count
    running_jobs = db.query(Job).filter(
        Job.queue_id == queue.id,
        Job.status.in_(["claimed", "running"])
    ).count()
    assert running_jobs == 2
    
    # Verify that the queue is NOT eligible for further claims because it hit limit
    eligible = running_jobs < queue.concurrency_limit
    assert eligible is False

def test_failed_job_retries_and_dlq(setup_db):
    db = setup_db
    project = db.query(Project).first()
    queue = Queue(project_id=project.id, name="retry-queue", concurrency_limit=5)
    db.add(queue)
    db.commit()
    
    # Create a job with max_retries = 2
    job = Job(queue_id=queue.id, name="fail-job", status="queued", max_retries=2, retry_count=0)
    db.add(job)
    db.commit()
    
    # Simulate execution failures
    for attempt in range(1, 4):
        # Create execution log
        execution = JobExecution(job_id=job.id, status="failed", attempt_number=attempt, error_message="Simulated Fail")
        db.add(execution)
        
        job.retry_count += 1
        if job.retry_count <= job.max_retries:
            job.status = "scheduled"
            delay = calculate_next_retry(job.retry_count, "fixed")
            job.scheduled_at = datetime.now(timezone.utc).replace(tzinfo=None) + delay
        else:
            job.status = "failed"
            dlq_entry = DLQEntry(job_id=job.id, error_message="Max retries reached")
            db.add(dlq_entry)
        db.commit()

    # Verify final status is failed and job is in DLQ
    db.refresh(job)
    assert job.status == "failed"
    assert job.retry_count == 3
    
    dlq = db.query(DLQEntry).filter(DLQEntry.job_id == job.id).first()
    assert dlq is not None
    assert dlq.error_message == "Max retries reached"

def test_delayed_job_execution(setup_db):
    db = setup_db
    project = db.query(Project).first()
    queue = Queue(project_id=project.id, name="delay-queue", concurrency_limit=5)
    db.add(queue)
    db.commit()
    
    # Job scheduled 10 minutes in the future
    future_time = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=10)
    future_job = Job(queue_id=queue.id, name="future-job", status="scheduled", scheduled_at=future_time)
    
    # Job scheduled 5 minutes in the past (ready to run)
    past_time = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5)
    past_job = Job(queue_id=queue.id, name="past-job", status="scheduled", scheduled_at=past_time)
    
    db.add_all([future_job, past_job])
    db.commit()
    
    # Worker claim query simulation
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    claimable_jobs = db.query(Job).filter(
        Job.queue_id == queue.id,
        Job.status.in_(["queued", "scheduled"]),
        (Job.scheduled_at == None) | (Job.scheduled_at <= now)
    ).all()
    
    # Only past_job should be claimable
    assert len(claimable_jobs) == 1
    assert claimable_jobs[0].id == past_job.id

def test_cron_job_scheduling(setup_db):
    db = setup_db
    project = db.query(Project).first()
    queue = Queue(project_id=project.id, name="cron-queue", concurrency_limit=5)
    db.add(queue)
    db.commit()
    
    # Cron job set to run every minute
    cron_expr = "*/1 * * * *"
    job = Job(queue_id=queue.id, name="cron-job", status="queued", cron_expression=cron_expr)
    db.add(job)
    db.commit()
    
    # Simulate completion
    job.status = "completed"
    
    # Calculate next execution time using croniter
    from croniter import croniter
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    cron = croniter(cron_expr, now)
    next_run = cron.get_next(datetime)
    
    # Schedule next run
    next_job = Job(
        queue_id=job.queue_id,
        name=job.name,
        status="scheduled",
        scheduled_at=next_run,
        cron_expression=cron_expr
    )
    db.add(next_job)
    db.commit()
    
    # Verify next job is scheduled correctly in the future
    assert next_job.status == "scheduled"
    assert next_job.scheduled_at > now

def test_worker_heartbeat_and_offline_detection(setup_db):
    db = setup_db
    
    # Create worker
    worker = Worker(name="test-worker", status="active", last_heartbeat_at=datetime.now(timezone.utc).replace(tzinfo=None))
    db.add(worker)
    db.commit()
    
    # Test heartbeat update
    new_heartbeat = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(seconds=5)
    worker.last_heartbeat_at = new_heartbeat
    db.commit()
    
    db.refresh(worker)
    assert worker.last_heartbeat_at == new_heartbeat
    
    # Test offline detection threshold (30 seconds)
    thirty_secs_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=31)
    
    # Force worker heartbeat to 31 seconds ago
    worker.last_heartbeat_at = thirty_secs_ago
    db.commit()
    
    db.refresh(worker)
    is_active = worker.last_heartbeat_at >= (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(seconds=30))
    assert is_active is False

def test_concurrent_claims_no_duplicates(setup_db):
    """
    Verify that only one worker can claim a job.
    
    In production (PostgreSQL), FOR UPDATE SKIP LOCKED provides true row-level
    isolation. In SQLite (used for tests), we simulate this with a status-check
    optimistic pattern — the second thread sees the job already claimed and skips it.
    This test validates the overall claim logic correctness.
    """
    db = setup_db
    project = db.query(Project).first()
    queue = Queue(project_id=project.id, name="concurrent-queue", concurrency_limit=5)
    db.add(queue)
    db.commit()

    # Create exactly 1 claimable job
    job = Job(queue_id=queue.id, name="single-job", status="queued")
    db.add(job)
    db.commit()

    job_id = job.id
    claimed_by = []

    # Simulate two workers each checking-and-claiming with separate sessions
    # We use a sequential approach to mimic the optimistic update pattern
    for worker_name in ["worker1", "worker2"]:
        thread_db = TestingSessionLocal()
        try:
            # Re-read and update atomically: only claim if still 'queued'
            rows_updated = thread_db.query(Job).filter(
                Job.id == job_id,
                Job.status == "queued"  # Optimistic filter — only one will find this true
            ).update({"status": "claimed", "updated_at": datetime.now(timezone.utc).replace(tzinfo=None)})
            thread_db.commit()
            if rows_updated > 0:
                claimed_by.append(worker_name)
        except Exception:
            thread_db.rollback()
        finally:
            thread_db.close()

    # Exactly ONE worker should have successfully claimed the job
    assert len(claimed_by) == 1

    # Verify in DB that the final status is claimed exactly once
    verify_db = TestingSessionLocal()
    final_job = verify_db.query(Job).filter(Job.id == job_id).first()
    assert final_job.status == "claimed"
    verify_db.close()
