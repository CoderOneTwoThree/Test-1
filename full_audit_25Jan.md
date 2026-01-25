Here’s the full MVP audit and backlog, grounded in the repo docs you specified.

**MVP Definition**  
Based on `SYSTEM_SUMMARY.md`, `TARGETS.md`, `PROGRESSION_RULES.md`, and `MVP_IMPLEMENTATION_PLAN.md`, “MVP done” means a user can complete the intake questionnaire, generate a multi‑week plan, view a plan summary, log workout sessions (sets with reps/weight/RPE/rest), and then see history and progression recommendations that follow the rules in `TARGETS.md` + `PROGRESSION_RULES.md`. This must persist to SQLite across restarts, with a minimal UI flow and basic validation.

Per `UI_SCREENS.md` and `UX_QA_FLOW.md`, the UX must include a guided questionnaire (step validation, skip for optional, review+edit summary), a plan summary, a dashboard with today’s session, a session logging screen, and history. The MVP is explicitly rules‑based and relies on questionnaire inputs, not a complex engine.

---

**Audit Findings**

- **Product Flow**
  - Intake → plan generation is disconnected: UI expects `/questionnaire` to return a `plan_id`, but server logic only inserts questionnaire data (`api/questionnaire.py`) and plan generation exists separately (`api/plans.py`).
  - Plan retrieval is missing: UI uses `GET /plans/{id}` but no endpoint/function exists to return a full plan payload with workouts/exercises.
  - Session flow mismatch: dashboard starts a session with `POST /workouts/sessions` (minimal payload) while save uses `POST /workouts` with set logs (`ui/controllers/dashboard.js`, `ui/controllers/session.js`, `api/workouts.py`).

- **Data / DB**
  - No DB init/seed path for required `users` row (`users.smallest_increment` is NOT NULL). Without seeding, plan generation will error when fetching user settings (`db/schema/001_create_core_tables.sql`, `queries/plans.py`).
  - Exercise library seeding is a manual script only (`data/exercises/seed_exercises.py`) and not wired to app startup.
  - Domain is still tightly coupled to DB queries (`domain/plans/generator.py`, `domain/progression/engine.py`), contradicting `MINIMAL_DATABASE_MVP_AUDIT.md`.

- **API / Backend**
  - No actual HTTP server/router: `api/*.py` are pure functions with no server entrypoint.
  - Missing endpoints: history list (`GET /workouts/sessions`), exercise history (`GET /exercises/{id}/history`), progression recommendations (`GET /progression/recommendations`), plan retrieval (`GET /plans/{id}`).
  - Plan swap endpoints exist as functions but no route binding.

- **UI / UX**
  - Welcome screen exists, but auto‑routing skips it when no plan exists (`ui/js/app.js`), conflicting with `UI_SCREENS.md` “Welcome / Entry first”.
  - The questionnaire review step exists in UI markup, but backend payload ignores several fields (age/sex/height/weight) and no confirmation step is stored in DB.
  - Error states are present but not wired to backend specifics (e.g., plan missing vs server down).

- **Testing**
  - No tests present (no `tests/` directory, no test tooling).
  - No verification of SQL schema or progression logic (`MVP_IMPLEMENTATION_PLAN.md` expects basic tests).

- **Ops / Deployment**
  - No run instructions or env config (no README / scripts).
  - No documented DB path or initialization procedure.
  - Mock server exists (`mock_server.py`) but not integrated into a default workflow, and it does not persist.

---

**Prioritized Task List**

1) **Wire intake → plan generation**  
   Severity: Blocker | Area: Backend  
   Rationale: UI expects a `plan_id` from `/questionnaire`, but only a questionnaire row is created. Either chain plan generation after questionnaire or update UI to call `/plans/generate`.  
   Suggested owner: Backend  
   Files: `ui/controllers/questionnaire.js`, `api/questionnaire.py`, `api/plans.py`

2) **Implement real HTTP server/router**  
   Severity: Blocker | Area: Backend/Ops  
   Rationale: No running API means UI calls cannot hit the backend.  
   Suggested owner: Backend  
   Files: `api/*`, new server entry (e.g. `server.py`)

