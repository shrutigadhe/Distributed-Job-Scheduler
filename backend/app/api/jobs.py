from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
import uuid
from .. import schemas, models, auth_utils
from ..database import get_db

router = APIRouter()

@router.get("/", response_model=schemas.JobSearchResponse)
def search_jobs(
    q: Optional[str] = None,
    status: Optional[str] = None,
    queue_id: Optional[str] = None,
    priority: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user)
):
    query = db.query(models.Job).join(models.Queue).join(models.Project).filter(
        models.Project.user_id == current_user.id
    )

    if q:
        query = query.filter((models.Job.name.ilike(f"%{q}%")) | (models.Job.id == q))
    if status:
        query = query.filter(models.Job.status == status)
    if queue_id:
        query = query.filter(models.Job.queue_id == str(queue_id))
    if priority is not None:
        query = query.filter(models.Job.priority == priority)

    total = query.count()
    offset = (page - 1) * limit
    items = query.order_by(models.Job.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": items
    }

@router.post("/batch", response_model=schemas.BatchJobResponse)
def create_batch_jobs(batch: schemas.BatchJobCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = db.query(models.Queue).join(models.Project).filter(
        models.Queue.id == str(batch.queue_id),
        models.Project.user_id == current_user.id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    batch_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    
    new_jobs = []
    for item in batch.jobs:
        name = item.name or item.type or "batch-job"
        new_job = models.Job(
            queue_id=str(batch.queue_id),
            name=name,
            payload=item.payload,
            status="queued",
            scheduled_at=now,
            priority=item.priority or 0,
            max_retries=item.max_retries if item.max_retries is not None else 3,
            retry_strategy=item.retry_strategy or "fixed",
            batch_id=batch_id
        )
        db.add(new_job)
        new_jobs.append(new_job)

    db.commit()
    return {"batch_id": batch_id, "count": len(new_jobs)}

@router.get("/{job_id}/executions", response_model=List[schemas.JobExecutionResponse])
def list_job_executions(job_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    job = db.query(models.Job).join(models.Queue).join(models.Project).filter(
        models.Job.id == str(job_id),
        models.Project.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return db.query(models.JobExecution).filter(models.JobExecution.job_id == str(job_id)).order_by(models.JobExecution.attempt_number.asc()).all()

@router.post("/{queue_id}", response_model=schemas.JobResponse)
def create_job(queue_id: str, job: schemas.JobCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = db.query(models.Queue).join(models.Project).filter(
        models.Queue.id == str(queue_id),
        models.Project.user_id == current_user.id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")

    status = "queued"
    scheduled_at = job.scheduled_at or datetime.now(timezone.utc)
    # strip tz for SQLite
    if hasattr(scheduled_at, 'tzinfo') and scheduled_at.tzinfo:
        scheduled_at = scheduled_at.replace(tzinfo=None)
    if job.scheduled_at and job.scheduled_at > datetime.now(timezone.utc):
        status = "scheduled"

    new_job = models.Job(
        queue_id=str(queue_id),
        name=job.name,
        payload=job.payload,
        status=status,
        scheduled_at=scheduled_at,
        priority=job.priority,
        max_retries=job.max_retries,
        retry_strategy=job.retry_strategy,
        cron_expression=job.cron_expression
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    return new_job

@router.get("/{queue_id}", response_model=List[schemas.JobResponse])
def list_jobs(queue_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = db.query(models.Queue).join(models.Project).filter(
        models.Queue.id == str(queue_id),
        models.Project.user_id == current_user.id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    return db.query(models.Job).filter(models.Job.queue_id == str(queue_id)).order_by(models.Job.created_at.desc()).all()

@router.post("/{job_id}/retry")
def retry_job(job_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    job = db.query(models.Job).join(models.Queue).join(models.Project).filter(
        models.Job.id == str(job_id),
        models.Project.user_id == current_user.id
    ).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status not in ["failed", "cancelled", "dead"]:
        raise HTTPException(status_code=400, detail="Only failed/cancelled/dead jobs can be retried")

    job.status = "queued"
    job.retry_count = 0
    job.scheduled_at = datetime.utcnow()

    dlq_entry = db.query(models.DLQEntry).filter(models.DLQEntry.job_id == str(job.id)).first()
    if dlq_entry:
        db.delete(dlq_entry)

    db.commit()
    return {"message": "Job queued for retry"}
