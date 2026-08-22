# Architecture & System Design

## System Overview

JobFlow is a distributed job scheduling platform with three main components:
1. **Frontend** — React + Vite SPA hosted on Vercel
2. **Backend** — FastAPI REST API hosted on Render
3. **Worker** — Python background process (run locally or on Render)

All components share a **PostgreSQL** database on Render (or SQLite for local development).

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (Vercel)                                           │
│  React + Vite  →  JWT Auth  →  REST API calls               │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS + JWT
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  BACKEND API (Render)                                        │
│  FastAPI  ─  Auth  ─  Projects  ─  Queues  ─  Jobs          │
│           ─  Dashboard  ─  CORS middleware                   │
└───────────────────────────┬─────────────────────────────────┘
                            │ SQLAlchemy ORM
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  DATABASE                                                    │
│  PostgreSQL (prod)  /  SQLite (dev)                          │
│  Tables: jf_users, jf_projects, jf_queues, jf_jobs,         │
│          jf_workers, jf_job_executions, jf_dlq_entries       │
└───────────────────────────▲─────────────────────────────────┘
                            │ Heartbeat + Poll + Claim
                            │
┌───────────────────────────┴─────────────────────────────────┐
│  WORKER PROCESSES (Local / Render / Docker)                  │
│  python -m worker.worker_main [--project-id PROJECT_ID]      │
│                                                              │
│  Loop every 2s:                                              │
│   1. Send heartbeat to jf_workers                            │
│   2. Check queue concurrency limits                          │
│   3. Claim job atomically (FOR UPDATE SKIP LOCKED)           │
│   4. Execute job (mock / real)                               │
│   5. Log result to jf_job_executions                         │
│   6. Retry / DLQ on failure                                  │
│   7. Schedule next run for cron jobs                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Sequence: Job Lifecycle

```
Client           API           DB              Worker
  │  POST /jobs   │             │                │
  ├──────────────►│             │                │
  │               │ INSERT job  │                │
  │               ├────────────►│ status=queued  │
  │               │             │                │
  │  ◄────────────┤             │                │
  │               │             │   Heartbeat    │
  │               │             │◄───────────────┤
  │               │             │                │
  │               │             │  Poll for jobs │
  │               │             │◄───────────────┤
  │               │             │                │
  │               │             │  UPDATE status │
  │               │             │  = claimed     │
  │               │             │◄───────────────┤
  │               │             │                │
  │               │             │  Execute job   │
  │               │             │                ├──── (2s mock)
  │               │             │                │
  │               │             │  UPDATE status │
  │               │             │  = completed   │
  │               │             │◄───────────────┤
  │               │             │  INSERT execution│
  │               │             │◄───────────────┤
```

---

## Entity Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ QUEUES : contains
    PROJECTS ||--o{ WORKERS : assigned_to
    QUEUES ||--o{ JOBS : holds
    JOBS ||--o{ JOB_EXECUTIONS : generates
    WORKERS ||--o{ JOB_EXECUTIONS : executes
    JOBS ||--o| DLQ_ENTRIES : moves_to

    USERS {
        uuid id PK
        string email
        string password_hash
        datetime created_at
    }

    PROJECTS {
        uuid id PK
        uuid user_id FK
        string name
        string description
        datetime created_at
    }

    QUEUES {
        uuid id PK
        uuid project_id FK
        string name
        int concurrency_limit
        boolean is_paused
        datetime created_at
    }

    JOBS {
        uuid id PK
        uuid queue_id FK
        string name
        jsonb payload
        string status
        datetime scheduled_at
        int priority
        int max_retries
        int retry_count
        string retry_strategy
        string cron_expression
        uuid batch_id
        datetime created_at
        datetime updated_at
    }

    JOB_EXECUTIONS {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        string status
        text log_output
        string error_message
        int attempt_number
        datetime started_at
        datetime completed_at
    }

    WORKERS {
        uuid id PK
        uuid project_id FK
        string name
        string status
        datetime last_heartbeat_at
    }

    DLQ_ENTRIES {
        uuid id PK
        uuid job_id FK
        string error_message
        datetime moved_at
    }
```