3) **Implement `GET /plans/{id}` payload assembly**  
   Severity: Blocker | Area: Backend/Data  
   Rationale: Plan Summary and Dashboard require full plan detail with workouts/exercises.  
   Suggested owner: Backend  
   Files: add query/service layer in `queries/` + `api/plans.py`

4) **Fix session flow mismatch (start vs save)**  
   Severity: Blocker | Area: Backend/UI  
   Rationale: `POST /workouts/sessions` is used for start, while `POST /workouts` is used for save; only one server function exists and expects full set logs.  
   Suggested owner: Full‑stack  
   Files: `ui/controllers/dashboard.js`, `ui/controllers/session.js`, `api/workouts.py`

5) **Create DB init/seed script (user + exercises)**  
   Severity: Blocker | Area: Data/Ops  
   Rationale: DB must have user_id=1 and exercises for plan generation and progression.  
   Suggested owner: Backend  
   Files: new `scripts/init_db.py`, `data/exercises/seed_exercises.py`, `db/schema/001_create_core_tables.sql`

6) **Add progression recommendation endpoint**  
   Severity: High | Area: Backend  
   Rationale: Session logging UI requires recommendations to enable save (`ui/controllers/session.js`).  
   Suggested owner: Backend  
   Files: `domain/progression/engine.py`, new endpoint in API server

7) **Add workout history endpoints**  
   Severity: High | Area: Backend  
   Rationale: History screen calls `GET /workouts/sessions` and `GET /exercises/{id}/history`.  
   Suggested owner: Backend  
   Files: `queries/exercise_history.py`, new handlers

8) **Resolve Welcome flow per spec**  
   Severity: Medium | Area: UI/UX  
   Rationale: `UI_SCREENS.md` expects welcome entry, but app auto‑routes to questionnaire when no plan exists.  
   Suggested owner: Frontend  
   Files: `ui/js/app.js`, `ui/index.html`

9) **Align questionnaire summary + stored fields**  
   Severity: Medium | Area: UI/Backend  
   Rationale: UX spec requires summary confirmation; backend stores only subset of fields.  
   Suggested owner: Full‑stack  
   Files: `ui/controllers/questionnaire.js`, `api/questionnaire.py`, `db/schema/001_create_core_tables.sql`

10) **Add tests for persistence + progression rules**  
    Severity: Medium | Area: Tests  
    Rationale: MVP plan requires basic tests for DB read/write and rule logic.  
    Suggested owner: Backend  
    Files: new `tests/`, target `domain/progression/engine.py`, `queries/*`

11) **Document run instructions + env config**  
    Severity: Medium | Area: Ops  
    Rationale: No README/run instructions makes setup fragile.  
    Suggested owner: Ops/Full‑stack  
    Files: new `README.md`, scripts for DB init

12) **Decouple domain from SQL (Repository layer)**  
    Severity: Low (for MVP) | Area: Backend  
    Rationale: `MINIMAL_DATABASE_MVP_AUDIT.md` calls out coupling as a risk; MVP can ship without full refactor but it blocks testing velocity.  
    Suggested owner: Backend  
    Files: `domain/*`, `queries/*`

---

**Quick Wins**

- Add `scripts/init_db.py` to create `users` row and seed exercises (leverages `data/exercises/seed_exercises.py`).  
- Update UI to call `/plans/generate` after `/questionnaire` (or update `/questionnaire` to return plan).  
- Add a minimal `GET /plans/{id}` that joins `plans + planned_exercises + exercises` for the Plan Summary.  
- Provide a stub server with in‑memory SQLite for local dev (fast UX validation).  
- Add a README with exact run steps.

---

**Assumptions + Open Questions**

- Is the intended MVP server framework Python (Flask/FastAPI) or a minimal custom HTTP server? There’s no server entrypoint yet.  
- Should questionnaire submission **always** create a plan, or should plan generation be a separate explicit step?  
- Is `user_id=1` a firm MVP rule (as in `MINIMAL_DATABASE_MVP_AUDIT.md`), or should we implement basic user creation?  
- Do we want to keep the Welcome screen as the true entry point (per `UI_SCREENS.md`), or is auto‑routing to questionnaire acceptable?  
- What is the authoritative DB path and location for local runs?  
