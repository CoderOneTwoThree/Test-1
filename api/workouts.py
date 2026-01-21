from typing import Any

from db.connection import DbConnection, get_db_connection
from domain.workouts.logging import SessionInput, SetLogInput, validate_session


def _ensure_exercise_ids(db: DbConnection, exercise_ids: set[int]) -> None:
    if not exercise_ids:
        return
    placeholders = ",".join("?" for _ in exercise_ids)
    cursor = db.execute(
        f"SELECT id FROM exercises WHERE id IN ({placeholders})",
        tuple(exercise_ids),
    )
    existing_ids = {row[0] for row in cursor.fetchall()}
    missing = exercise_ids - existing_ids
    if missing:
        raise ValueError("INVALID_EXERCISE_ID")


def create_session(db_path: str, payload: dict[str, Any]) -> int:
    db = get_db_connection(db_path)
    session = SessionInput(
        user_id=payload["user_id"],
        performed_at=payload["performed_at"],
        duration_minutes=payload.get("duration_minutes"),
        notes=payload.get("notes"),
        completion_status=payload["completion_status"],
        template_id=payload.get("template_id"),
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
    _ensure_exercise_ids(db, {set_log.exercise_id for set_log in set_logs})
    validate_session(session, set_logs)

    try:
        with db:
            cursor = db.execute(
                """
                INSERT INTO workout_sessions
                    (user_id, template_id, performed_at, duration_minutes, notes, completion_status)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    session.user_id,
                    session.template_id,
                    session.performed_at,
                    session.duration_minutes,
                    session.notes,
                    session.completion_status,
                ),
            )
            session_id = cursor.lastrowid
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
