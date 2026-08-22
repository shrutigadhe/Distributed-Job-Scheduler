# Testing Guide

## Prerequisites

Ensure the virtual environment is activated and dependencies are installed:

```bash
# From the project root
venv\Scripts\activate          # Windows
source venv/bin/activate       # Linux / Mac
```

---

## Running the Test Suite

```bash
$env:PYTHONPATH="backend"; venv\Scripts\python -m pytest backend/tests/test_scheduler.py -v
```

Expected output:
```
============================= test session starts =============================
collected 7 items

test_scheduler.py::test_paused_queue_does_not_execute     PASSED [ 14%]
test_scheduler.py::test_concurrency_limit                 PASSED [ 28%]
test_scheduler.py::test_failed_job_retries_and_dlq        PASSED [ 42%]
test_scheduler.py::test_delayed_job_execution             PASSED [ 57%]
test_scheduler.py::test_cron_job_scheduling               PASSED [ 71%]
test_scheduler.py::test_worker_heartbeat_and_offline_detection PASSED [ 85%]
test_scheduler.py::test_concurrent_claims_no_duplicates   PASSED [100%]

============================== 7 passed in 0.89s ==============================
```

---

## Test Coverage

| Test | What it Validates |
|------|-------------------|
| `test_paused_queue_does_not_execute` | Jobs in paused queues are never picked up |
| `test_concurrency_limit` | A queue at max concurrency is excluded from eligible pool |
| `test_failed_job_retries_and_dlq` | Retry counter increments, retries reschedule, DLQ entry created on exhaustion |
| `test_delayed_job_execution` | Future-scheduled jobs are not claimable; past-scheduled jobs are |
| `test_cron_job_scheduling` | Cron job completion spawns a new scheduled run in the future |
| `test_worker_heartbeat_and_offline_detection` | Heartbeat updates; workers older than 30s are detected as offline |
| `test_concurrent_claims_no_duplicates` | Only one worker claims a job even when two race to claim the same one |

---

## Integration Testing Approach

All tests use an **in-memory SQLite database** (`StaticPool`) so:
- Tests run in < 1 second with zero external dependencies.
- No leftover data between test runs (each test cleans up with `drop_all`).
- Fully reproducible regardless of environment.

For production concurrency validation, the same logic uses PostgreSQL's `FOR UPDATE SKIP LOCKED` which is tested implicitly via the ORM branching in `worker_main.py`.

---

## Adding New Tests

Add a new function to `backend/tests/test_scheduler.py`:

```python
def test_my_scenario(setup_db):
    db = setup_db
    project = db.query(Project).first()
    # ... create resources and assert behavior
```

The `setup_db` fixture automatically creates a user and project, then tears down after the test.
