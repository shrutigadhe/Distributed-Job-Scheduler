import os
import sys
import time
import uuid
import logging
import argparse
import signal
from datetime import datetime, timezone, timedelta

# Add backend directory to path so we can import app.models locally
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import create_engine, select, update, text
from sqlalchemy.orm import sessionmaker
from croniter import croniter

from app.models import Worker, Job, JobExecution, DLQEntry, Queue, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

# Parse command line arguments
parser = argparse.ArgumentParser(description="JobFlow background worker process.")
parser.add_argument("--project-id", type=str, help="Only process jobs from this project.")
args, unknown = parser.parse_known_args()

PROJECT_ID = args.project_id or os.getenv("PROJECT_ID")

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./job_scheduler.db")
WORKER_NAME = os.getenv("WORKER_NAME", f"worker-{uuid.uuid4().hex[:8]}")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_utc_now():
    return datetime.now(timezone.utc)

def calculate_next_retry(attempt_number, strategy):
    if strategy == "linear":
        return timedelta(seconds=10 * attempt_number)
    elif strategy == "exponential":
        return timedelta(seconds=2 ** attempt_number)
    else: # fixed
        return timedelta(seconds=10)

# Graceful Shutdown Flag
shutdown_requested = False

def handle_shutdown(signum, frame):
    global shutdown_requested
    logger.info("Shutdown signal received. Will exit gracefully after current job finishes...")
    shutdown_requested = True

signal.signal(signal.SIGINT, handle_shutdown)
signal.signal(signal.SIGTERM, handle_shutdown)

def worker_loop():
    logger.info(f"Starting worker {WORKER_NAME} (Assigned Project ID: {PROJECT_ID})")
    
    # Register worker
    db = SessionLocal()
    worker = Worker(name=WORKER_NAME, project_id=PROJECT_ID, status="active")
    try:
        db.add(worker)
        db.commit()
        db.refresh(worker)
    except Exception as e:
        db.rollback()
        worker = db.query(Worker).filter(Worker.name == WORKER_NAME).first()
        worker.last_heartbeat_at = get_utc_now()
        worker.status = "active"
        worker.project_id = PROJECT_ID
        db.commit()
    
    worker_id = worker.id
    db.close()

    while not shutdown_requested:
        db = SessionLocal()
        try:
            # Send Heartbeat
            db.execute(update(Worker).where(Worker.id == worker_id).values(
                last_heartbeat_at=get_utc_now(),
                status="active"
            ))
            db.commit()

            # 1. Fetch eligible queues (respecting project_id and concurrency limits)
            queues_query = db.query(Queue)
            if PROJECT_ID:
                queues_query = queues_query.filter(Queue.project_id == PROJECT_ID)
            
            queues = queues_query.all()
            eligible_queue_ids = []
            
            for q in queues:
                if q.is_paused:
                    continue
                # Count currently claimed/running jobs in this queue
                running_jobs = db.query(Job).filter(
                    Job.queue_id == q.id,
                    Job.status.in_(['claimed', 'running'])
                ).count()
                
                if running_jobs < q.concurrency_limit:
                    eligible_queue_ids.append(q.id)

            if not eligible_queue_ids:
                # No work to do or concurrency limit reached for all queues
                db.close()
                for _ in range(20):
                    if shutdown_requested:
                        break
                    time.sleep(0.1)
                continue

            # 2. Claim Job - Atomic pick with FOR UPDATE SKIP LOCKED
            job_query = db.query(Job).filter(
                Job.queue_id.in_(eligible_queue_ids),
                Job.status.in_(['queued', 'scheduled']),
                (Job.scheduled_at == None) | (Job.scheduled_at <= get_utc_now())
            ).order_by(Job.priority.desc(), Job.created_at.asc())

            if "sqlite" not in DATABASE_URL:
                # PostgreSQL support for atomic claims
                job_query = job_query.with_for_update(skip_locked=True)

            job = job_query.first()
            
            if not job:
                db.close()
                for _ in range(20):
                    if shutdown_requested:
                        break
                    time.sleep(0.1)
                continue
            
            # Atomic update of status to claimed
            job.status = 'claimed'
            job.updated_at = get_utc_now()
            db.commit()
            
            logger.info(f"Claimed job {job.id} ({job.name}) on queue {job.queue_id}")

            # 3. Create Execution Record
            execution = JobExecution(
                job_id=job.id,
                worker_id=worker_id,
                status="running",
                attempt_number=job.retry_count + 1
            )
            db.add(execution)
            db.commit()

            # 4. Execute Job
            try:
                # Mock work
                time.sleep(2)
                
                # Check for forced failure based on payload for demo purposes
                if job.payload and job.payload.get("force_fail"):
                    raise Exception(f"Forced failure: {job.payload.get('force_fail')}")
                    
                execution.status = "completed"
                execution.completed_at = get_utc_now()
                execution.log_output = "Job executed successfully"
                
                job.status = "completed"
                
                # Handle cron jobs
                if job.cron_expression:
                    cron = croniter(job.cron_expression, get_utc_now())
                    next_run = cron.get_next(datetime)
                    
                    # Create next job iteration
                    next_job = Job(
                        queue_id=job.queue_id,
                        name=job.name,
                        payload=job.payload,
                        status="scheduled",
                        scheduled_at=next_run,
                        priority=job.priority,
                        max_retries=job.max_retries,
                        retry_strategy=job.retry_strategy,
                        cron_expression=job.cron_expression
                    )
                    db.add(next_job)
                    
            except Exception as e:
                logger.error(f"Job {job.id} failed: {e}")
                execution.status = "failed"
                execution.completed_at = get_utc_now()
                execution.error_message = str(e)
                
                job.retry_count += 1
                if job.retry_count <= job.max_retries:
                    job.status = "scheduled"
                    delay = calculate_next_retry(job.retry_count, job.retry_strategy)
                    job.scheduled_at = get_utc_now() + delay
                else:
                    job.status = "failed"
                    dlq_entry = DLQEntry(job_id=job.id, error_message=str(e))
                    db.add(dlq_entry)
            
            db.commit()
            
        except Exception as e:
            logger.error(f"Worker error: {e}")
            db.rollback()
            for _ in range(20):
                if shutdown_requested:
                    break
                time.sleep(0.1)
        finally:
            db.close()

    # Graceful exit - Mark worker offline
    logger.info("Graceful shutdown active. Marking worker offline in database...")
    db = SessionLocal()
    try:
        db.execute(update(Worker).where(Worker.id == worker_id).values(
            status="offline",
            last_heartbeat_at=get_utc_now()
        ))
        db.commit()
        logger.info("Worker status set to offline. Goodbye!")
    except Exception as e:
        logger.error(f"Error marking worker offline: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    # Wait for database if running on docker start
    time.sleep(2)
    worker_loop()
