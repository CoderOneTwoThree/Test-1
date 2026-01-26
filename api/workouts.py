from typing import Any

from db.connection import DbConnection, get_db_connection
from domain.workouts.logging import SessionInput, SetLogInput, validate_session


def _fetch_exercise_categories(
    db: DbConnection, exercise_ids: set[int]
) -> dict[int, str]:
    if not exercise_ids:
        return {}
    placeholders = ",".join("?" for _ in exercise_ids)
    cursor = db.execute(
        f"SELECT id, category FROM exercises WHERE id IN ({placeholders})",
        tuple(exercise_ids),
    )
    rows = cursor.fetchall()
    categories = {row[0]: row[1] for row in rows}
    missing = exercise_ids - categories.keys()
    if missing:
        raise ValueError("INVALID_EXERCISE_ID")
    return categories


def create_session(db_path: str, payload: dict[str, Any]) -> int:
    db = get_db_connection(db_path)
    plan_id = payload.get("plan_id")
    day_index = payload.get("day_index")
    try:
        plan_id = int(plan_id) if plan_id is not None else None
        day_index = int(day_index) if day_index is not None else None
    except (TypeError, ValueError):
        plan_id = None
        day_index = None
    session = SessionInput(
        user_id=payload["user_id"],
        performed_at=payload["performed_at"],
        duration_minutes=payload.get("duration_minutes"),
        notes=payload.get("notes"),
        completion_status=payload["completion_status"],
        template_id=payload.get("template_id"),
        manual_audit_flag=payload.get("manual_audit_flag", False),
    )
    set_logs = [
        SetLogInput(
            exercise_id=entry["exercise_id"],
            set_number=entry["set_number"],
            reps=entry["reps"],
            weight=entry["weight"],
            rpe=entry["rpe"],
            rest_seconds=entry["rest_seconds"],
            is_initial_load=entry.get("is_initial_load", False),
        )
        for entry in payload["set_logs"]
    ]
    exercise_ids = {set_log.exercise_id for set_log in set_logs}
    categories = _fetch_exercise_categories(db, exercise_ids)
    bodyweight_exercise_ids = {
        exercise_id
        for exercise_id, category in categories.items()
        if category.lower() == "bodyweight"
    }
    validate_session(session, set_logs, bodyweight_exercise_ids)

    try:
        with db:
            cursor = db.execute(
                """
                INSERT INTO workout_sessions
                    (user_id, template_id, performed_at, duration_minutes, notes, completion_status, manual_audit_flag)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.user_id,
                    session.template_id,
                    session.performed_at,
                    session.duration_minutes,
                    session.notes,
                    session.completion_status,
                    1 if session.manual_audit_flag else 0,
                ),
            )
            session_id = cursor.lastrowid
            if plan_id is not None and day_index is not None:
                db.execute(
                    """
                    INSERT INTO workout_session_plans
                        (session_id, plan_id, day_index)
                    VALUES (?, ?, ?)
                    """,
                    (
                        session_id,
                        plan_id,
                        day_index,
                    ),
                )
            db.executemany(
                """
                INSERT INTO set_logs
                    (session_id, exercise_id, set_number, reps, weight, rpe, rest_seconds, is_initial_load)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        session_id,
                        set_log.exercise_id,
                        set_log.set_number,
                        set_log.reps,
                        set_log.weight,
                        set_log.rpe,
                        set_log.rest_seconds,
                        1 if set_log.is_initial_load else 0,
                    )
                    for set_log in set_logs
                ],
            )
    finally:
        db.close()

    return int(session_id)
