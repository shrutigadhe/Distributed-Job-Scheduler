import os
import sys
import time
import uuid
import logging
from datetime import datetime, timezone, timedelta

# Add backend directory to path so we can import app.models locally
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

from sqlalchemy import create_engine, select, update, text
from sqlalchemy.orm import sessionmaker
from croniter import croniter

from app.models import Worker, Job, JobExecution, DLQEntry, Base

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker")

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

def worker_loop():
    logger.info(f"Starting worker {WORKER_NAME}")
    
    # Register worker
    db = SessionLocal()
    worker = Worker(name=WORKER_NAME)
    try:
        db.add(worker)
        db.commit()
        db.refresh(worker)
    except Exception as e:
        db.rollback()
        worker = db.query(Worker).filter(Worker.name == WORKER_NAME).first()
        worker.last_heartbeat_at = get_utc_now()
        worker.status = "active"
        db.commit()
    
    worker_id = worker.id
    db.close()

    while True:
        db = SessionLocal()
        try:
            # Heartbeat
            db.execute(update(Worker).where(Worker.id == worker_id).values(last_heartbeat_at=get_utc_now()))
            db.commit()

            # Claim Job - Atomically pick the highest priority job that is ready
            if "sqlite" in DATABASE_URL:
                # SQLite doesn't support SKIP LOCKED, but locks the whole file anyway
                job = db.query(Job).filter(
                    Job.status.in_(['queued', 'scheduled']),
                    (Job.scheduled_at == None) | (Job.scheduled_at <= get_utc_now())
                ).order_by(Job.priority.desc(), Job.created_at.asc()).first()
                
                if job:
                    job.status = 'claimed'
                    job.updated_at = get_utc_now()
                    db.commit()
                    row = [job.id]
                else:
                    row = None
            else:
                claim_sql = text("""
                    UPDATE jf_jobs 
                    SET status = 'claimed', updated_at = NOW() 
                    WHERE id = (
                        SELECT id FROM jf_jobs 
                        WHERE status IN ('queued', 'scheduled') 
                          AND (scheduled_at IS NULL OR scheduled_at <= NOW())
                        ORDER BY priority DESC, created_at ASC 
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    RETURNING id;
                """)
                
                result = db.execute(claim_sql)
                row = result.fetchone()
                db.commit()
            
            if not row:
                time.sleep(2)
                continue
                
            job_id = row[0]
            job = db.query(Job).filter(Job.id == job_id).first()
            
            logger.info(f"Claimed job {job_id} ({job.name})")
            
            # Create Execution record
            execution = JobExecution(
                job_id=job.id,
                worker_id=worker_id,
                status="running",
                attempt_number=job.retry_count + 1
            )
            db.add(execution)
            db.commit()
            
            # Execute logic (mocked)
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
                logger.error(f"Job {job_id} failed: {e}")
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
            time.sleep(2)
        finally:
            db.close()

if __name__ == "__main__":
    time.sleep(10) # Wait for db to be ready
    worker_loop()
