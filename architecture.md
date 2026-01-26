# Minimal workout app architecture

## Core data model
- **User**: id, email, created_at, smallest_increment
- **Exercise**: id, name, primary_muscle, equipment, movement_pattern, category
- **WorkoutTemplate**: id, name, goal, difficulty, created_by_user_id (reserved; not used in the MVP flow)
- **WorkoutTemplateExercise**: template_id, exercise_id, order, target_sets, target_reps, target_rpe_or_intensity (reserved; not used in the MVP flow)
- **WorkoutSession**: id, user_id, template_id (nullable, reserved), performed_at, duration_minutes, notes, completion_status (completed/partial/skipped), manual_audit_flag
- **SetLog**: session_id, exercise_id, set_number, reps, weight, rpe, rest_seconds, is_initial_load
- **ProgressionRecommendation**: user_id, exercise_id, basis (e.g., last_best, volume_trend), suggested_weight, suggested_reps, suggested_sets, created_at
- **ManualFormAlert**: user_id, exercise_id, created_at, status (applied/cleared)
- **QuestionnaireResponse**: user_id, answered_at, goals, experience_level, schedule_days, training_days_of_week, split_variant, equipment_available, injuries_constraints, excluded_patterns
- **Plan**: id, user_id, name, start_date, weeks, generated_from_questionnaire_id
- **PlanWorkout**: plan_id, day_index, template_id (reserved; MVP relies on PlannedExercise rows)
- **PlannedExercise**: plan_id, day_index, session_type, sequence, exercise_id, target_sets, target_reps_min, target_reps_max, starting_weight, is_initial_load
- **PlannedExerciseSwap**: id, plan_id, day_index, sequence, previous_exercise_id, new_exercise_id, swapped_at

**MVP note:** Plan generation writes concrete rows directly into `PlannedExercise`. Template entities are placeholders for a future "save session as template" feature rather than part of the current generation pipeline.

## Main user flows
- Log a workout session, record sets, and review history per exercise.
- Get next-session progression recommendations for each exercise based on last best sets and recent volume trends.
- Complete a short Q&A to generate a multi-week plan and save it to the calendar.
- Edit a plan day, swap exercises, and persist changes for future sessions.
- Review swap options immediately after plan generation and apply replacements as needed.

## API surface (endpoints or functions)
- `POST /workouts/sessions` create session with set logs
- `GET /workouts/sessions?user_id&date_range` list sessions
- `GET /exercises/{id}/history?user_id` return recent set logs and bests
- `POST /progression/recommendations` generate recommendations for a session or exercise
- `GET /progression/recommendations?user_id&exercise_id` fetch latest recommendation
- `POST /progression/form-alerts` create a manual form alert that triggers a one-time 10% deload for the next session
- `POST /questionnaire` submit Q&A, requires snake_case fields and equipment_available, stores smallest_increment
- `POST /plans/generate` create plan from questionnaire
- `GET /plans/{id}` view plan
- `PATCH /plans/{id}` update plan metadata
- `PATCH /plans/{id}/workouts/{day_index}` swap or edit plan workout
- `GET /plans/{id}/swap-options?day_index&sequence` fetch eligible exercise swaps
- `PATCH /plans/{id}/swap` apply a swap to a planned exercise

## Plan swap eligibility rules
- Swap candidates must share the same movement_pattern as the original planned exercise.
- Exercises must be allowed by the user’s questionnaire equipment_available mapping.
- Experience rules mirror plan generation:
  - Beginner: offer compound movements if any exist for the pattern; otherwise allow accessories.
  - Intermediate/Advanced: offer compound then accessory movements for the pattern.
- Excluded patterns from the questionnaire (comma-separated) remove all candidates for that pattern.
- injuries_constraints are stored as free text and are not yet used for swap filtering.

## Rules-based vs engine
- **Rules-based**: simple progression deltas (e.g., +2.5–5% weight if all target reps hit), deload triggers based on missed reps, template selection by equipment availability.
- **Needs an “engine”**: multi-week periodization, balancing weekly volume across muscle groups, accommodating injuries/constraints with exercise substitutions while preserving stimulus, and resolving schedule changes across the plan.
