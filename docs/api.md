# API Reference

All API routes are prefixed with `/api`. JWT Bearer token is required on all protected endpoints.

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | ❌ | Register a new user |
| POST | `/api/auth/login` | ❌ | Login and get JWT token |

---

## Projects

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/projects` | ✅ | List all user projects |
| POST | `/api/projects` | ✅ | Create a new project |
| DELETE | `/api/projects/{project_id}` | ✅ | Delete a project |

---

## Queues

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/queues/{project_id}` | ✅ | List queues in a project |
| POST | `/api/queues/{project_id}` | ✅ | Create a queue |
| PATCH | `/api/queues/{queue_id}` | ✅ | Update queue settings |
| DELETE | `/api/queues/{queue_id}` | ✅ | Delete a queue |
| POST | `/api/queues/{queue_id}/pause` | ✅ | Pause the queue |
| POST | `/api/queues/{queue_id}/resume` | ✅ | Resume the queue |
| GET | `/api/queues/{queue_id}/stats` | ✅ | Get queue statistics & throughput |

### Queue Stats Response
```json
{
  "queued": 4,
  "running": 2,
  "completed": 95,
  "failed": 1,
  "retrying": 0,
  "throughput_jobs_min": 3.2
}
```

---

## Jobs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs` | ✅ | Search/filter/page all jobs |
| POST | `/api/jobs/{queue_id}` | ✅ | Create a single job |
| POST | `/api/jobs/batch` | ✅ | Create multiple jobs in one request |
| GET | `/api/jobs/{queue_id}` | ✅ | List jobs in a queue |
| POST | `/api/jobs/{job_id}/retry` | ✅ | Re-queue a failed/cancelled job |
| GET | `/api/jobs/{job_id}/executions` | ✅ | Get execution history for a job |

### Job Search Query Parameters
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search by job name or exact ID |
| `status` | string | Filter by status (queued, running, completed, failed) |
| `queue_id` | string | Filter by queue |
| `priority` | int | Filter by exact priority |
| `page` | int | Page number (default: 1) |
| `limit` | int | Jobs per page (default: 10) |

### Job Search Response
```json
{
  "total": 50,
  "page": 2,
  "limit": 10,
  "items": [...]
}
```

### Create Single Job Request
```json
{
  "name": "send-email",
  "payload": {"to": "a@example.com"},
  "priority": 5,
  "max_retries": 3,
  "retry_strategy": "exponential",
  "scheduled_at": "2026-09-01T10:00:00Z",
  "cron_expression": "*/5 * * * *"
}
```

### Create Batch Jobs Request — `POST /api/jobs/batch`
```json
{
  "queue_id": "queue-uuid-here",
  "jobs": [
    {"name": "email", "payload": {"to": "a@example.com"}},
    {"type": "email", "payload": {"to": "b@example.com"}},
    {"name": "email", "payload": {"to": "c@example.com"}, "priority": 10}
  ]
}
```

### Batch Jobs Response
```json
{
  "batch_id": "abc-123-batch-uuid",
  "count": 3
}
```

### Job Execution Log Response
```json
[
  {
    "id": "exec-uuid",
    "job_id": "job-uuid",
    "worker_id": "worker-uuid",
    "status": "failed",
    "error_message": "Simulated failure",
    "attempt_number": 1,
    "started_at": "2026-08-22T10:00:00Z",
    "completed_at": "2026-08-22T10:00:02Z"
  },
  {
    "id": "exec-uuid-2",
    "job_id": "job-uuid",
    "worker_id": "worker-uuid",
    "status": "completed",
    "log_output": "Job executed successfully",
    "attempt_number": 2,
    "started_at": "2026-08-22T10:00:12Z",
    "completed_at": "2026-08-22T10:00:14Z"
  }
]
```

---

## Dashboard

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/dashboard/metrics` | ✅ | Get all dashboard metrics and worker list |

### Dashboard Response
```json
{
  "total_queues": 5,
  "active_workers": 2,
  "jobs_queued": 10,
  "jobs_running": 3,
  "jobs_completed": 87,
  "jobs_failed": 2,
  "workers": [
    {
      "id": "worker-uuid",
      "name": "worker-abc123",
      "status": "online",
      "last_heartbeat": "2026-08-22T18:30:05Z",
      "jobs_processed": 42,
      "project_id": "project-uuid"
    }
  ]
}
```
