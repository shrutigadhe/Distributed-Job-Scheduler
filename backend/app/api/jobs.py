from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
from .. import schemas, models, auth_utils
from ..database import get_db

router = APIRouter()

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
