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
        "horizontal pull",
        "horizontal push",
        "squat",
        "hinge",
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

ACCESSORY_MUSCLES_BY_SESSION = {
    "push": {"chest", "shoulders", "triceps"},
    "pull": {"back", "lats", "biceps", "grip"},
    "legs": {"quadriceps", "hamstrings", "glutes", "calves", "adductors", "hip flexors"},
    "upper": {"chest", "shoulders", "triceps", "back", "lats", "biceps"},
    "lower": {"quadriceps", "hamstrings", "glutes", "calves", "adductors", "hip flexors"},
    "full_body": {
        "chest",
        "shoulders",
        "triceps",
        "back",
        "lats",
        "biceps",
        "quadriceps",
        "hamstrings",
        "glutes",
        "calves",
        "adductors",
        "hip flexors",
        "core",
        "abs",
        "obliques",
    },
}

FOCUS_AREA_MUSCLES = {
    "arms": {"biceps", "triceps"},
    "shoulders": {"shoulders"},
    "chest": {"chest"},
    "back": {"back", "lats"},
    "legs": {"quadriceps", "hamstrings", "glutes", "calves", "adductors", "hip flexors"},
    "core": {"core", "abs", "obliques"},
}


@dataclass(frozen=True)
class PlanDay:
    day_index: int
    session_type: str
    patterns: list[str]
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
            weekly_frequency = questionnaire["schedule_days"]
            training_days = self._resolve_training_days(
                weekly_frequency, questionnaire.get("training_days_of_week")
            )
            split = self._select_split(
                questionnaire["goals"],
                weekly_frequency,
            )
            week_structure = self._build_week_structure(
                split, weekly_frequency, questionnaire.get("split_variant")
            )
            equipment_ids = self._equipment_ids_for(
                questionnaire["equipment_available"]
            )
            exercise_pool = fetch_exercise_pool(
                db, self._unique_patterns(week_structure), equipment_ids
            )
            exercises_by_pattern = self._group_by_pattern(exercise_pool)
            plan_days = self._build_plan_days(
                training_days,
                week_structure,
                exercises_by_pattern,
                questionnaire["experience_level"],
                questionnaire.get("session_duration_minutes"),
                questionnaire.get("focus_areas") or [],
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
            if weekly_frequency == 4:
                return "upper_lower"
            return "push_pull_legs"
        if goal == "weight_loss":
            if weekly_frequency <= 3:
                return "full_body"
            if weekly_frequency == 4:
                return "upper_lower"
            return "push_pull_legs"
        raise ValueError("UNKNOWN_GOAL")

    def _build_week_structure(
        self,
        split: str,
        weekly_frequency: int,
        split_variant: str | None = None,
    ) -> list[str]:
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
            return self._build_five_day_split(split, split_variant)
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
        if "accessory" not in patterns:
            patterns.append("accessory")
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
        day_indices: list[int],
        week_structure: list[str],
        exercises_by_pattern: dict[str, list[ExerciseRow]],
        experience_level: str,
        session_duration_minutes: int | None,
        focus_areas: list[str],
    ) -> list[PlanDay]:
        plan_days: list[PlanDay] = []
        for day_index, session_type in zip(day_indices, week_structure, strict=True):
            patterns = self._select_patterns_for_session(
                session_type,
                session_duration_minutes,
                experience_level,
            )
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
            accessories = self._select_accessories(
                selected_exercises,
                exercises_by_pattern.get("accessory", []),
                session_type,
                session_duration_minutes,
                experience_level,
                focus_areas,
            )
            selected_exercises.extend(accessories)
            plan_days.append(
                PlanDay(
                    day_index=day_index,
                    session_type=session_type,
                    patterns=patterns,
                    exercises=selected_exercises,
                )
            )
        return plan_days

    def _select_patterns_for_session(
        self,
        session_type: str,
        session_duration_minutes: int | None,
        experience_level: str,
    ) -> list[str]:
        patterns = SESSION_PATTERNS.get(session_type, [])
        budget = self._session_exercise_budget(
            session_duration_minutes, experience_level
        )
        if not patterns:
            return []
        if budget >= len(patterns):
            return list(patterns)
        return list(patterns)[:budget]

    def _session_exercise_budget(
        self, session_duration_minutes: int | None, experience_level: str
    ) -> int:
        if session_duration_minutes is None:
            if experience_level == "beginner":
                return 4
            if experience_level == "intermediate":
                return 5
            return 6
        if session_duration_minutes <= 30:
            return 3
        if session_duration_minutes <= 45:
            return 4
        if session_duration_minutes <= 60:
            return 5
        if session_duration_minutes <= 75:
            return 6
        return 7

    def _select_accessories(
        self,
        selected_exercises: list[ExerciseRow],
        accessory_pool: list[ExerciseRow],
        session_type: str,
        session_duration_minutes: int | None,
        experience_level: str,
        focus_areas: list[str],
    ) -> list[ExerciseRow]:
        if not accessory_pool:
            return []
        budget = self._session_exercise_budget(
            session_duration_minutes, experience_level
        )
        slots = budget - len(selected_exercises)
        if slots <= 0:
            return []
        if experience_level == "beginner":
            slots = min(slots, 1)
        elif experience_level == "intermediate":
            slots = min(slots, 2)
        else:
            slots = min(slots, 3)

        selected_ids = {exercise.id for exercise in selected_exercises}
        focus_muscles = self._focus_muscle_set(focus_areas)
        session_muscles = ACCESSORY_MUSCLES_BY_SESSION.get(session_type, set())
        primary_targets = focus_muscles or session_muscles

        candidates = [
            exercise
            for exercise in accessory_pool
            if exercise.id not in selected_ids
            and self._targets_muscles(exercise, primary_targets)
        ]
        if focus_muscles:
            fallback = [
                exercise
                for exercise in accessory_pool
                if exercise.id not in selected_ids
                and exercise not in candidates
                and self._targets_muscles(exercise, session_muscles)
            ]
        else:
            fallback = []

        ordered = sorted(candidates + fallback, key=lambda entry: entry.name)
        return ordered[:slots]

    def _focus_muscle_set(self, focus_areas: list[str]) -> set[str]:
        muscles: set[str] = set()
        for area in focus_areas:
            muscles.update(FOCUS_AREA_MUSCLES.get(area, set()))
        return muscles

    def _targets_muscles(self, exercise: ExerciseRow, muscles: set[str]) -> bool:
        if not muscles:
            return False
        exercise_muscles = self._normalize_muscles(exercise.primary_muscle)
        return bool(muscles.intersection(exercise_muscles))

    def _build_five_day_split(
        self, split: str, split_variant: str | None
    ) -> list[str]:
        if split != "push_pull_legs":
            split = "push_pull_legs"
        if split_variant is None:
            split_variant = "ppl_upper_lower"
        if split_variant == "ppl_upper_lower":
            return ["push", "pull", "legs", "upper", "lower"]
        if split_variant == "ppl_push_pull":
            return ["push", "pull", "legs", "push", "pull"]
        raise ValueError("INVALID_SPLIT_VARIANT")

    def _resolve_training_days(
        self, weekly_frequency: int, training_days_of_week: list[int] | None
    ) -> list[int]:
        if weekly_frequency > 7:
            raise ValueError("WEEKLY_FREQUENCY_TOO_HIGH")
        if training_days_of_week is None:
            training_days = self._default_training_days(weekly_frequency)
        else:
            training_days = sorted(training_days_of_week)
            if len(training_days) != weekly_frequency:
                raise ValueError("TRAINING_DAY_COUNT_MISMATCH")
        self._validate_training_day_spacing(training_days, weekly_frequency)
        return training_days

    def _default_training_days(self, weekly_frequency: int) -> list[int]:
        defaults = {
            1: [0],
            2: [0, 3],
            3: [0, 2, 4],
            4: [0, 2, 4, 6],
            5: [0, 2, 3, 5, 6],
            6: [0, 1, 2, 4, 5, 6],
            7: [0, 1, 2, 3, 4, 5, 6],
        }
        return defaults.get(weekly_frequency, list(range(weekly_frequency)))

    def _validate_training_day_spacing(
        self, training_days: list[int], weekly_frequency: int
    ) -> None:
        if not training_days:
            raise ValueError("TRAINING_DAYS_REQUIRED")
        if any(day < 0 or day > 6 for day in training_days):
            raise ValueError("TRAINING_DAYS_OUT_OF_RANGE")
        if len(set(training_days)) != len(training_days):
            raise ValueError("TRAINING_DAYS_DUPLICATE")
        if weekly_frequency >= 6:
            return
        max_consecutive = self._max_consecutive_training_days(training_days)
        if max_consecutive > 2:
            raise ValueError("TRAINING_DAYS_TOO_CONSECUTIVE")

    def _max_consecutive_training_days(self, training_days: list[int]) -> int:
        training_set = set(training_days)
        consecutive = 0
        max_consecutive = 0
        for day in range(14):
            if day % 7 in training_set:
                consecutive += 1
                max_consecutive = max(max_consecutive, consecutive)
            else:
                consecutive = 0
        return max_consecutive

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
            patterns = day.patterns
            if len(patterns) > len(day.exercises):
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
            for exercise in day.exercises[len(patterns) :]:
                if exercise.equipment_id not in allowed_equipment_ids:
                    raise ValueError("PLAN_EQUIPMENT_MISMATCH")
                if exercise.category.strip().lower() != "accessory":
                    raise ValueError("PLAN_ACCESSORY_MISMATCH")

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
