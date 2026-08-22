import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

def new_uuid():
    return str(uuid.uuid4())

def get_utc_now():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=get_utc_now)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False)
    description = Column(String(512), nullable=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=get_utc_now)

    owner = relationship("User", back_populates="projects")
    queues = relationship("Queue", back_populates="project", cascade="all, delete-orphan")

class Queue(Base):
    __tablename__ = "queues"

    id = Column(String(36), primary_key=True, default=new_uuid)
    project_id = Column(String(36), ForeignKey("projects.id"), nullable=False)
    name = Column(String(255), nullable=False)
    concurrency_limit = Column(Integer, default=10)
    is_paused = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_utc_now)

    project = relationship("Project", back_populates="queues")
    jobs = relationship("Job", back_populates="queue", cascade="all, delete-orphan")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=new_uuid)
    queue_id = Column(String(36), ForeignKey("queues.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    payload = Column(JSON, default=dict)

    # Statuses: queued, scheduled, claimed, running, completed, failed, cancelled
    status = Column(String(50), default="queued", index=True)

    scheduled_at = Column(DateTime, default=get_utc_now, index=True)
    priority = Column(Integer, default=0, index=True)

    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    retry_strategy = Column(String(50), default="fixed")  # fixed, linear, exponential

    cron_expression = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    queue = relationship("Queue", back_populates="jobs")
    executions = relationship("JobExecution", back_populates="job", cascade="all, delete-orphan")
    dlq_entry = relationship("DLQEntry", back_populates="job", uselist=False, cascade="all, delete-orphan")

class Worker(Base):
    __tablename__ = "workers"

    id = Column(String(36), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False, unique=True)
    status = Column(String(50), default="active")  # active, offline
    last_heartbeat_at = Column(DateTime, default=get_utc_now)

    executions = relationship("JobExecution", back_populates="worker")

class JobExecution(Base):
    __tablename__ = "job_executions"

    id = Column(String(36), primary_key=True, default=new_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False)
    worker_id = Column(String(36), ForeignKey("workers.id"), nullable=True)

    status = Column(String(50), default="running")  # running, completed, failed
    log_output = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    attempt_number = Column(Integer, default=1)

    started_at = Column(DateTime, default=get_utc_now)
    completed_at = Column(DateTime, nullable=True)

    job = relationship("Job", back_populates="executions")
    worker = relationship("Worker", back_populates="executions")

class DLQEntry(Base):
    __tablename__ = "dlq_entries"

    id = Column(String(36), primary_key=True, default=new_uuid)
    job_id = Column(String(36), ForeignKey("jobs.id"), nullable=False, unique=True)
    error_message = Column(Text, nullable=True)
    moved_at = Column(DateTime, default=get_utc_now)

    job = relationship("Job", back_populates="dlq_entry")
