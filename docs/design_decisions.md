# Design Decisions Document

## Architecture 
The system is built as a modular monolithic backend (FastAPI) paired with decoupled worker processes. State is centralized in PostgreSQL.

## Database Design
1. **Primary Keys**: We use UUIDv4 for all primary keys to ensure global uniqueness and prevent sequential ID guessing (security best practice for APIs).
2. **Concurrency**: Job polling utilizes PostgreSQL's `SELECT ... FOR UPDATE SKIP LOCKED`. 
   - This prevents row-level deadlocks and race conditions. 
   - When a worker queries for the next job, it locks the row. If another worker queries at the same time, it simply skips the locked row and grabs the next available one.
3. **Indexing**: Indexes are placed on `queue_id`, `status`, `scheduled_at`, and `priority` in the `jobs` table to speed up the worker polling queries.
4. **Heartbeats**: The worker periodically updates its `last_heartbeat_at` timestamp in the DB. This allows the backend to know how many workers are active.

## Trade-offs
- **Polling vs Push**: We chose a polling model with DB-level locks rather than a dedicated message broker (like RabbitMQ or Redis) to simplify infrastructure and keep the entire state (including retries, history, DLQ) queryable via standard SQL. The trade-off is higher DB load at scale, which can be mitigated by tuning the polling interval and partitioning tables.
- **ORM**: We use SQLAlchemy to rapidly define schemas and migrations. For the critical `claim` query, we drop down to native SQL (`text(...)`) because ORM support for `SKIP LOCKED` varies and native SQL provides explicit control over the concurrency primitive.
- **Frontend Live Updates**: Initially implemented via 5-second polling. For production, WebSockets would reduce HTTP overhead, but polling is simpler to implement and sufficiently robust for the initial scope.
