from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from .. import schemas, models, auth_utils
from ..database import get_db

router = APIRouter()

@router.get("/metrics")
def get_dashboard_metrics(db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    # Total projects and queues for user
    total_projects = db.query(models.Project).filter(models.Project.user_id == current_user.id).count()
    total_queues = db.query(models.Queue).join(models.Project).filter(
        models.Project.user_id == current_user.id
    ).count()

    # Active workers — heartbeat within last 30 seconds.
    # Use naive UTC to match how worker stores last_heartbeat_at (datetime.utcnow())
    thirty_secs_ago = datetime.utcnow() - timedelta(seconds=30)
    all_workers = db.query(models.Worker).all()
    active_workers_list = [
        w for w in all_workers
        if w.last_heartbeat_at and w.last_heartbeat_at >= thirty_secs_ago and w.status == "active"
    ]
    active_workers = len(active_workers_list)

    # Job stats for user's queues
    queue_ids = [
        q.id for q in db.query(models.Queue).join(models.Project).filter(
            models.Project.user_id == current_user.id
        ).all()
    ]

    jobs_queued    = db.query(models.Job).filter(models.Job.queue_id.in_(queue_ids), models.Job.status == "queued").count()
    jobs_running   = db.query(models.Job).filter(models.Job.queue_id.in_(queue_ids), models.Job.status.in_(["claimed", "running"])).count()
    jobs_completed = db.query(models.Job).filter(models.Job.queue_id.in_(queue_ids), models.Job.status == "completed").count()
    jobs_failed    = db.query(models.Job).filter(models.Job.queue_id.in_(queue_ids), models.Job.status == "failed").count()

    # Build workers list for UI
    workers_data = []
    for w in all_workers:
        is_active = w.last_heartbeat_at and w.last_heartbeat_at >= thirty_secs_ago and w.status == "active"
        jobs_processed = db.query(models.JobExecution).filter(models.JobExecution.worker_id == w.id).count()
        workers_data.append({
            "id": str(w.id),
            "name": w.name,
            "status": "online" if is_active else "offline",
            "last_heartbeat": w.last_heartbeat_at.isoformat() if w.last_heartbeat_at else None,
            "jobs_processed": jobs_processed,
            "project_id": str(w.project_id) if w.project_id else None,
        })

    return {
        "total_projects": total_projects,
        "total_queues": total_queues,
        "active_workers": active_workers,
        "jobs_queued": jobs_queued,
        "jobs_running": jobs_running,
        "jobs_completed": jobs_completed,
        "jobs_failed": jobs_failed,
        "workers": workers_data,
    }
