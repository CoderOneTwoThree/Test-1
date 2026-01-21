from dataclasses import dataclass

from db.connection import get_db_connection


@dataclass(frozen=True)
class ExerciseMetadata:
    category: str
    movement_pattern: str
    primary_muscle: str
    equipment_id: str


def fetch_user_smallest_increment(db_path: str, user_id: int) -> float:
    db = get_db_connection(db_path)
    try:
        cursor = db.execute("SELECT smallest_increment FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        if row is None:
            raise ValueError("INVALID_USER_ID")
        return float(row[0])
    finally:
        db.close()


def fetch_exercise_metadata(db_path: str, exercise_id: int) -> ExerciseMetadata:
    db = get_db_connection(db_path)
    try:
        cursor = db.execute(
            """
            SELECT category, movement_pattern, primary_muscle, equipment_id
            FROM exercises
            WHERE id = ?
            """,
            (exercise_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise ValueError("INVALID_EXERCISE_ID")
        return ExerciseMetadata(
            category=row[0],
            movement_pattern=row[1],
            primary_muscle=row[2],
            equipment_id=row[3],
        )
    finally:
        db.close()
