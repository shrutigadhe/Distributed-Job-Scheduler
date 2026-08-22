FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# the app directory from backend is mounted via docker-compose
COPY . .

CMD ["python", "-m", "worker_main"]
