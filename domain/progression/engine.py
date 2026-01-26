from dataclasses import dataclass
from typing import Iterable

from domain.validation.progression import round_down_to_increment
from queries.exercise_history import fetch_exercise_history
from queries.progression import ExerciseMetadata, fetch_exercise_metadata, fetch_user_smallest_increment


REPS_MIN = 6
FIRST_SET_TARGET = 12
LAST_SET_TARGET = 10
POST_INCREASE_REP_RANGE = (6, 8)
DEFAULT_REP_RANGE = (6, 12)

LOWER_BODY_PATTERNS = {"squat", "hinge", "single-leg", "carry"}
LOWER_BODY_MUSCLES = {
    "quadriceps",
    "glutes",
    "hamstrings",
    "calves",
    "adductors",
    "abductors",
    "hip flexors",
}

EQUIPMENT_DEFAULTS = {
    "barbell": 45.0,
    "dumbbell": 10.0,
    "kettlebell": 8.0,
    "machine": 10.0,
    "cable": 10.0,
    "band": 5.0,
    "bodyweight": 0.0,
    "weighted vest": 10.0,
}


@dataclass(frozen=True)
class SessionPerformance:
    all_sets_completed: bool
    min_reps: int
    first_set_reps: int
    last_set_reps: int
    weight: float | None
    eligible: bool
    increase_achieved: bool
    missed_minimum: bool
    manual_audit_flag: bool


@dataclass(frozen=True)
class ProgressionState:
    last_session: SessionPerformance | None
    consecutive_misses: int
    has_prior_session: bool


@dataclass(frozen=True)
class ProgressionRecommendation:
    action: str
    next_weight: float | None
    rep_range: tuple[int, int]
    reason: str
    increase_amount: float | None = None
    deload_percentage: float | None = None


def _summarize_session(session: dict) -> SessionPerformance:
    sets = sorted(session.get("sets", []), key=lambda entry: entry.get("set_number", 0))
    reps = [entry["reps"] for entry in sets if entry.get("reps") is not None]
    weights = [entry["weight"] for entry in sets if entry.get("weight") is not None]
    if reps:
        min_reps = min(reps)
        first_set_reps = reps[0]
        last_set_reps = reps[-1]
    else:
        min_reps = 0
        first_set_reps = 0
        last_set_reps = 0

    first_set_weight = next(
        (entry.get("weight") for entry in sets if entry.get("set_number") == 1), None
    )
    weight = first_set_weight if first_set_weight is not None else (max(weights) if weights else None)
    all_sets_completed = session.get("completion_status") == "completed" and bool(sets)
    eligible = all_sets_completed and min_reps >= REPS_MIN
    increase_achieved = eligible and first_set_reps >= FIRST_SET_TARGET and last_set_reps >= LAST_SET_TARGET
    missed_minimum = not all_sets_completed or min_reps < REPS_MIN
    manual_audit_flag = bool(session.get("manual_audit_flag", False))

    return SessionPerformance(
        all_sets_completed=all_sets_completed,
        min_reps=min_reps,
        first_set_reps=first_set_reps,
        last_set_reps=last_set_reps,
        weight=weight,
        eligible=eligible,
        increase_achieved=increase_achieved,
        missed_minimum=missed_minimum,
        manual_audit_flag=manual_audit_flag,
    )


def _session_has_initial_load(session: dict) -> bool:
    return any(set_entry.get("is_initial_load", False) for set_entry in session.get("sets", []))


def _truncate_sessions_at_initial_load(session_list: list[dict]) -> list[dict]:
    for index, session in enumerate(session_list):
        if _session_has_initial_load(session):
            return session_list[: index + 1]
    return session_list


def evaluate_progression_state(sessions: Iterable[dict]) -> ProgressionState:
    session_list = list(sessions)
    if not session_list:
        return ProgressionState(last_session=None, consecutive_misses=0, has_prior_session=False)

    session_list = _truncate_sessions_at_initial_load(session_list)
    performances = [_summarize_session(session) for session in session_list]
    has_standard_session = any(
        any(not set_entry.get("is_initial_load", False) for set_entry in session.get("sets", []))
        for session in session_list
    )
    consecutive_misses = 0
    for session, performance in zip(session_list, performances):
        if _session_has_initial_load(session):
            break
        if performance.missed_minimum:
            consecutive_misses += 1
        else:
            break

    return ProgressionState(
        last_session=performances[0],
        consecutive_misses=consecutive_misses,
        has_prior_session=len(performances) >= 2 and has_standard_session,
    )


