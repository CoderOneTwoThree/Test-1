-- Core schema. Brutalist.
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    smallest_increment NUMERIC(6,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    primary_muscle TEXT NOT NULL,
    equipment TEXT NOT NULL,
    movement_pattern TEXT NOT NULL,
    category TEXT NOT NULL,
    equipment_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_sessions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    template_id INTEGER,
    performed_at TIMESTAMP NOT NULL,
    duration_minutes INTEGER,
    notes TEXT,
    completion_status TEXT NOT NULL,
    manual_audit_flag INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS set_logs (
    session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight NUMERIC(7,2),
    rpe NUMERIC(3,1),
    rest_seconds INTEGER,
    is_initial_load INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (session_id, exercise_id, set_number)
);

CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    answered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    goals TEXT NOT NULL,
    experience_level TEXT NOT NULL,
    schedule_days INTEGER NOT NULL,
    equipment_available TEXT NOT NULL,
    injuries_constraints TEXT,
    excluded_patterns TEXT,
    training_days_of_week TEXT,
    split_variant TEXT
);

CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    weeks INTEGER NOT NULL,
    generated_from_questionnaire_id INTEGER REFERENCES questionnaire_responses(id)
);

CREATE TABLE IF NOT EXISTS plan_workouts (
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    day_index INTEGER NOT NULL,
    template_id INTEGER,
    PRIMARY KEY (plan_id, day_index)
);

CREATE TABLE IF NOT EXISTS planned_exercises (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    day_index INTEGER NOT NULL,
    session_type TEXT NOT NULL,
    sequence INTEGER NOT NULL,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    target_sets INTEGER NOT NULL,
    target_reps_min INTEGER NOT NULL,
    target_reps_max INTEGER NOT NULL,
    starting_weight NUMERIC(7,2),
    is_initial_load INTEGER NOT NULL DEFAULT 0,
    UNIQUE (plan_id, day_index, sequence)
);

CREATE TABLE IF NOT EXISTS planned_exercise_swaps (
    id INTEGER PRIMARY KEY,
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    day_index INTEGER NOT NULL,
    sequence INTEGER NOT NULL,
    previous_exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    new_exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    swapped_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
