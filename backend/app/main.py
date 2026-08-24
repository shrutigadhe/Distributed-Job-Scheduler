from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, projects, queues, jobs, dashboard
from .database import engine
from .models import Base

Base.metadata.create_all(bind=engine)

# Runtime migration: add columns that may be missing from old DB
from sqlalchemy import text
# Run each in a separate transaction block so one failure doesn't abort the others
try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE jf_projects ADD COLUMN description VARCHAR(512)"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE jf_jobs ADD COLUMN batch_id VARCHAR(36)"))
except Exception:
    pass

try:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE jf_workers ADD COLUMN project_id VARCHAR(36)"))
except Exception:
    pass


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

import traceback
from fastapi.responses import JSONResponse
from fastapi import Request

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc),
            "traceback": traceback.format_exception(type(exc), exc, exc.__traceback__)
        }
    )

@app.get("/")
def root():
    return {"message": "Welcome to Distributed Job Scheduler API"}
