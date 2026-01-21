from typing import Iterable

from domain.workouts.logging import SetLogInput, auto_fill_from_last_session
from queries.exercise_history import fetch_exercise_history


def auto_fill_for_exercise(
    db_path: str, user_id: int, exercise_id: int
) -> list[SetLogInput]:
    history = fetch_exercise_history(db_path, user_id, exercise_id, limit_sessions=1)
    if not history["recent_sessions"]:
        return []
    last_sets = history["recent_sessions"][0]["sets"]
    set_logs: Iterable[SetLogInput] = [
        SetLogInput(
            exercise_id=set_log["exercise_id"],
            set_number=set_log["set_number"],
            reps=set_log["reps"],
            weight=set_log["weight"],
            rpe=set_log["rpe"],
            rest_seconds=set_log["rest_seconds"],
            is_initial_load=set_log.get("is_initial_load", False),
        )
        for set_log in last_sets
    ]
    return auto_fill_from_last_session(set_logs)
