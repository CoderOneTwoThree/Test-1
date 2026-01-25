# Unified MVP Audit (Source of Truth)

## MVP Definition (aligned to intent)
“MVP done” means a user can complete intake, generate a plan, view it, run a session, save sets, and see history + progression recommendations **using the UI**. The MVP assumes a **single local user** (e.g., `user_id=1`) seeded in the database. Persistence across restarts is **preferred but not strictly required** for MVP.

**Note on architecture:** A full Repository Pattern refactor is **not required** for MVP, but we should avoid adding new logic/SQL coupling and keep a clean path for future decoupling.

---

## Audit Findings (resolved)

- **Product Flow**
  - Intake → plan generation now wired, but must be validated for the single local user.
  - Plan retrieval is required and should return full workouts/exercises.

- **Data / DB**
  - `users.smallest_increment` is required; **the default user seed must set it**.
  - Exercise seeding exists, but only via script — OK for MVP as long as UI testing doesn’t require manual DB inserts.

- **API / Backend**
  - Endpoints for plan retrieval, history, and progression must be confirmed to match UI expectations.

- **UI / UX**
  - UX polish can wait.

- **Testing**
  - “Testing” means **using the app UI flows** (manual QA checklist is required). Automated tests are optional for MVP.

- **Ops**
  - Running locally is defined (README + server + init script). Persistence is optional.

---

## Prioritized Task List (single truth)

### P0 — MVP Blockers
1) **Plan Retrieval Payload Must Match UI Needs**  
   Severity: Blocker | Area: Backend  
   Rationale: Plan summary + dashboard require full plan data with workouts/exercises.  
   Files: `server/app.py` (`_fetch_plan_payload`), `queries/*`.

2) **History + Progression Endpoints Verified End‑to‑End**  
   Severity: Blocker | Area: Backend/UI  
   Rationale: Session logging flow depends on recommendations; history depends on session logs.  
   Files: `server/app.py`, `domain/progression/engine.py`, `queries/exercise_history.py`.

### P1 — High Priority (post‑blockers)
3) **Manual QA Checklist (UI‑based testing)**  
   Severity: High | Area: Testing  
   Rationale: You require testing through the app.  
   Files: new `QA_CHECKLIST.md`.

4) **Basic Validation & Error Messaging for Core Flow**  
   Severity: High | Area: UI  
   Rationale: Intake, plan generation, session logging must fail safely.  
   Files: `ui/controllers/*`.

### P2 — Nice‑to‑Have / Post‑MVP
5) **Repository Pattern Refactor (partial or full)**  
   Severity: Low | Area: Backend  
   Rationale: Valuable for long‑term testability but not required for MVP.

6) **UX Polish (questionnaire summary storage, welcome refinements)**  
   Severity: Low | Area: UI

---

## Quick Wins

- Use `scripts/init_db.py` to prep DB quickly.
- Add a **QA checklist** so we can validate end‑to‑end flows through the UI.

---

## Resolved Contradictions

- **Repository Pattern refactor** is **not required for MVP**, despite being recommended in `MINIMAL_DATABASE_MVP_AUDIT.md`. It’s now a **P2** task.
- **Testing** means **UI‑driven flows**, not synthetic DB inserts.
- **Single‑user assumption** is accepted for MVP; multi‑user is deferred.
- **Persistence** is preferred but **not a hard blocker**.
