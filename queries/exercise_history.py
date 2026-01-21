from collections import defaultdict
from typing import Any

from db.connection import DbConnection, get_db_connection


def _fetch_recent_session_rows(
    db: DbConnection, user_id: int, exercise_id: int, limit_sessions: int
) -> list[tuple]:
    cursor = db.execute(
        """
        SELECT ws.id, ws.performed_at, ws.duration_minutes, ws.notes, ws.completion_status
        FROM workout_sessions ws
        JOIN set_logs sl ON sl.session_id = ws.id
        WHERE ws.user_id = ? AND sl.exercise_id = ?
        GROUP BY ws.id
        ORDER BY ws.performed_at DESC
        LIMIT ?
        """,
        (user_id, exercise_id, limit_sessions),
    )
    return cursor.fetchall()


def _fetch_set_logs_for_sessions(
    db: DbConnection, session_ids: list[int], exercise_id: int
) -> list[tuple]:
    if not session_ids:
        return []
    placeholders = ",".join("?" for _ in session_ids)
    cursor = db.execute(
        f"""
        SELECT session_id, exercise_id, set_number, reps, weight, rpe, rest_seconds, is_initial_load
        FROM set_logs
        WHERE exercise_id = ? AND session_id IN ({placeholders})
        ORDER BY session_id DESC, set_number ASC
        """,
        (exercise_id, *session_ids),
    )
    return cursor.fetchall()


def _fetch_best_sets(
    db: DbConnection, user_id: int, exercise_id: int, limit_sets: int
) -> list[tuple]:
    cursor = db.execute(
        """
        SELECT ws.id AS session_id, ws.performed_at, sl.set_number, sl.reps, sl.weight, sl.rpe, sl.rest_seconds
        FROM set_logs sl
        JOIN workout_sessions ws ON ws.id = sl.session_id
        WHERE ws.user_id = ? AND sl.exercise_id = ?
        ORDER BY sl.weight DESC, sl.reps DESC, sl.rpe DESC
        LIMIT ?
        """,
        (user_id, exercise_id, limit_sets),
    )
    return cursor.fetchall()


def _fetch_baseline_established(db: DbConnection, user_id: int, exercise_id: int) -> bool:
    cursor = db.execute(
        """
        SELECT 1
        FROM set_logs sl
        JOIN workout_sessions ws ON ws.id = sl.session_id
        WHERE ws.user_id = ? AND sl.exercise_id = ? AND sl.is_initial_load = 1
        LIMIT 1
        """,
        (user_id, exercise_id),
    )
    return cursor.fetchone() is not None


def fetch_exercise_history(
    db_path: str, user_id: int, exercise_id: int, limit_sessions: int = 5
) -> dict[str, Any]:
    db = get_db_connection(db_path)
    try:
        recent_rows = _fetch_recent_session_rows(db, user_id, exercise_id, limit_sessions)
        session_ids = [row[0] for row in recent_rows]
        set_rows = _fetch_set_logs_for_sessions(db, session_ids, exercise_id)

        sets_by_session: dict[int, list[dict[str, Any]]] = defaultdict(list)
        for row in set_rows:
            sets_by_session[row[0]].append(
                {
                    "session_id": row[0],
                    "exercise_id": row[1],
                    "set_number": row[2],
                    "reps": row[3],
                    "weight": float(row[4]) if row[4] is not None else None,
                    "rpe": float(row[5]) if row[5] is not None else None,
                    "rest_seconds": row[6],
                    "is_initial_load": bool(row[7]),
                }
            )

        sessions = []
        for row in recent_rows:
            sessions.append(
                {
                    "session_id": row[0],
                    "performed_at": row[1],
                    "duration_minutes": row[2],
                    "notes": row[3],
                    "completion_status": row[4],
                    "sets": sets_by_session.get(row[0], []),
                }
            )

        best_rows = _fetch_best_sets(db, user_id, exercise_id, limit_sets=3)
        best_sets = [
            {
                "session_id": row[0],
                "performed_at": row[1],
                "set_number": row[2],
                "reps": row[3],
                "weight": float(row[4]) if row[4] is not None else None,
                "rpe": float(row[5]) if row[5] is not None else None,
                "rest_seconds": row[6],
            }
            for row in best_rows
        ]
        baseline_established = _fetch_baseline_established(db, user_id, exercise_id)
        return {
            "recent_sessions": sessions,
            "best_sets": best_sets,
            "baseline_established": baseline_established,
            "baseline_status": "Baseline established" if baseline_established else None,
        }
    finally:
        db.close()
