from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, projects, queues, jobs, dashboard
from .database import engine
from .models import Base

Base.metadata.create_all(bind=engine)

# Runtime migration: add columns that may be missing from old DB
from sqlalchemy import text
with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE projects ADD COLUMN description VARCHAR(512)"))
        conn.commit()
    except Exception:
        pass  # column already exists


app = FastAPI(title="Distributed Job Scheduler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(queues.router, prefix="/api/queues", tags=["queues"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])

@app.get("/")
def root():
    return {"message": "Welcome to Distributed Job Scheduler API"}
