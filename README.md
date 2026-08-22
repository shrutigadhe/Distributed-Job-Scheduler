# Distributed Job Scheduler Platform

This is a production-inspired distributed job scheduling platform capable of executing asynchronous background jobs.

## Architecture

- **Backend**: FastAPI (Python), SQLAlchemy
- **Worker**: Python (Custom polling loop with DB locking for concurrency)
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL
- **Infrastructure**: Docker Compose

## Features

- **Authentication**: JWT-based login/register.
- **Projects & Queues**: Manage queues within projects. Concurrency limits.
- **Job Lifecycle**: Queued -> Scheduled -> Claimed -> Completed/Failed.
- **Retries & DLQ**: Configurable max retries and Dead Letter Queue for permanent failures.
- **Worker Scaling**: Multiple workers can safely pull from the same queues atomically using `SELECT ... FOR UPDATE SKIP LOCKED`.
- **Dashboard**: Real-time stats, job statuses, and worker tracking.

## Setup & Run

Make sure you have Docker and Docker Compose installed.

1. **Start the stack**:
   ```bash
   docker-compose up --build
   ```

2. **Access the Application**:
   - Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
   - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
   
3. **Usage**:
   - Open the frontend, register a new account, and login.
   - Use the API documentation (`/docs`) to create Projects, Queues, and Jobs using your Bearer token.
   - The React dashboard will show live metrics (polling every 5 seconds).
   - The Worker node will automatically poll the database and execute jobs, simulating execution time and randomly failing jobs with `force_fail` in the payload.

## Database Schema Highlights

- Atomic claiming relies on `SELECT FOR UPDATE SKIP LOCKED`. This guarantees that if you scale to `worker-2`, `worker-3`, etc., no two workers will claim the same job.
- Scheduled and recurring (cron) jobs are supported.
