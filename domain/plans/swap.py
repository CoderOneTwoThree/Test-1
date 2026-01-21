from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from db.connection import get_db_connection
from domain.plans.generator import EQUIPMENT_ALLOWED
from domain.progression.engine import EQUIPMENT_DEFAULTS
from domain.validation.progression import round_down_to_increment
from queries.plans import (
    ExerciseRow,
    fetch_exercise_pool,
    fetch_latest_performance,
    fetch_plan_context,
    fetch_planned_exercise_detail,
    fetch_questionnaire_response,
    fetch_user_smallest_increment,
    insert_planned_exercise_swap,
    update_planned_exercise,
)


@dataclass(frozen=True)
class SwapOption:
    id: int
    name: str
    movement_pattern: str
    category: str
    equipment_id: str
    primary_muscle: str


def _parse_excluded_patterns(value: str | None) -> set[str]:
    if not value:
        return set()
    return {pattern.strip().lower() for pattern in value.split(",") if pattern.strip()}


def _eligible_by_experience(
    pool: list[ExerciseRow], experience_level: str
) -> list[ExerciseRow]:
    compound = [exercise for exercise in pool if exercise.category.strip().lower() == "compound"]
    accessory = [exercise for exercise in pool if exercise.category.strip().lower() == "accessory"]
    if experience_level == "beginner":
        return compound or accessory
    if experience_level in {"intermediate", "advanced"}:
        return compound + accessory if compound else accessory
    raise ValueError("UNKNOWN_EXPERIENCE_LEVEL")


def _resolve_starting_weight(
    exercise: ExerciseRow, latest_weight: float | None, smallest_increment: float
) -> float | None:
    if latest_weight is not None:
        return latest_weight
    equipment_key = exercise.equipment_id.strip().lower()
    base_weight = EQUIPMENT_DEFAULTS.get(equipment_key, smallest_increment)
    return round_down_to_increment(base_weight, smallest_increment)


def list_swap_options(
    db_path: str, plan_id: int, day_index: int, sequence: int
) -> list[SwapOption]:
    db = get_db_connection(db_path)
    try:
        planned = fetch_planned_exercise_detail(db, plan_id, day_index, sequence)
        context = fetch_plan_context(db, plan_id)
        questionnaire = fetch_questionnaire_response(db, context["questionnaire_id"])
        excluded_patterns = _parse_excluded_patterns(questionnaire["excluded_patterns"])
        if planned.movement_pattern.strip().lower() in excluded_patterns:
            return []
        equipment_ids = EQUIPMENT_ALLOWED.get(questionnaire["equipment_available"])
        if equipment_ids is None:
            raise ValueError("UNKNOWN_EQUIPMENT")
        pool = fetch_exercise_pool(
            db, [planned.movement_pattern], list(equipment_ids)
        )
        eligible = _eligible_by_experience(pool, questionnaire["experience_level"])
        options = [
            SwapOption(
                id=exercise.id,
                name=exercise.name,
                movement_pattern=exercise.movement_pattern,
                category=exercise.category,
                equipment_id=exercise.equipment_id,
                primary_muscle=exercise.primary_muscle,
            )
            for exercise in eligible
            if exercise.id != planned.exercise_id
        ]
        return options
    finally:
        db.close()


def apply_swap(
    db_path: str,
    plan_id: int,
    day_index: int,
    sequence: int,
    new_exercise_id: int,
) -> None:
    db = get_db_connection(db_path)
    try:
        planned = fetch_planned_exercise_detail(db, plan_id, day_index, sequence)
        context = fetch_plan_context(db, plan_id)
        questionnaire = fetch_questionnaire_response(db, context["questionnaire_id"])
        excluded_patterns = _parse_excluded_patterns(questionnaire["excluded_patterns"])
        if planned.movement_pattern.strip().lower() in excluded_patterns:
            raise ValueError("EXCLUDED_PATTERN")
        equipment_ids = EQUIPMENT_ALLOWED.get(questionnaire["equipment_available"])
        if equipment_ids is None:
            raise ValueError("UNKNOWN_EQUIPMENT")
        pool = fetch_exercise_pool(
            db, [planned.movement_pattern], list(equipment_ids)
        )
        eligible = _eligible_by_experience(pool, questionnaire["experience_level"])
        replacement = next(
            (exercise for exercise in eligible if exercise.id == new_exercise_id), None
        )
        if replacement is None:
            raise ValueError("INVALID_SWAP_EXERCISE")
        smallest_increment = fetch_user_smallest_increment(db, context["user_id"])
        latest_weight = fetch_latest_performance(
            db, context["user_id"], replacement.id
        )
        starting_weight = _resolve_starting_weight(
            replacement, latest_weight, smallest_increment
        )
        is_initial_load = latest_weight is None
        with db:
            update_planned_exercise(
                db,
                plan_id=plan_id,
                day_index=day_index,
                sequence=sequence,
                exercise_id=replacement.id,
                starting_weight=starting_weight,
                is_initial_load=is_initial_load,
            )
            insert_planned_exercise_swap(
                db,
                plan_id=plan_id,
                day_index=day_index,
                sequence=sequence,
                previous_exercise_id=planned.exercise_id,
                new_exercise_id=replacement.id,
            )
    finally:
        db.close()
