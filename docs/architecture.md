# Architecture & Database Diagrams

## System Architecture

```mermaid
graph TD
    UI[Frontend: React + Vite] -->|REST API + JWT| API[Backend: FastAPI]
    API -->|Read/Write| DB[(PostgreSQL)]
    Worker1[Worker Node 1] -->|Poll/Claim Jobs & Heartbeat| DB
    Worker2[Worker Node 2] -->|Poll/Claim Jobs & Heartbeat| DB
```

## Entity Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : owns
    PROJECTS ||--o{ QUEUES : contains
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
        string status "queued, scheduled, running, completed, failed, cancelled"
        datetime scheduled_at
        int priority
        int max_retries
        int retry_count
        string retry_strategy "fixed, linear, exponential"
        string cron_expression
        datetime created_at
    }

    JOB_EXECUTIONS {
        uuid id PK
        uuid job_id FK
        uuid worker_id FK
        string status "running, completed, failed"
        text log_output
        string error_message
        int attempt_number
        datetime started_at
        datetime completed_at
    }

    WORKERS {
        uuid id PK
        string name
        string status "active, offline"
        datetime last_heartbeat_at
    }

    DLQ_ENTRIES {
        uuid id PK
        uuid job_id FK
        string error_message
        datetime moved_at
    }
```
