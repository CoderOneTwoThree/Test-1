from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Iterable

from db.connection import get_db_connection
from domain.progression.engine import EQUIPMENT_DEFAULTS
from domain.validation.progression import round_down_to_increment
from queries.plans import (
    ExerciseRow,
    PlannedExerciseRow,
    create_workout_plan,
    fetch_exercise_pool,
    fetch_latest_performance,
    fetch_questionnaire_response,
    fetch_user_smallest_increment,
)


TARGET_SETS = 3
TARGET_REPS_RANGE = (6, 12)
MAX_BEGINNER_ACCESSORY_PER_SESSION = 2

EQUIPMENT_ALLOWED = {
    "none": {"bodyweight", "band"},
    "dumbbells_only": {"bodyweight", "band", "dumbbell"},
    "home_gym": {"bodyweight", "band", "dumbbell", "barbell"},
    "full_gym": {"bodyweight", "band", "dumbbell", "barbell", "cable", "machine"},
}

SESSION_PATTERNS = {
    "full_body": [
        "squat",
        "hinge",
        "horizontal push",
        "horizontal pull",
        "vertical push",
        "vertical pull",
        "core",
    ],
    "upper": [
        "horizontal push",
        "horizontal pull",
        "vertical push",
        "vertical pull",
        "core",
    ],
    "lower": ["squat", "hinge", "single-leg", "core"],
    "push": ["horizontal push", "vertical push", "core"],
    "pull": ["horizontal pull", "vertical pull", "core"],
    "legs": ["squat", "hinge", "single-leg", "core"],
}


@dataclass(frozen=True)
class PlanDay:
    day_index: int
    session_type: str
    exercises: list[ExerciseRow]


