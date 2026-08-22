from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import schemas, models, auth_utils
from ..database import get_db

router = APIRouter()

@router.post("/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    new_project = models.Project(
        name=project.name,
        description=project.description,
        user_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@router.get("/", response_model=List[schemas.ProjectResponse])
def list_projects(db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    return db.query(models.Project).filter(models.Project.user_id == current_user.id).all()

@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(auth_utils.get_current_user)):
    project = db.query(models.Project).filter(
        models.Project.id == str(project_id),
        models.Project.user_id == current_user.id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}
