import pytest

from domain.workouts.logging import SessionInput, SetLogInput, validate_session


def make_session(status: str) -> SessionInput:
    return SessionInput(
        user_id=1,
        performed_at="2024-01-01T00:00:00Z",
        duration_minutes=None,
        notes=None,
        completion_status=status,
        template_id=None,
        manual_audit_flag=False,
    )


def make_set_log() -> SetLogInput:
    return SetLogInput(
        exercise_id=1,
        set_number=1,
        reps=8,
        weight=100.0,
        rpe=8.0,
        rest_seconds=90,
        is_initial_load=False,
    )


def test_validate_session_allows_skipped_without_sets() -> None:
    session = make_session("skipped")
    validate_session(session, [], bodyweight_exercise_ids=set())


def test_validate_session_blocks_skipped_with_sets() -> None:
    session = make_session("skipped")
    with pytest.raises(ValueError, match="set_logs must be empty"):
        validate_session(session, [make_set_log()], bodyweight_exercise_ids=set())


def test_validate_session_requires_sets_for_completed() -> None:
    session = make_session("completed")
    with pytest.raises(ValueError, match="set_logs must not be empty"):
        validate_session(session, [], bodyweight_exercise_ids=set())
