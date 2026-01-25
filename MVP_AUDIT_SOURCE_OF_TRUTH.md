# Unified MVP Audit (Source of Truth)

## MVP Definition (aligned to intent)
“MVP done” means a user can **create an account**, complete intake, generate a plan, view it, run a session, save sets, and see history + progression recommendations **using the UI**. The system must support **multiple users** and validate that data is created and saved through real UI flows (not manual DB seeding). Persistence across restarts is **preferred but not strictly required** for MVP.

**Note on architecture:** A full Repository Pattern refactor is **not required** for MVP, but we should avoid adding new logic/SQL coupling and keep a clean path for future decoupling.

---

## Audit Findings (resolved)

- **Product Flow**
  - Missing/unclear **user creation flow** in UI. MVP requires multi‑user testing through the app.
  - Intake → plan generation now wired, but must be validated for **per‑user** data.
  - Plan retrieval is required and should return full workouts/exercises.

- **Data / DB**
  - `users.smallest_increment` is required; **user creation must set it**.
  - Exercise seeding exists, but only via script — OK for MVP as long as UI testing doesn’t require manual DB inserts.

- **API / Backend**
  - Minimal server exists (`server/app.py`), but **user creation endpoint is missing**.
  - Endpoints for plan retrieval, history, and progression must be confirmed to match UI expectations.

- **UI / UX**
  - Need a minimal **Create User / Select User** flow (even if it’s a small modal or welcome‑screen form).
  - UX polish can wait.

- **Testing**
  - “Testing” means **using the app UI flows** (manual QA checklist is required). Automated tests are optional for MVP.

- **Ops**
  - Running locally is defined (README + server + init script). Persistence is optional.

---

## Prioritized Task List (single truth)

### P0 — MVP Blockers
1) **Add User Creation Flow (UI + API)**  
   Severity: Blocker | Area: UI/Backend  
   Rationale: MVP requires multi‑user testing via the UI.  
   Files: `ui/index.html`, `ui/controllers/*`, `ui/js/store.js`, new API route in `server/app.py`.

2) **Ensure All Core Flows Use User Context**  
   Severity: Blocker | Area: Full‑stack  
   Rationale: Questionnaire, plan generation, session saves, history must all be tied to the active user.  
   Files: `ui/controllers/questionnaire.js`, `ui/controllers/session.js`, `ui/controllers/history.js`, `server/app.py`.

3) **Plan Retrieval Payload Must Match UI Needs**  
   Severity: Blocker | Area: Backend  
   Rationale: Plan summary + dashboard require full plan data with workouts/exercises.  
   Files: `server/app.py` (`_fetch_plan_payload`), `queries/*`.

4) **History + Progression Endpoints Verified End‑to‑End**  
   Severity: Blocker | Area: Backend/UI  
   Rationale: Session logging flow depends on recommendations; history depends on session logs.  
   Files: `server/app.py`, `domain/progression/engine.py`, `queries/exercise_history.py`.

### P1 — High Priority (post‑blockers)
5) **Manual QA Checklist (UI‑based testing)**  
   Severity: High | Area: Testing  
   Rationale: You require testing through the app.  
   Files: new `QA_CHECKLIST.md`.

6) **Basic Validation & Error Messaging for User Flow**  
   Severity: High | Area: UI  
   Rationale: User creation and user switching must fail safely.  
   Files: `ui/controllers/*`.

### P2 — Nice‑to‑Have / Post‑MVP
7) **Repository Pattern Refactor (partial or full)**  
   Severity: Low | Area: Backend  
   Rationale: Valuable for long‑term testability but not required for MVP.

8) **UX Polish (questionnaire summary storage, welcome refinements)**  
   Severity: Low | Area: UI

---

## Quick Wins

- Use `scripts/init_db.py` to prep DB quickly.
- Add a **minimal Create User** form on the Welcome screen.
- Add a **QA checklist** so we can validate end‑to‑end flows through the UI.

---

## Resolved Contradictions

- **Repository Pattern refactor** is **not required for MVP**, despite being recommended in `MINIMAL_DATABASE_MVP_AUDIT.md`. It’s now a **P2** task.
- **Testing** means **UI‑driven flows**, not synthetic DB inserts.
- **Multiple users** are mandatory; **single user assumption is dropped**.
- **Persistence** is preferred but **not a hard blocker**.
