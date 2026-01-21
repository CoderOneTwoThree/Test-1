import re
from typing import Any

from db.connection import get_db_connection

SNAKE_CASE_PATTERN = re.compile(r"^[a-z]+(_[a-z]+)*$")
REQUIRED_FIELDS = {
    "user_id",
    "goals",
    "experience_level",
    "schedule_days",
    "equipment_available",
    "smallest_increment",
}


def _ensure_snake_case(value: str, field: str) -> None:
    if not SNAKE_CASE_PATTERN.match(value):
        raise ValueError(f"{field} must be snake_case")


def _validate_payload(payload: dict[str, Any]) -> None:
    missing = REQUIRED_FIELDS - payload.keys()
    if "equipment_available" in missing:
        raise ValueError("EQUIPMENT_REQUIRED")
    if missing:
        raise ValueError(f"missing fields: {', '.join(sorted(missing))}")
    _ensure_snake_case(payload["goals"], "goals")
    _ensure_snake_case(payload["experience_level"], "experience_level")
    _ensure_snake_case(payload["equipment_available"], "equipment_available")
    if payload["user_id"] <= 0:
        raise ValueError("user_id must be positive")
    if payload["schedule_days"] <= 0:
        raise ValueError("schedule_days must be positive")
    if payload["smallest_increment"] <= 0:
        raise ValueError("smallest_increment must be positive")


def create_questionnaire(db_path: str, payload: dict[str, Any]) -> int:
    _validate_payload(payload)
    db = get_db_connection(db_path)
    try:
        with db:
            db.execute(
                "UPDATE users SET smallest_increment = ? WHERE id = ?",
                (payload["smallest_increment"], payload["user_id"]),
            )
            cursor = db.execute(
                """
                INSERT INTO questionnaire_responses
                    (user_id, goals, experience_level, schedule_days, equipment_available,
                     injuries_constraints, excluded_patterns)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload["user_id"],
                    payload["goals"],
                    payload["experience_level"],
                    payload["schedule_days"],
                    payload["equipment_available"],
                    payload.get("injuries_constraints"),
                    payload.get("excluded_patterns"),
                ),
            )
            response_id = cursor.lastrowid
    finally:
        db.close()

    return int(response_id)