def _is_lower_body_exercise(metadata: ExerciseMetadata) -> bool:
    pattern = metadata.movement_pattern.strip().lower()
    if pattern in LOWER_BODY_PATTERNS:
        return True
    muscles = {muscle.strip().lower() for muscle in metadata.primary_muscle.split(",")}
    return bool(LOWER_BODY_MUSCLES.intersection(muscles))


def _select_raw_increase(metadata: ExerciseMetadata, smallest_increment: float) -> float:
    is_metric = smallest_increment <= 1.25
    if metadata.category.strip().lower() == "accessory":
        return 1.25 if is_metric else 2.5
    lower_body = _is_lower_body_exercise(metadata)
    if lower_body:
        return 2.5 if is_metric else 5.0
    return 1.25 if is_metric else 2.5


def _default_starting_weight(metadata: ExerciseMetadata, smallest_increment: float) -> float:
    equipment_key = metadata.equipment_id.strip().lower()
    base_weight = EQUIPMENT_DEFAULTS.get(equipment_key, smallest_increment)
    return round_down_to_increment(base_weight, smallest_increment)


def recommend_progression(
    history: dict,
    smallest_increment: float,
    metadata: ExerciseMetadata,
) -> ProgressionRecommendation:
    state = evaluate_progression_state(history.get("recent_sessions", []))
    last_session = state.last_session

    if last_session is None:
        return ProgressionRecommendation(
            action="start",
            next_weight=_default_starting_weight(metadata, smallest_increment),
            rep_range=DEFAULT_REP_RANGE,
            reason="No prior sessions for this lift; provide a conservative starting load.",
        )

    current_weight = last_session.weight
    if last_session.manual_audit_flag:
        deload_percentage = 0.10
        deload_weight = (
            round_down_to_increment(current_weight * (1 - deload_percentage), smallest_increment)
            if current_weight is not None
            else None
        )
        return ProgressionRecommendation(
            action="deload",
            next_weight=deload_weight,
            rep_range=DEFAULT_REP_RANGE,
            reason="Manual form audit flagged; trigger a one-time 10% deload.",
            deload_percentage=deload_percentage,
        )
    if state.consecutive_misses >= 3:
        deload_percentage = 0.10
        deload_weight = (
            round_down_to_increment(current_weight * (1 - deload_percentage), smallest_increment)
            if current_weight is not None
            else None
        )
        return ProgressionRecommendation(
            action="deload",
            next_weight=deload_weight,
            rep_range=DEFAULT_REP_RANGE,
            reason="Three consecutive missed minimums; trigger a 10% deload.",
            deload_percentage=deload_percentage,
        )
    if state.consecutive_misses >= 2:
        deload_percentage = 0.05
        deload_weight = (
            round_down_to_increment(current_weight * (1 - deload_percentage), smallest_increment)
            if current_weight is not None
            else None
        )
        return ProgressionRecommendation(
            action="deload",
            next_weight=deload_weight,
            rep_range=DEFAULT_REP_RANGE,
            reason="Two consecutive missed minimums; trigger a 5% deload.",
            deload_percentage=deload_percentage,
        )

    if last_session.eligible and last_session.increase_achieved and state.has_prior_session:
        raw_increase = _select_raw_increase(metadata, smallest_increment)
        rounded_target = (
            round_down_to_increment(current_weight + raw_increase, smallest_increment)
            if current_weight is not None
            else None
        )
        if current_weight is not None and rounded_target is not None:
            if rounded_target <= current_weight:
                return ProgressionRecommendation(
                    action="hold",
                    next_weight=current_weight,
                    rep_range=DEFAULT_REP_RANGE,
                    reason="Increase does not exceed equipment increment; hold current weight.",
                )
        next_weight = rounded_target
        return ProgressionRecommendation(
            action="increase",
            next_weight=next_weight,
            rep_range=POST_INCREASE_REP_RANGE,
            reason="Targets met on first and last sets; increase weight.",
            increase_amount=raw_increase,
        )

    reason = "Hold weight until targets are met or minimum reps recover."
    if last_session.eligible and not last_session.increase_achieved:
        reason = "Reps missed but minimum threshold met; repeat current weight."
    if not state.has_prior_session:
        reason = "Baseline session required before increasing weight."

    return ProgressionRecommendation(
        action="hold",
        next_weight=current_weight,
        rep_range=DEFAULT_REP_RANGE,
        reason=reason,
    )


def recommend_next_load(db_path: str, user_id: int, exercise_id: int) -> ProgressionRecommendation:
    history = fetch_exercise_history(db_path, user_id, exercise_id, limit_sessions=3)
    smallest_increment = fetch_user_smallest_increment(db_path, user_id)
    metadata = fetch_exercise_metadata(db_path, exercise_id)
    return recommend_progression(history, smallest_increment, metadata)
