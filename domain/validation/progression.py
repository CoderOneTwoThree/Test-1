from dataclasses import dataclass
import math


@dataclass(frozen=True)
class ProgressionCheck:
    all_sets_completed: bool
    min_reps: int
    form_break: bool


def validate_progression_eligibility(check: ProgressionCheck) -> bool:
    return check.all_sets_completed is True and check.min_reps >= 6 and check.form_break is False


def round_down_to_increment(target_weight: float, smallest_increment: float) -> float:
    if smallest_increment <= 0:
        raise ValueError("smallest_increment must be positive")
    return math.floor(target_weight / smallest_increment) * smallest_increment
