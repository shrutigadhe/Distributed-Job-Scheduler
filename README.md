# Distributed Job Scheduler Platform

This is a production-inspired distributed job scheduling platform capable of reliably executing asynchronous background jobs across multiple workers.

## 🚀 Live Demo
* **Frontend Dashboard**: [https://distributed-job-scheduler-zeta.vercel.app](https://distributed-job-scheduler-zeta.vercel.app)

---

## 🛠️ Architecture

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy ORM
- **Worker**: Python (Custom polling loop with row-level locks)
- **Database**: PostgreSQL (Production) / SQLite (Local Dev)
- **Infrastructure**: Docker Compose

---

## ✨ Features

- **Authentication**: JWT-based secure login and registration.
- **Project-Scoped Queues**: Manage queues within isolated projects with custom concurrency limits.
- **Job Lifecycle**: Immediate, delayed, scheduled, recurring (cron), and batch jobs.
- **Robust Retry System**: Configurable max retries with Fixed, Linear, or Exponential backoff strategies.
- **Dead Letter Queue (DLQ)**: Failed jobs are automatically moved to the DLQ with saved error logs for easy manual retries.
- **Atomic Job Claiming**: Uses PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` to prevent duplicate processing when workers scale.
- **Observability**: Live metrics dashboard, execution history logging, and worker heartbeat/liveness tracking.

---

## ⚙️ Setup & Run

### Method 1: Using Docker (Recommended)
Make sure you have Docker and Docker Compose installed:

1. **Start the stack**:
   ```bash
   docker-compose up --build
   ```
2. **Access the services**:
   - Frontend Dashboard: [http://localhost:5173](http://localhost:5173)
   - Backend API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Method 2: Running Locally (Without Docker)

#### 1. Start the Backend API
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment, then install dependencies:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate

   pip install -r requirements.txt
   ```
3. Run the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

#### 2. Start the Worker
1. Navigate to the project root directory:
   ```bash
   cd ..
   ```
2. Set the `DATABASE_URL` to point to the backend database (defaults to local SQLite if left empty):
   ```bash
   # On Windows (PowerShell):
   $env:DATABASE_URL="sqlite:///./backend/job_scheduler.db"
   ```
3. Run the worker script using the virtual environment:
   ```bash
   venv\Scripts\python worker\worker_main.py
   ```
   *(Note: You can also use the local shortcut script `run_worker.bat` in the root folder).*

#### 3. Start the Frontend
1. Navigate to the `frontend/` directory, install npm packages, and run:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Open your browser to [http://localhost:5173](http://localhost:5173).

---

## 🧪 Running Tests

To run the automated test suite verifying queue concurrency, retries, cron scheduling, and database locks:

* **Windows**:
  ```powershell
  $env:PYTHONPATH="backend"; venv\Scripts\python -m pytest backend/tests -v
  ```
* **Linux/macOS**:
  ```bash
  PYTHONPATH=backend venv/bin/pytest backend/tests -v
  ```
