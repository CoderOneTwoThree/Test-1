# Implementation Plan

## Phase 1: Foundations
**Goals**
- Establish the minimal data model, storage, and service boundaries required for logging, progression, and plan generation.
- Define API contracts and validation rules for core flows.

**Concrete tasks**
- Translate the core entities into concrete schema definitions (User, Exercise, WorkoutSession, SetLog, Plan, PlanWorkout, QuestionnaireResponse, ProgressionRecommendation).  
- Define storage strategy and migrations for MVP (local DB or lightweight store with versioning).  
- Specify API endpoints/interfaces for sessions, exercises history, progression recommendations, questionnaire, and plans.  
- Define validation rules for logging, questionnaire inputs, and plan generation constraints.  
- Seed the exercise library from the MVP/expanded list with movement patterns, equipment, and substitutions.

**Deliverables (files/modules)**
- `data/schema` definitions and migrations.  
- `data/repositories` for sessions, set logs, exercises, plans, questionnaire responses.  
- `api/contracts` or route definitions for the MVP endpoints.  
- `validation` module for logging and questionnaire constraints.  
- `data/seed/exercises` containing the exercise library.

**Acceptance criteria**
- Database can be created and queried for all core entities.
- API contracts compile and are exercised by stub handlers or mocked responses.
- Validation rules reject incomplete or invalid inputs per spec.

**Key dependencies**
- API contracts depend on finalized schema and validation rules.  
- Exercise seed data depends on the exercise library being parsed and normalized.

---

## Phase 2: Workout Logging
**Goals**
- Enable users to start a session, log sets, and persist completed workouts.

**Concrete tasks**
- Implement session creation and close-out with timestamps and notes.  
- Implement set logging with reps, weight, RPE, rest, and form-break flags.  
- Add “completed / partial / skipped” session status capture.  
- Implement exercise history retrieval by exercise and date range.  
- Enforce logging validations (required sets, numeric ranges, missing fields).

**Deliverables (files/modules)**
- `workouts/session_service` for create/update/complete flows.  
- `workouts/set_log_service` for set persistence and validation.  
- `workouts/history_service` for per-exercise history queries.  
- `api/workouts` handlers for `POST /workouts/sessions` and `GET /workouts/sessions`.

**Acceptance criteria**
- A session with multiple exercises and sets persists and can be retrieved.  
- History queries return correct sets filtered by exercise and date.  
- Incomplete or invalid set logs are rejected with clear errors.

**Key dependencies**
- Requires Phase 1 schema, repositories, and validation modules.  
- Exercise seed data must be loaded before logging sessions.

---

## Phase 3: Progression Engine
**Goals**
- Compute next-session targets using the progression rules and targets spec.

**Concrete tasks**
- Implement progression rules: preconditions, increase/hold/decrease logic, deload rules, and edge cases.  
- Map exercises to lift categories (lower-body compound, upper-body compound, accessory) for increment selection.  
- Implement target generation: 3 working sets, 6–12 rep range, 12/10 rep thresholds, reset to 6–8 after increases.  
- Create a recommendation record tied to an exercise and session basis.  
- Add API endpoint to generate and fetch recommendations.

**Deliverables (files/modules)**
- `progression/rules` encapsulating progression logic.  
- `progression/engine` to compute next-session targets from recent sessions.  
- `progression/recommendation_repository` and API handlers.  
- `progression/mapping` for exercise category resolution.

**Acceptance criteria**
- Given sample logged sessions, the engine outputs the expected next-session weight and rep targets.  
- Edge cases (first log, missed sessions, exercise swap) yield the defined behavior.  
- Recommendations are persisted and retrievable per user/exercise.

**Key dependencies**
- Requires Phase 2 logging data to compute progression.  
- Depends on exercise categorization from Phase 1 seed data.

---

## Phase 4: Plan Generation
**Goals**
- Generate a multi-week plan from the questionnaire, rules, and exercise pool.

**Concrete tasks**
- Implement questionnaire storage and validation, including required vs optional questions.  
- Implement plan generation rules for split selection, weekly frequency structure, volume levels, and equipment constraints.  
- Build workout templates for each plan day using exercise pool filtering and movement pattern balance.  
- Persist plans and plan workouts with day index and template linkage.  
- Implement plan retrieval and update endpoints (metadata updates and workout swaps).

**Deliverables (files/modules)**
- `questionnaire/service` and storage for responses.  
- `plans/generator` implementing plan generation logic.  
- `plans/template_builder` for constructing daily workouts.  
- `api/plans` handlers for `POST /plans/generate`, `GET /plans/{id}`, and patch routes.  
- `plans/repository` for plan persistence.

**Acceptance criteria**
- A questionnaire submission yields a plan matching split and frequency rules.  
- Equipment constraints filter exercises correctly.  
- Plans can be retrieved and updated, and swaps persist.

**Key dependencies**
- Requires Phase 1 data model and exercise pool.  
- Depends on questionnaire validation rules being finalized.

---

## Phase 5: UI Flows
**Goals**
- Deliver MVP screens for onboarding, plan summary, dashboard, session logging, and progress history.

**Concrete tasks**
- Implement the onboarding/questionnaire wizard with validation, back/skip, and summary confirmation.  
- Build plan summary view and confirm flow to dashboard.  
- Build dashboard with “today’s session” and navigation.  
- Build session detail logging UI aligned with the logging APIs.  
- Build progress/history views for session and exercise history.  
- Implement settings/profile view with re-run onboarding entry.

**Deliverables (files/modules)**
- `ui/screens` for Welcome, Questionnaire, Plan Summary, Dashboard, Session Detail, Progress, Settings.  
- `ui/components` for form controls, validation errors, and history lists.  
- `ui/data` hooks/services for questionnaire, plans, sessions, and progression recommendations.

**Acceptance criteria**
- Users can complete the questionnaire and reach a plan summary.  
- Users can start a session, log sets, complete the session, and see it in history.  
- Progress view shows prior sessions and recommendations.

**Key dependencies**
- Requires Phase 2 logging APIs and Phase 4 plan APIs.  
- Depends on Phase 3 recommendations for displaying targets.

---

## Phase 6: Hardening
**Goals**
- Improve reliability, data integrity, and coverage for MVP stability.

**Concrete tasks**
- Add validation edge-case tests for logging and questionnaire flows.  
- Add progression engine unit tests covering increases, holds, deloads, and edge cases.  
- Implement data migration checks and rollback strategy for schema changes.  
- Add basic monitoring/logging for API errors and failed validations.  
- Document failure modes and user-facing mitigations in UI (partial session, RPE mismatch flags).

**Deliverables (files/modules)**
- `tests/progression` and `tests/workouts` suites.  
- `migrations` sanity checks and rollback docs.  
- `observability/logging` for API error capture.  
- `ui/components` for error states and data confidence prompts.

**Acceptance criteria**
- Test suites cover core flows and pass in CI.  
- Schema changes can be applied and reverted cleanly.  
- Critical validation errors are surfaced and logged.

**Key dependencies**
- Requires completed Phase 2–5 functionality to test and harden.  
- Monitoring depends on API layer being in place.

---

## Out of scope for MVP
- Multi-week periodization, adaptive volume balancing, and advanced scheduling conflict resolution.  
- Automated injury-aware substitutions beyond basic equipment filtering.  
- Sensor-driven or wearable-based auto-logging and form analysis.  
- Social features, sharing, or competitive leaderboards.  
