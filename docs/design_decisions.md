# Design Decisions

## 1. Atomic Job Claiming — `FOR UPDATE SKIP LOCKED`

**Problem:** Multiple workers polling simultaneously can cause two workers to pick up the same job (duplicate execution).

**Solution:** We use PostgreSQL's `FOR UPDATE SKIP LOCKED` via SQLAlchemy's `.with_for_update(skip_locked=True)`. This locks the row being read so any concurrent transaction is **skipped** (not blocked), ensuring exactly one worker claims each job.

For SQLite (local dev), the file-level lock provides basic isolation. The worker code branches based on the database URL.

```python
query = db.query(Job).filter(...).order_by(...)
if "sqlite" not in DATABASE_URL:
    query = query.with_for_update(skip_locked=True)
job = query.first()
```

---

## 2. Queue Concurrency Enforcement

**Problem:** A queue with `concurrency_limit = 3` should never have more than 3 jobs executing simultaneously, regardless of how many workers are polling.

**Solution:** Before claiming any job, the worker counts jobs in `claimed` or `running` status for each queue. If the count meets or exceeds `concurrency_limit`, the queue is excluded from the eligible list for that polling cycle.

This is a **database-side enforcement** — no worker-local counters needed, which scales correctly across multiple worker processes.

```python
for q in queues:
    running = db.query(Job).filter(Job.queue_id == q.id, Job.status.in_(['claimed', 'running'])).count()
    if running < q.concurrency_limit:
        eligible_queue_ids.append(q.id)
```

---

## 3. Graceful Shutdown

**Problem:** When a worker is killed (Ctrl+C or SIGTERM from Render), it should not leave jobs stuck in `claimed` status.

**Solution:** We register Python signal handlers for `SIGINT` and `SIGTERM`. On signal, a `shutdown_requested` flag is set to `True`. The main `while` loop exits cleanly, the current job finishes, and the worker then marks itself `offline` in the database.

The main loop sleeps in 100ms increments (20 × 0.1s = 2s total) so the signal is checked frequently.

---

## 4. Worker ↔ Project Association

**Problem:** In a multi-tenant platform, all workers poll all jobs globally. A worker should be assigned to a specific project's queues only.

**Solution:** Workers accept `--project-id` as a CLI argument (or `PROJECT_ID` env var). On startup, the `project_id` is stored in `jf_workers`. During polling, only queues belonging to that project are queried.

```bash
python -m worker.worker_main --project-id abc-123
```

---

## 5. Batch Jobs via `batch_id`

**Problem:** Users may want to submit 100+ jobs at once and track them as a group.

**Solution:** The `POST /api/jobs/batch` endpoint generates a single `batch_id` UUID, inserts all jobs with that `batch_id` in a single transaction, and returns the `batch_id + count`. The client can then filter `GET /api/jobs?batch_id=...` to monitor batch progress.

---

## 6. SQLite vs PostgreSQL Compatibility

We detect the database dialect at runtime:
- **SQLite**: No `FOR UPDATE SKIP LOCKED`, uses file-level lock. Suitable for local dev only.
- **PostgreSQL**: Uses `FOR UPDATE SKIP LOCKED`, supports full concurrency. Used in production on Render.

The backend also runs runtime `ALTER TABLE` migrations on startup to safely add new columns to existing tables without requiring Alembic migrations.

---

## 7. Heartbeat & Offline Detection Threshold

Workers send a heartbeat every **~2 seconds** (each loop iteration). The dashboard marks a worker as `offline` if its `last_heartbeat_at` is older than **30 seconds**. This provides a 15× buffer before flagging a worker as dead, avoiding false positives from brief network hiccups.

---

## 8. Retry Strategies

| Strategy | Formula | Example (attempt 3) |
|----------|---------|---------------------|
| `fixed` | 10 seconds always | 10s |
| `linear` | 10 × attempt seconds | 30s |
| `exponential` | 2^attempt seconds | 8s |

After `max_retries` exhaustion, the job is marked `failed` and a `DLQEntry` is created, preserving the error message for inspection.
