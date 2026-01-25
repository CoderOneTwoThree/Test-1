# MVP Persistence & Delivery Plan

## 1. Executive Summary

**The Problem:** The application is currently blocked by "Persistence Coupling." Core domain logic (e.g., generating a plan, calculating progression) is intertwined with raw SQL execution. This prevents unit testing of the complex logic and creates a circular dependency where screens can't be tested without a full database, but the database can't be reliably populated because the logic is brittle.

**The Solution:** We will maintain the "Brutalist" tech stack (Vanilla JS + Python + Raw SQLite) but introduce a **Repository Pattern**. This separates *business logic* (how to design a workout plan) from *data access* (how to save it). We will standardize on a single-user model (`user_id=1`) to unblock Foreign Key constraints immediately without implementing complex auth.

**Value Unlock:**
1.  **Testability:** We can write tests for `PlanGenerator` without a database file.
2.  **Stability:** We can write tests for SQL queries using an in-memory SQLite DB.
3.  **Velocity:** The UI can rely on a stable API contract backed by working persistence.

---

## 2. Current-State Findings & Analysis

### Tech Stack Map
* **Frontend:** Vanilla JS / SPA Architecture.
    * **State:** Custom `Store` object (`ui/js/store.js`).
    * **View:** `ViewManager` (`ui/js/view-manager.js`) + Controllers.
    * **API Client:** `fetch` calls directly inside Controllers (e.g., `ui/controllers/dashboard.js`).
* **Backend:** Python (Script-based handlers, likely invoked by a thin web wrapper).
    * **Logic:** `domain/` contains mixed logic and SQL.
    * **API:** `api/` contains request handlers that call `domain/`.
* **Persistence:** SQLite (`sqlite3` stdlib).
    * **Schema:** `db/schema/001_create_core_tables.sql`.
    * **Connection:** `db/connection.py`.

### Coupling & Issues
| Component | Issue | File Reference |
| :--- | :--- | :--- |
| **Plan Generator** | **Critical Coupling:** `PlanGenerator.generate` instantiates its own DB connection and executes raw SQL queries. Cannot be unit tested. | `domain/plans/generator.py` |
| **Progression** | **Logic/Data Mix:** `recommend_next_load` fetches history directly via SQL inside the calculation flow. | `domain/progression/engine.py` |
| **API Layer** | **Leakage:** `api/workouts.py` contains SQL queries (`_fetch_exercise_categories`) instead of delegating to a data layer. | `api/workouts.py` |
| **Schema** | **Constraint Risk:** `users` table exists, but no logic ensures a user exists before creating a plan (FK violation risk). | `db/schema/001...sql` |
| **Security** | **Injection Safety:** The code correctly uses parameterized queries (`?`), which is good. | `queries/plans.py` |

---

## 3. Proposed MVP Persistence Strategy

### A. Database Choice
**Decision:** **SQLite**.
* **Why:** Zero configuration, file-based (local-first), native Python support, easy to back up/reset during development.
* **Mode:** WAL (Write-Ahead Logging) mode should be enabled for better concurrency if the UI makes parallel requests.

### B. Schema Strategy (Minimal Viable)
The existing schema (`db/schema/001_create_core_tables.sql`) is mostly correct. We will enforce it strictly.

**Core Entities:**
1.  **`users`**: The root aggregate.
2.  **`exercises`**: Static reference data (seeded).
3.  **`plans`**: Generated schedules linking users to templates.
4.  **`workout_sessions`**: The execution log.
5.  **`set_logs`**: The atomic unit of data.

**Required Changes:**
* Ensure `PRAGMA foreign_keys = ON;` is executed on *every* connection (already in `db/connection.py` but must be verified in tests).

### C. Architecture Refactor: The Repository Pattern

We will refactor the code to move SQL out of `domain/` and `api/` into a dedicated `data/` or `repositories/` layer.

