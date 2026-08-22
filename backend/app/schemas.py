from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# User Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: EmailStr
    created_at: datetime
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Project Schemas
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    user_id: str
    created_at: datetime
    class Config:
        from_attributes = True

# Queue Schemas
class QueueCreate(BaseModel):
    name: str
    concurrency_limit: Optional[int] = None
    max_workers: Optional[int] = None  # alias used by frontend

    @property
    def effective_limit(self) -> int:
        return self.concurrency_limit or self.max_workers or 1

class QueueUpdate(BaseModel):
    concurrency_limit: Optional[int] = None
    is_paused: Optional[bool] = None

class QueueResponse(BaseModel):
    id: str
    project_id: str
    name: str
    concurrency_limit: int
    is_paused: bool
    created_at: datetime

    @property
    def max_workers(self):
        return self.concurrency_limit

    class Config:
        from_attributes = True


# Job Schemas
class JobCreate(BaseModel):
    name: str
    payload: Dict[str, Any] = {}
    scheduled_at: Optional[datetime] = None
    priority: Optional[int] = 0
    max_retries: Optional[int] = 3
    retry_strategy: Optional[str] = "fixed"
    cron_expression: Optional[str] = None

class JobResponse(BaseModel):
    id: str
    queue_id: str
    name: str
    payload: Dict[str, Any]
    status: str
    scheduled_at: Optional[datetime] = None
    priority: int
    retry_count: int
    max_retries: int
    retry_strategy: str
    cron_expression: Optional[str]
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

# Worker schema for dashboard
class WorkerResponse(BaseModel):
    id: str
    name: str
    status: Optional[str] = "online"
    last_heartbeat: Optional[datetime] = None
    jobs_processed: Optional[int] = 0
    project_id: Optional[str] = None
    class Config:
        from_attributes = True

# Dashboard Metrics
class DashboardMetrics(BaseModel):
    total_projects: int = 0
    total_queues: int
    active_workers: int
    jobs_queued: int
    jobs_running: int
    jobs_completed: int
    jobs_failed: int
    workers: Optional[List[Dict]] = []

# Execution Log Response
class JobExecutionResponse(BaseModel):
    id: str
    job_id: str
    worker_id: Optional[str] = None
    status: str
    log_output: Optional[str] = None
    error_message: Optional[str] = None
    attempt_number: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    class Config:
        from_attributes = True

# Batch Job Schemas
class BatchJobItem(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    payload: Dict[str, Any] = {}
    priority: Optional[int] = 0
    max_retries: Optional[int] = 3
    retry_strategy: Optional[str] = "fixed"

class BatchJobCreate(BaseModel):
    queue_id: str
    jobs: List[BatchJobItem]

class BatchJobResponse(BaseModel):
    batch_id: str
    count: int

# General Job Explorer
class JobSearchResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[JobResponse]

# Queue Statistics Response
class QueueStatsResponse(BaseModel):
    queued: int
    running: int
    completed: int
    failed: int
    retrying: int
    throughput_jobs_min: float
