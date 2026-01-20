# Implementation Plan: Workout App

## Phase 1: Foundations
**Goals**
- Establish data model, API surface, and shared domain concepts for workouts, plans, and progression.
- Make core entities and validation rules explicit so later phases can build safely.

**Concrete tasks**
- Define database schema (tables/collections) for User, Exercise, WorkoutSession, SetLog, QuestionnaireResponse, Plan, and PlanWorkout based on the architecture spec.
- Define API contracts for workout sessions, progression recommendations, questionnaire submission, and plan generation.
- Seed the exercise library (MVP list) and link exercise metadata to movement patterns, equipment, and substitutions.
- Capture progression constraints and lift targets as reusable constants.
- Define error/validation rules for logging (e.g., required reps/weight fields, allowable rep ranges).

**Deliverables (files/modules)**
- `db/schema` (migrations/models for core entities).
- `api/contracts` (request/response schemas for endpoints).
- `data/exercises` (seeded exercise library and lookup indexes).
- `domain/progression` (targets and progression rule constants).
- `domain/validation` (input validation helpers for logging and questionnaire).

**Acceptance criteria**
- Schema includes all entities from the architecture spec with required fields and relationships.
- API contracts cover all endpoints listed in the architecture spec with request/response shapes defined.
- Exercise library can be loaded and queried by equipment and movement pattern.
- Progression targets and rules are referenced from a single source of truth.

**Dependencies**
- No upstream dependencies; this phase is the foundation for all subsequent phases.

---

## Phase 2: Workout Logging
**Goals**
- Enable users to create workout sessions and log sets per exercise.
- Provide history retrieval per exercise for later progression logic.

**Concrete tasks**
- Implement session creation with set logs (including per-set reps, weight, RPE, rest).
- Add end-of-session completion status (completed/partial/skipped) to support failure-mode mitigations.
- Implement exercise history endpoint (recent set logs, bests, and volume trend inputs).
- Implement validation for rep ranges (6–12) and required fields on working sets.
- Add “auto-fill from last session” support for quick logging.

**Deliverables (files/modules)**
- `api/workouts` (session create/list endpoints).
- `domain/workouts` (session creation, set log validation, auto-fill helper).
- `queries/exercise_history` (fetch recent logs and PRs).

**Acceptance criteria**
- Users can log a workout session with multiple exercises and sets without validation errors.
- Exercise history endpoint returns the last N sessions and best sets for an exercise.
- Logged sessions record completion status and preserve partial/skipped data.

**Dependencies**
- Requires Phase 1 schema, exercise seed data, and validation helpers.

---

## Phase 3: Progression Engine
**Goals**
- Produce per-exercise progression recommendations based on logged performance.
- Apply explicit rules for increases, holds, and deloads.

**Concrete tasks**
- Implement progression rule evaluation (preconditions, increase/hold/deload logic).
- Apply lift-type-specific increment rules (lower/upper/accessory).
- Incorporate session completion and form-break flags into progression decisions.
- Handle edge cases: new lift, missed sessions, exercise swaps.
- Store and retrieve latest recommendations per exercise.

**Deliverables (files/modules)**
- `domain/progression/evaluator` (rule engine).
- `api/progression` (generate/fetch recommendations endpoints).
- `queries/progression_state` (per-exercise history aggregation).

**Acceptance criteria**
- Given a valid exercise history, the engine outputs a deterministic recommendation matching rules in PROGRESSION_RULES.
- New lifts hold for two sessions before increasing.
- Deload triggers after repeated misses are recorded and applied to the next recommendation.

**Dependencies**
- Requires Phase 2 logging and exercise history queries.
- Uses Phase 1 progression constants and targets.

---

## Phase 4: Plan Generation
**Goals**
- Generate a multi-week plan from questionnaire inputs.
- Align plan structure with goal, frequency, experience, and equipment constraints.

**Concrete tasks**
- Implement questionnaire storage and validation (required vs optional, allowed types).
- Implement plan split selection using plan generation logic rules.
- Filter exercise pool based on equipment availability and experience level.
- Assemble plan weeks with templates and exercise selections per day.
- Persist plan and plan workouts linked to questionnaire responses.

**Deliverables (files/modules)**
- `api/questionnaire` (submit endpoint and validation).
- `domain/plans/generator` (plan assembly rules).
- `domain/exercises/filters` (equipment/experience filters).
- `db/plan_templates` (plan + workout persistence).

**Acceptance criteria**
- Questionnaire submissions that pass validation produce a stored plan.
- Plan split matches rules in PLAN_GENERATION_LOGIC.
- Exercise selections exclude unavailable equipment and align with experience constraints.

**Dependencies**
- Requires Phase 1 schema and exercise library data.
- Uses questionnaire content and plan-generation logic specs.

---

## Phase 5: UI Flows
**Goals**
- Provide user-facing flows for questionnaire, workout logging, and plan review.
- Ensure UX QA flow requirements are met for navigation and validation.

**Concrete tasks**
- Build questionnaire wizard with single-question steps, validation, back/skip, and final summary.
- Build workout session logging flow with exercise selection and set entry.
- Add exercise history view to support progress review.
- Add plan review screen with per-day workouts and exercise swaps.

**Deliverables (files/modules)**
- `ui/questionnaire` (wizard steps, summary, confirmation).
- `ui/workouts` (session logger and history panels).
- `ui/plans` (plan overview and day detail).
- `ui/components` (shared inputs and validation states).

**Acceptance criteria**
- Questionnaire flow enforces required answers, supports back/skip, and shows summary for confirmation.
- Workout logging UI captures all required set fields and stores sessions.
- Plan review renders plan days and supports editing a day’s workout.

**Dependencies**
- Requires Phase 2 logging endpoints and Phase 4 plan generation endpoints.
- Relies on UX QA flow rules.

---

## Phase 6: Hardening
**Goals**
- Reduce misleading recommendations and improve reliability.
- Add mitigations for known failure modes.

**Concrete tasks**
- Add readiness and form check-in prompts to logging flow.
- Add data-confidence and mismatch flags (e.g., RPE vs weight anomalies).
- Add rolling averages for trend displays (avoid single-session spikes).
- Add audit logging for plan generation and progression decisions.
- Add minimal rate-limiting and authentication checks for write endpoints.

**Deliverables (files/modules)**
- `domain/quality_checks` (data confidence and mismatch logic).
- `ui/feedback` (readiness/form prompts).
- `api/audit` (decision logging and retrieval).
- `infra/security` (auth/rate-limit middleware).

**Acceptance criteria**
- Progression recommendations display confidence flags when inputs are inconsistent.
- Readiness/form prompts are recorded and influence progression decisions.
- API rejects unauthenticated write requests and logs key decisions.

**Dependencies**
- Requires Phase 2 logging and Phase 3 progression engine.
- Depends on failure mode mitigations specification.

---

## Key cross-phase dependencies
- Exercise library seeding (Phase 1) is required before plan generation (Phase 4) and exercise selection in logging (Phase 2).
- Workout history queries (Phase 2) are required for progression recommendations (Phase 3).
- Questionnaire validation (Phase 4) must match UX wizard validation (Phase 5).
- Readiness/form prompts (Phase 6) must be stored with sessions (Phase 2) and fed into progression decisions (Phase 3).

---

## Out of scope for MVP
- Advanced periodization engines or adaptive multi-week scheduling beyond rules-based splits.
- Automated sensor-driven form analysis or injury detection.
- Automated substitutions that optimize stimulus or volume balancing across muscle groups.
- Multi-user sharing, social features, or coaching workflows.
