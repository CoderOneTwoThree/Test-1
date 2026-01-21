from dataclasses import dataclass
from typing import Iterable


COMPLETION_STATUSES = {"completed", "partial", "skipped"}
REPS_MIN = 6
REPS_MAX = 12


@dataclass(frozen=True)
class SetLogInput:
    exercise_id: int
    set_number: int
    reps: int
    weight: float
    rpe: float
    rest_seconds: int
    is_initial_load: bool


@dataclass(frozen=True)
class SessionInput:
    user_id: int
    performed_at: str
    duration_minutes: int | None
    notes: str | None
    completion_status: str
    template_id: int | None


def validate_set_log(set_log: SetLogInput) -> None:
    if set_log.set_number <= 0:
        raise ValueError("set_number must be positive")
    if set_log.reps <= 0:
        raise ValueError("reps must be positive")
    if set_log.weight <= 0:
        raise ValueError("weight must be positive")
    if not REPS_MIN <= set_log.reps <= REPS_MAX:
        raise ValueError("reps must be between 6 and 12")
    if set_log.rpe is None:
        raise ValueError("rpe is required")
    if set_log.rest_seconds is None:
        raise ValueError("rest_seconds is required")
    if set_log.rest_seconds < 0:
        raise ValueError("rest_seconds cannot be negative")
    if not isinstance(set_log.is_initial_load, bool):
        raise ValueError("is_initial_load must be boolean")


def validate_session(session: SessionInput, set_logs: Iterable[SetLogInput]) -> None:
    if session.completion_status not in COMPLETION_STATUSES:
        raise ValueError("completion_status must be completed, partial, or skipped")
    if session.user_id <= 0:
        raise ValueError("user_id must be positive")
    if not session.performed_at:
        raise ValueError("performed_at is required")
    set_logs = list(set_logs)
    if not set_logs:
        raise ValueError("set_logs must not be empty")
    for set_log in set_logs:
        validate_set_log(set_log)


def auto_fill_from_last_session(last_session_sets: Iterable[SetLogInput]) -> list[SetLogInput]:
    return [
        SetLogInput(
            exercise_id=set_log.exercise_id,
            set_number=set_log.set_number,
            reps=set_log.reps,
            weight=set_log.weight,
            rpe=set_log.rpe,
            rest_seconds=set_log.rest_seconds,
            is_initial_load=False,
        )
        for set_log in last_session_sets
    ]
