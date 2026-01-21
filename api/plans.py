from datetime import date
from typing import Any

from domain.plans.generator import PlanGenerator
from domain.plans.swap import apply_swap, list_swap_options


def _parse_start_date(value: str | None) -> date | None:
    if value is None:
        return None
    return date.fromisoformat(value)


def generate_plan(db_path: str, payload: dict[str, Any]) -> int:
    if "questionnaire_id" not in payload:
        raise ValueError("questionnaire_id is required")
    questionnaire_id = payload["questionnaire_id"]
    if questionnaire_id <= 0:
        raise ValueError("questionnaire_id must be positive")
    weeks = payload.get("weeks", 4)
    if weeks <= 0:
        raise ValueError("weeks must be positive")
    start_date = _parse_start_date(payload.get("start_date"))
    name = payload.get("name", "Generated Plan")
    generator = PlanGenerator()
    return generator.generate(
        db_path=db_path,
        questionnaire_id=questionnaire_id,
        start_date=start_date,
        weeks=weeks,
        name=name,
    )


def get_swap_options(
    db_path: str, plan_id: int, day_index: int, sequence: int
) -> list[dict[str, Any]]:
    if plan_id <= 0:
        raise ValueError("plan_id must be positive")
    if day_index < 0:
        raise ValueError("day_index must be non-negative")
    if sequence <= 0:
        raise ValueError("sequence must be positive")
    options = list_swap_options(db_path, plan_id, day_index, sequence)
    return [
        {
            "id": option.id,
            "name": option.name,
            "movement_pattern": option.movement_pattern,
            "category": option.category,
            "equipment_id": option.equipment_id,
            "primary_muscle": option.primary_muscle,
        }
        for option in options
    ]


def swap_plan_exercise(db_path: str, payload: dict[str, Any]) -> None:
    required_fields = {"plan_id", "day_index", "sequence", "exercise_id"}
    missing = required_fields - payload.keys()
    if missing:
        raise ValueError(f"missing fields: {', '.join(sorted(missing))}")
    plan_id = payload["plan_id"]
    day_index = payload["day_index"]
    sequence = payload["sequence"]
    exercise_id = payload["exercise_id"]
    if plan_id <= 0:
        raise ValueError("plan_id must be positive")
    if day_index < 0:
        raise ValueError("day_index must be non-negative")
    if sequence <= 0:
        raise ValueError("sequence must be positive")
    if exercise_id <= 0:
        raise ValueError("exercise_id must be positive")
    apply_swap(
        db_path=db_path,
        plan_id=plan_id,
        day_index=day_index,
        sequence=sequence,
        new_exercise_id=exercise_id,
    )