**New Structure:**
```text
/
├── api/                  # Handles HTTP/Payloads, calls Services
├── domain/               # Pure Python logic (Dataclasses, math, rules). NO SQL.
├── db/                   # Schema & Connection
└── repositories/         # NEW: Handles all SQL execution
    ├── user_repository.py
    ├── plan_repository.py
    ├── workout_repository.py
    └── exercise_repository.py


## 4. Testing Strategy
This architecture allows "Pyramid" testing to break the current deadlock.



### A. Unit Tests (Domain Logic)
* **Scope:** `PlanGenerator`, `ProgressionEngine`.
* **Method:** Pass data (lists of objects) into these functions, not DB connections.
* **Benefit:** Fast, deterministic. We can test "What if the user misses 3 workouts?" without inserting 3 workouts into a DB.

### B. Integration Tests (Repositories)
* **Scope:** `repositories/*.py`.
* **Method:** Use `sqlite3.connect(":memory:")` or a temp file.
* **Lifecycle:**
    1.  Spin up in-memory DB.
    2.  Apply `001_create_core_tables.sql`.
    3.  Seed `User(id=1)`.
    4.  Run repository method.
    5.  Assert state.
    6.  Teardown.

### C. API Tests (End-to-End)
* **Scope:** `api/*.py`.
* **Method:** Use a persistent `test.db` file that is reset before the suite runs.
* **Benefit:** Verifies the full chain including constraints.

---

## 5. Security & Identity Decisions
### User Identity: Option A (Single-User Fixed)
**Recommendation:** Option A. We will **not** implement auth screens or sessions for MVP.

* **Implementation:** The DB will be seeded with `INSERT INTO users (id, email, ...) VALUES (1, 'local@user', ...)`.
* **Frontend:** The JS Store will continue to hardcode `user_id: 1`.
* **Backend:** APIs will require `user_id` in the payload (validation: strictly generic integer), but we will rely on the seeded row.
* **Trade-off:** Minimal overhead. Unblocks FK constraints. Easy to migrate to "Real Auth" later (just add a login screen that changes the `user_id` in the Store).

### Security Checklist (Local Dev)
* **Input Validation:** Ensure `user_id` and IDs are positive integers. Ensure `reps/weight` are within sane bounds (prevent partial DOS via massive number crunching).
* **SQL Injection:** Continue strictly using parameterized queries (`?`). **Never** f-string SQL.
* **Migration Safety:** Ensure the app runs DDL (Create Table) commands idempotently on startup.

---

## 6. Implementation Plan (Step-by-Step)

### Phase 1: Foundation (Unblock Persistence)
**Issue 1: Establish Repositories & Testing Ground**
* **Task:** Create `repositories/` module. Move raw SQL from `queries/` into these files.
* **Task:** Create `tests/conftest.py` with a `db_connection` fixture (in-memory SQLite).
* **Deliverable:** A working `ExerciseRepository` backed by tests.

**Issue 2: Seed the "Default User"**
* **Task:** Create a startup script `scripts/init_db.py`.
* **Logic:** Apply schema `001`. Insert `User(id=1)` if not exists. Seed `exercises`.
* **Deliverable:** Running `python scripts/init_db.py` creates a usable local DB.

### Phase 2: Decouple Domain (Unblock Logic)
**Issue 3: Refactor Plan Generator**
* **Task:** Update `PlanGenerator.generate` signature. Remove `db_path` argument. Accept `exercise_pool` and `user_profile` as Dataclasses/Dictionaries.
* **Task:** Move the SQL that fetches those inputs into `api/plans.py` (which then calls the Repository, then the Generator).
* **Deliverable:** Unit tests for `PlanGenerator` running without any DB.

**Issue 4: Refactor Workout Logging**
* **Task:** Create `WorkoutRepository.save_session`.
* **Task:** Update `api/workouts.py` to use the repository.
* **Deliverable:** API endpoint `POST /workouts/sessions` saves to SQLite via Repository.

### Phase 3: Connect UI (Unblock Screens)
**Issue 5: Verify End-to-End Flows**
* **Task:** Manually verify the "Happy Path":
    1.  Run `init_db.py`.
    2.  Open UI.
    3.  Complete Questionnaire (Network tab should show 200 OK).
    4.  View Dashboard (Should load Plan from DB).
    5.  Log Workout (Should save to DB).
* **Task:** Fix any JSON serialization mismatches between Python logic and JS Store.

---

## 7. Definition of Done
- [ ] `scripts/init_db.py` exists and successfully creates a DB with User 1 and Exercises.
- [ ] `domain/` contains **zero** `sqlite3` imports or SQL strings.
- [ ] `repositories/` contains **all** SQL strings.
- [ ] At least one Integration Test exists using an in-memory DB to verify SQL syntax.
- [ ] At least one Unit Test exists verifying Plan Generation logic with mock data.
- [ ] The App can be launched locally, and data persists across server restarts.
