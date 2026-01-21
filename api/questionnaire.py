import re
from typing import Any

from db.connection import get_db_connection

SNAKE_CASE_PATTERN = re.compile(r"^[a-z]+(_[a-z]+)*$")
REQUIRED_FIELDS = {
    "user_id",
    "goals",
    "experience_level",
    "equipment_available",
    "smallest_increment",
}
SPLIT_VARIANTS = {"ppl_upper_lower", "ppl_push_pull"}


def _ensure_snake_case(value: str, field: str) -> None:
    if not SNAKE_CASE_PATTERN.match(value):
        raise ValueError(f"{field} must be snake_case")


def _normalize_training_days(
    training_days: list[int] | None, schedule_days: int | None
) -> list[int] | None:
    if training_days is None:
        return None
    if not isinstance(training_days, list) or not training_days:
        raise ValueError("training_days_of_week must be a non-empty list")
    normalized: list[int] = []
    for day in training_days:
        if not isinstance(day, int):
            raise ValueError("training_days_of_week must contain integers")
        if day < 0 or day > 6:
            raise ValueError("training_days_of_week must be between 0 and 6")
        normalized.append(day)
    if len(set(normalized)) != len(normalized):
        raise ValueError("training_days_of_week must be unique")
    if schedule_days is not None and schedule_days != len(normalized):
        raise ValueError("training_days_of_week must match schedule_days")
    return sorted(normalized)


def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
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
    schedule_days = payload.get("schedule_days")
    if schedule_days is not None and schedule_days <= 0:
        raise ValueError("schedule_days must be positive")
    if schedule_days is not None and schedule_days > 7:
        raise ValueError("schedule_days must be 7 or fewer")
    if payload["smallest_increment"] <= 0:
        raise ValueError("smallest_increment must be positive")
    training_days = _normalize_training_days(
        payload.get("training_days_of_week"), schedule_days
    )
    if schedule_days is None:
        if training_days is None:
            raise ValueError("schedule_days is required when training_days_of_week is missing")
        schedule_days = len(training_days)
    if schedule_days > 7:
        raise ValueError("schedule_days must be 7 or fewer")
    split_variant = payload.get("split_variant")
    if split_variant is not None:
        _ensure_snake_case(split_variant, "split_variant")
        if split_variant not in SPLIT_VARIANTS:
            raise ValueError("split_variant must be ppl_upper_lower or ppl_push_pull")
    return {
        **payload,
        "schedule_days": schedule_days,
        "training_days_of_week": training_days,
        "split_variant": split_variant,
    }


def create_questionnaire(db_path: str, payload: dict[str, Any]) -> int:
    normalized = _normalize_payload(payload)
    db = get_db_connection(db_path)
    try:
        with db:
            db.execute(
                "UPDATE users SET smallest_increment = ? WHERE id = ?",
                (normalized["smallest_increment"], normalized["user_id"]),
            )
            cursor = db.execute(
                """
                INSERT INTO questionnaire_responses
                    (user_id, goals, experience_level, schedule_days, equipment_available,
                     injuries_constraints, excluded_patterns, training_days_of_week, split_variant)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    normalized["user_id"],
                    normalized["goals"],
                    normalized["experience_level"],
                    normalized["schedule_days"],
                    normalized["equipment_available"],
                    normalized.get("injuries_constraints"),
                    normalized.get("excluded_patterns"),
                    ",".join(str(day) for day in normalized["training_days_of_week"])
                    if normalized["training_days_of_week"]
                    else None,
                    normalized.get("split_variant"),
                ),
            )
            response_id = cursor.lastrowid
    finally:
        db.close()

    return int(response_id)
