from dataclasses import dataclass
from datetime import date
from typing import Any, Iterable

from db.connection import DbConnection, get_db_connection


@dataclass(frozen=True)
class ExerciseRow:
    id: int
    name: str
    movement_pattern: str
    category: str
    equipment_id: str
    primary_muscle: str


@dataclass(frozen=True)
class PlannedExerciseRow:
    day_index: int
    session_type: str
    sequence: int
    exercise_id: int
    target_sets: int
    target_reps_min: int
    target_reps_max: int
    starting_weight: float | None
    is_initial_load: bool


@dataclass(frozen=True)
class PlannedExerciseDetail:
    plan_id: int
    day_index: int
    sequence: int
    exercise_id: int
    session_type: str
    target_sets: int
    target_reps_min: int
    target_reps_max: int
    starting_weight: float | None
    is_initial_load: bool
    movement_pattern: str
    category: str
    equipment_id: str
    primary_muscle: str


def fetch_questionnaire_response(db: DbConnection, questionnaire_id: int) -> dict[str, Any]:
    cursor = db.execute(
        """
        SELECT id, user_id, goals, experience_level, schedule_days, equipment_available,
               injuries_constraints, excluded_patterns
        FROM questionnaire_responses
        WHERE id = ?
        """,
        (questionnaire_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise ValueError("QUESTIONNAIRE_NOT_FOUND")
    return {
        "id": row[0],
        "user_id": row[1],
        "goals": row[2],
        "experience_level": row[3],
        "schedule_days": row[4],
        "equipment_available": row[5],
        "injuries_constraints": row[6],
        "excluded_patterns": row[7],
    }


def fetch_exercise_pool(
    db: DbConnection,
    movement_patterns: Iterable[str],
    equipment_ids: Iterable[str],
) -> list[ExerciseRow]:
    patterns = list(dict.fromkeys(movement_patterns))
    equipment = list(dict.fromkeys(equipment_ids))
    if not patterns or not equipment:
        return []
    pattern_placeholders = ",".join("?" for _ in patterns)
    equipment_placeholders = ",".join("?" for _ in equipment)
    cursor = db.execute(
        f"""
        SELECT id, name, movement_pattern, category, equipment_id, primary_muscle
        FROM exercises
        WHERE movement_pattern IN ({pattern_placeholders})
          AND equipment_id IN ({equipment_placeholders})
        ORDER BY name ASC
        """,
        (*patterns, *equipment),
    )
    return [
        ExerciseRow(
            id=row[0],
            name=row[1],
            movement_pattern=row[2],
            category=row[3],
            equipment_id=row[4],
            primary_muscle=row[5],
        )
        for row in cursor.fetchall()
    ]


def fetch_plan_context(db: DbConnection, plan_id: int) -> dict[str, Any]:
    cursor = db.execute(
        """
        SELECT user_id, generated_from_questionnaire_id
        FROM plans
        WHERE id = ?
        """,
        (plan_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise ValueError("PLAN_NOT_FOUND")
    return {"user_id": row[0], "questionnaire_id": row[1]}


def fetch_planned_exercise_detail(
    db: DbConnection, plan_id: int, day_index: int, sequence: int
) -> PlannedExerciseDetail:
    cursor = db.execute(
        """
        SELECT pe.plan_id,
               pe.day_index,
               pe.sequence,
               pe.exercise_id,
               pe.session_type,
               pe.target_sets,
               pe.target_reps_min,
               pe.target_reps_max,
               pe.starting_weight,
               pe.is_initial_load,
               ex.movement_pattern,
               ex.category,
               ex.equipment_id,
               ex.primary_muscle
        FROM planned_exercises pe
        JOIN exercises ex ON ex.id = pe.exercise_id
        WHERE pe.plan_id = ?
          AND pe.day_index = ?
          AND pe.sequence = ?
        """,
        (plan_id, day_index, sequence),
    )
    row = cursor.fetchone()
    if row is None:
        raise ValueError("PLANNED_EXERCISE_NOT_FOUND")
    return PlannedExerciseDetail(
        plan_id=row[0],
        day_index=row[1],
        sequence=row[2],
        exercise_id=row[3],
        session_type=row[4],
        target_sets=row[5],
        target_reps_min=row[6],
        target_reps_max=row[7],
        starting_weight=float(row[8]) if row[8] is not None else None,
        is_initial_load=bool(row[9]),
        movement_pattern=row[10],
        category=row[11],
        equipment_id=row[12],
        primary_muscle=row[13],
    )


def fetch_latest_performance(
    db: DbConnection, user_id: int, exercise_id: int
) -> float | None:
    cursor = db.execute(
        """
        SELECT sl.weight
        FROM set_logs sl
        JOIN workout_sessions ws ON ws.id = sl.session_id
        WHERE ws.user_id = ?
          AND sl.exercise_id = ?
          AND ws.completion_status != 'skipped'
          AND sl.weight IS NOT NULL
        ORDER BY ws.performed_at DESC, sl.set_number ASC
        LIMIT 1
        """,
        (user_id, exercise_id),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    return float(row[0]) if row[0] is not None else None


def fetch_user_smallest_increment(db: DbConnection, user_id: int) -> float:
    cursor = db.execute("SELECT smallest_increment FROM users WHERE id = ?", (user_id,))
    row = cursor.fetchone()
    if row is None:
        raise ValueError("INVALID_USER_ID")
    return float(row[0])


def create_workout_plan(
    db_path: str,
    user_id: int,
    name: str,
    start_date: date,
    weeks: int,
    questionnaire_id: int,
    planned_exercises: Iterable[PlannedExerciseRow],
) -> int:
    db = get_db_connection(db_path)
    try:
        with db:
            cursor = db.execute(
                """
                INSERT INTO plans
                    (user_id, name, start_date, weeks, generated_from_questionnaire_id)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    name,
                    start_date.isoformat(),
                    weeks,
                    questionnaire_id,
                ),
            )
            plan_id = int(cursor.lastrowid)
            unique_days = sorted({exercise.day_index for exercise in planned_exercises})
            db.executemany(
                """
                INSERT INTO plan_workouts
                    (plan_id, day_index, template_id)
                VALUES (?, ?, NULL)
                """,
                [
                    (
                        plan_id,
                        day_index,
                    )
                    for day_index in unique_days
                ],
            )
            db.executemany(
                """
                INSERT INTO planned_exercises
                    (plan_id, day_index, session_type, sequence, exercise_id,
                     target_sets, target_reps_min, target_reps_max, starting_weight, is_initial_load)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        plan_id,
                        exercise.day_index,
                        exercise.session_type,
                        exercise.sequence,
                        exercise.exercise_id,
                        exercise.target_sets,
                        exercise.target_reps_min,
                        exercise.target_reps_max,
                        exercise.starting_weight,
                        1 if exercise.is_initial_load else 0,
                    )
                    for exercise in planned_exercises
                ],
            )
    finally:
        db.close()
    return plan_id


def update_planned_exercise(
    db: DbConnection,
    plan_id: int,
    day_index: int,
    sequence: int,
    exercise_id: int,
    starting_weight: float | None,
    is_initial_load: bool,
) -> None:
    db.execute(
        """
        UPDATE planned_exercises
        SET exercise_id = ?,
            starting_weight = ?,
            is_initial_load = ?
        WHERE plan_id = ?
          AND day_index = ?
          AND sequence = ?
        """,
        (
            exercise_id,
            starting_weight,
            1 if is_initial_load else 0,
            plan_id,
            day_index,
            sequence,
        ),
    )


def insert_planned_exercise_swap(
    db: DbConnection,
    plan_id: int,
    day_index: int,
    sequence: int,
    previous_exercise_id: int,
    new_exercise_id: int,
) -> None:
    db.execute(
        """
        INSERT INTO planned_exercise_swaps
            (plan_id, day_index, sequence, previous_exercise_id, new_exercise_id)
        VALUES (?, ?, ?, ?, ?)
        """,
        (plan_id, day_index, sequence, previous_exercise_id, new_exercise_id),
    )
