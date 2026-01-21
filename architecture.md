# Minimal workout app architecture

## Core data model
- **User**: id, email, created_at
- **Exercise**: id, name, primary_muscle, equipment, movement_pattern, category
- **WorkoutTemplate**: id, name, goal, difficulty, created_by_user_id
- **WorkoutTemplateExercise**: template_id, exercise_id, order, target_sets, target_reps, target_rpe_or_intensity
- **WorkoutSession**: id, user_id, template_id (nullable), performed_at, duration_minutes, notes
- **SetLog**: session_id, exercise_id, set_number, reps, weight, rpe, rest_seconds
- **ProgressionRecommendation**: user_id, exercise_id, basis (e.g., last_best, volume_trend), suggested_weight, suggested_reps, suggested_sets, created_at
- **QuestionnaireResponse**: user_id, answered_at, goals, experience_level, schedule_days, equipment_available, injuries_constraints, excluded_patterns
- **Plan**: id, user_id, name, start_date, weeks, generated_from_questionnaire_id
- **PlanWorkout**: plan_id, day_index, template_id

## Main user flows
- Log a workout session, record sets, and review history per exercise.
- Get next-session progression recommendations for each exercise based on last best sets and recent volume trends.
- Complete a short Q&A to generate a multi-week plan and save it to the calendar.
- Edit a plan day, swap exercises, and persist changes for future sessions.

## API surface (endpoints or functions)
- `POST /workouts/sessions` create session with set logs
- `GET /workouts/sessions?user_id&date_range` list sessions
- `GET /exercises/{id}/history?user_id` return recent set logs and bests
- `POST /progression/recommendations` generate recommendations for a session or exercise
- `GET /progression/recommendations?user_id&exercise_id` fetch latest recommendation
- `POST /questionnaire` submit Q&A
- `POST /plans/generate` create plan from questionnaire
- `GET /plans/{id}` view plan
- `PATCH /plans/{id}` update plan metadata
- `PATCH /plans/{id}/workouts/{day_index}` swap or edit plan workout

## Rules-based vs engine
- **Rules-based**: simple progression deltas (e.g., +2.5–5% weight if all target reps hit), deload triggers based on missed reps, template selection by equipment availability.
- **Needs an “engine”**: multi-week periodization, balancing weekly volume across muscle groups, accommodating injuries/constraints with exercise substitutions while preserving stimulus, and resolving schedule changes across the plan.
