from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, models, auth_utils
from ..database import get_db

router = APIRouter()

def get_project_if_owner(project_id: str, db: Session, current_user: models.User):
    project = db.query(models.Project).filter(
        models.Project.id == str(project_id),
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

def get_queue_if_owner(queue_id: str, db: Session, current_user: models.User):
    queue = db.query(models.Queue).join(models.Project).filter(
        models.Queue.id == str(queue_id),
        models.Project.user_id == current_user.id
    ).first()
    if not queue:
        raise HTTPException(status_code=404, detail="Queue not found")
    return queue

@router.post("/{project_id}", response_model=schemas.QueueResponse)
def create_queue(project_id: str, queue: schemas.QueueCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    get_project_if_owner(project_id, db, current_user)
    new_queue = models.Queue(
        project_id=str(project_id),
        name=queue.name,
        concurrency_limit=getattr(queue, 'concurrency_limit', None) or getattr(queue, 'max_workers', 1)
    )
    db.add(new_queue)
    db.commit()
    db.refresh(new_queue)
    return new_queue

@router.get("/{project_id}", response_model=List[schemas.QueueResponse])
def list_queues(project_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    get_project_if_owner(project_id, db, current_user)
    return db.query(models.Queue).filter(models.Queue.project_id == str(project_id)).all()

@router.patch("/{queue_id}", response_model=schemas.QueueResponse)
def update_queue(queue_id: str, queue_update: schemas.QueueUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = get_queue_if_owner(queue_id, db, current_user)
    if queue_update.concurrency_limit is not None:
        queue.concurrency_limit = queue_update.concurrency_limit
    if queue_update.is_paused is not None:
        queue.is_paused = queue_update.is_paused
    db.commit()
    db.refresh(queue)
    return queue

@router.post("/{queue_id}/pause", response_model=schemas.QueueResponse)
def pause_queue(queue_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = get_queue_if_owner(queue_id, db, current_user)
    queue.is_paused = True
    db.commit()
    db.refresh(queue)
    return queue

@router.post("/{queue_id}/resume", response_model=schemas.QueueResponse)
def resume_queue(queue_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = get_queue_if_owner(queue_id, db, current_user)
    queue.is_paused = False
    db.commit()
    db.refresh(queue)
    return queue

@router.delete("/{queue_id}")
def delete_queue(queue_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    queue = get_queue_if_owner(queue_id, db, current_user)
    db.delete(queue)
    db.commit()
    return {"message": "Queue deleted successfully"}