class PlanGenerator:
    """Generate a workout plan from questionnaire inputs.

    SQL mapping (selection logic):
    - questionnaire: fetch_questionnaire_response
    - exercise pool: fetch_exercise_pool (pattern + equipment_id filter)
    - starting load: fetch_latest_performance
    - persistence: create_workout_plan
    """

    def generate(
        self,
        db_path: str,
        questionnaire_id: int,
        start_date: date | None = None,
        weeks: int = 4,
        name: str = "Generated Plan",
    ) -> int:
        plan_start = start_date or date.today()
        db = get_db_connection(db_path)
        try:
            questionnaire = fetch_questionnaire_response(db, questionnaire_id)
            smallest_increment = fetch_user_smallest_increment(
                db, questionnaire["user_id"]
            )
            split = self._select_split(
                questionnaire["goals"],
                questionnaire["schedule_days"],
            )
            week_structure = self._build_week_structure(
                split, questionnaire["schedule_days"]
            )
            equipment_ids = self._equipment_ids_for(
                questionnaire["equipment_available"]
            )
            exercise_pool = fetch_exercise_pool(
                db, self._unique_patterns(week_structure), equipment_ids
            )
            exercises_by_pattern = self._group_by_pattern(exercise_pool)
            plan_days = self._build_plan_days(
                week_structure,
                exercises_by_pattern,
                questionnaire["experience_level"],
            )
            self._audit_plan(
                plan_days,
                equipment_ids,
                questionnaire["experience_level"],
            )
            planned_exercises = self._build_planned_exercises(
                db,
                questionnaire["user_id"],
                plan_days,
                smallest_increment,
            )
        finally:
            db.close()

        return create_workout_plan(
            db_path=db_path,
            user_id=questionnaire["user_id"],
            name=name,
            start_date=plan_start,
            weeks=weeks,
            questionnaire_id=questionnaire_id,
            planned_exercises=planned_exercises,
        )

    def _select_split(self, goal: str, weekly_frequency: int) -> str:
        if goal == "general_fitness":
            if weekly_frequency <= 3:
                return "full_body"
            if weekly_frequency == 4:
                return "upper_lower"
            return "push_pull_legs"
        if goal == "muscle_gain":
            if weekly_frequency <= 2:
                return "full_body"
            if weekly_frequency in {3, 4}:
                return "upper_lower"
            return "push_pull_legs"
        if goal == "strength":
            if weekly_frequency <= 3:
                return "full_body"
            if weekly_frequency in {4, 5}:
                return "upper_lower"
            return "push_pull_legs"
        if goal == "weight_loss":
            if weekly_frequency <= 3:
                return "full_body"
            if weekly_frequency == 4:
                return "upper_lower"
            return "push_pull_legs"
        raise ValueError("UNKNOWN_GOAL")

    def _build_week_structure(self, split: str, weekly_frequency: int) -> list[str]:
        if weekly_frequency <= 0:
            raise ValueError("weekly_frequency must be positive")
        if weekly_frequency == 1:
            return ["full_body"]
        if weekly_frequency == 2:
            return ["full_body", "full_body"]
        if weekly_frequency == 3:
            if split == "upper_lower":
                return ["upper", "lower", "full_body"]
            return ["full_body", "full_body", "full_body"]
        if weekly_frequency == 4:
            return ["upper", "lower", "upper", "lower"]
        if weekly_frequency == 5:
            if split == "push_pull_legs":
                return ["push", "pull", "legs", "upper", "lower"]
            return ["upper", "lower", "upper", "lower", "upper"]
        if weekly_frequency == 6:
            return ["push", "pull", "legs", "push", "pull", "legs"]
        structure = ["push", "pull", "legs", "push", "pull", "legs", "full_body"]
        if weekly_frequency > len(structure):
            structure.extend(["full_body"] * (weekly_frequency - len(structure)))
        return structure[:weekly_frequency]

    def _equipment_ids_for(self, equipment_available: str) -> set[str]:
        allowed = EQUIPMENT_ALLOWED.get(equipment_available)
        if allowed is None:
            raise ValueError("UNKNOWN_EQUIPMENT")
        return allowed

    def _unique_patterns(self, week_structure: Iterable[str]) -> list[str]:
        patterns: list[str] = []
        for session_type in week_structure:
            for pattern in SESSION_PATTERNS.get(session_type, []):
                if pattern not in patterns:
                    patterns.append(pattern)
        return patterns

    def _group_by_pattern(
        self, exercise_pool: Iterable[ExerciseRow]
    ) -> dict[str, list[ExerciseRow]]:
        grouped: dict[str, list[ExerciseRow]] = {}
        for exercise in exercise_pool:
            key = exercise.movement_pattern.strip().lower()
            grouped.setdefault(key, []).append(exercise)
        for items in grouped.values():
            items.sort(key=lambda entry: entry.name)
        return grouped

    def _build_plan_days(
        self,
        week_structure: list[str],
        exercises_by_pattern: dict[str, list[ExerciseRow]],
        experience_level: str,
    ) -> list[PlanDay]:
        plan_days: list[PlanDay] = []
        for day_index, session_type in enumerate(week_structure):
            patterns = SESSION_PATTERNS.get(session_type, [])
            accessory_count: dict[str, int] = {}
            selected_exercises: list[ExerciseRow] = []
            for pattern_index, pattern in enumerate(patterns):
                pool = exercises_by_pattern.get(pattern, [])
                if not pool:
                    raise ValueError("MINIMUM_LIBRARY_REQUIREMENTS")
                selected = self._select_exercise_for_pattern(
                    pool,
                    day_index=day_index,
                    pattern_index=pattern_index,
                    experience_level=experience_level,
                )
                if experience_level == "beginner" and pattern != "core":
                    selected = self._apply_beginner_accessory_limit(
                        selected,
                        pool,
                        day_index,
                        pattern_index,
                        accessory_count,
                        experience_level,
                    )
                selected_exercises.append(selected)
            plan_days.append(
                PlanDay(
                    day_index=day_index,
                    session_type=session_type,
                    exercises=selected_exercises,
                )
            )
        return plan_days

    def _select_exercise_for_pattern(
        self,
        pool: list[ExerciseRow],
        day_index: int,
        pattern_index: int,
        experience_level: str,
    ) -> ExerciseRow:
        compound = [ex for ex in pool if ex.category.strip().lower() == "compound"]
        accessory = [ex for ex in pool if ex.category.strip().lower() == "accessory"]
        if experience_level == "beginner":
            candidates = compound or accessory
        elif experience_level in {"intermediate", "advanced"}:
            candidates = compound + accessory if compound else accessory
        else:
            raise ValueError("UNKNOWN_EXPERIENCE_LEVEL")
        if not candidates:
            raise ValueError("MINIMUM_LIBRARY_REQUIREMENTS")
        return candidates[0]

    def _apply_beginner_accessory_limit(
        self,
        selected: ExerciseRow,
        pool: list[ExerciseRow],
        day_index: int,
        pattern_index: int,
        accessory_count: dict[str, int],
        experience_level: str,
    ) -> ExerciseRow:
        if selected.category.strip().lower() != "accessory":
            return selected
        muscle_groups = self._normalize_muscles(selected.primary_muscle)
        if not muscle_groups:
            return selected
        if any(accessory_count.get(muscle, 0) >= MAX_BEGINNER_ACCESSORY_PER_SESSION for muscle in muscle_groups):
            compound_pool = [
                exercise
                for exercise in pool
                if exercise.category.strip().lower() == "compound"
            ]
            if not compound_pool:
                raise ValueError("MINIMUM_LIBRARY_REQUIREMENTS")
            return self._select_exercise_for_pattern(
                compound_pool,
                day_index=day_index,
                pattern_index=pattern_index,
                experience_level=experience_level,
            )
        for muscle in muscle_groups:
            accessory_count[muscle] = accessory_count.get(muscle, 0) + 1
        return selected

    def _normalize_muscles(self, muscles: str) -> list[str]:
        return [muscle.strip().lower() for muscle in muscles.split(",") if muscle.strip()]

    def _build_planned_exercises(
        self,
        db,
        user_id: int,
        plan_days: list[PlanDay],
        smallest_increment: float,
    ) -> list[PlannedExerciseRow]:
        planned_exercises: list[PlannedExerciseRow] = []
        for day in plan_days:
            for sequence, exercise in enumerate(day.exercises, start=1):
                latest_weight = fetch_latest_performance(db, user_id, exercise.id)
                starting_weight = self._resolve_starting_weight(
                    exercise, latest_weight, smallest_increment
                )
                is_initial_load = latest_weight is None
                planned_exercises.append(
                    PlannedExerciseRow(
                        day_index=day.day_index,
                        session_type=day.session_type,
                        sequence=sequence,
                        exercise_id=exercise.id,
                        target_sets=TARGET_SETS,
                        target_reps_min=TARGET_REPS_RANGE[0],
                        target_reps_max=TARGET_REPS_RANGE[1],
                        starting_weight=starting_weight,
                        is_initial_load=is_initial_load,
                    )
                )
        return planned_exercises

    def _audit_plan(
        self,
        plan_days: list[PlanDay],
        allowed_equipment_ids: set[str],
        experience_level: str,
    ) -> None:
        for day in plan_days:
            patterns = SESSION_PATTERNS.get(day.session_type, [])
            if len(patterns) != len(day.exercises):
                raise ValueError("PLAN_SELECTION_MISMATCH")
            accessory_count: dict[str, int] = {}
            for pattern, exercise in zip(patterns, day.exercises):
                if exercise.equipment_id not in allowed_equipment_ids:
                    raise ValueError("PLAN_EQUIPMENT_MISMATCH")
                if exercise.movement_pattern.strip().lower() != pattern:
                    raise ValueError("PLAN_PATTERN_MISMATCH")
                if experience_level == "beginner" and pattern != "core":
                    if exercise.category.strip().lower() == "accessory":
                        for muscle in self._normalize_muscles(exercise.primary_muscle):
                            accessory_count[muscle] = accessory_count.get(muscle, 0) + 1
            if experience_level == "beginner":
                if any(
                    count > MAX_BEGINNER_ACCESSORY_PER_SESSION
                    for count in accessory_count.values()
                ):
                    raise ValueError("PLAN_ACCESSORY_LIMIT")

    def _resolve_starting_weight(
        self,
        exercise: ExerciseRow,
        latest_weight: float | None,
        smallest_increment: float,
    ) -> float | None:
        if latest_weight is not None:
            return latest_weight
        equipment_key = exercise.equipment_id.strip().lower()
        base_weight = EQUIPMENT_DEFAULTS.get(equipment_key, smallest_increment)
        return round_down_to_increment(base_weight, smallest_increment)
