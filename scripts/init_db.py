#!/usr/bin/env python3
import argparse
import pathlib
import sqlite3

from data.exercises.seed_exercises import parse_exercise_rows, seed_sqlite


def apply_schema(db_path: pathlib.Path, schema_path: pathlib.Path) -> None:
    schema_sql = schema_path.read_text(encoding="utf-8")
    connection = sqlite3.connect(db_path)
    try:
        connection.executescript(schema_sql)
        connection.commit()
    finally:
        connection.close()


def ensure_default_user(db_path: pathlib.Path, email: str, smallest_increment: float) -> None:
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.execute("SELECT 1 FROM users WHERE id = 1")
        if cursor.fetchone() is None:
            connection.execute(
                "INSERT INTO users (id, email, smallest_increment) VALUES (?, ?, ?)",
                (1, email, smallest_increment),
            )
            connection.commit()
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=pathlib.Path,
        default=pathlib.Path("local.db"),
        help="Path to the SQLite database file.",
    )
    parser.add_argument(
        "--schema",
        type=pathlib.Path,
        default=pathlib.Path("db/schema/001_create_core_tables.sql"),
        help="Path to the schema SQL file.",
    )
    parser.add_argument(
        "--library",
        type=pathlib.Path,
        default=pathlib.Path("EXERCISE_LIBRARY_EXPANDED.md"),
        help="Path to the exercise library markdown file.",
    )
    parser.add_argument(
        "--email",
        type=str,
        default="local@user",
        help="Email to use for the default user (id=1).",
    )
    parser.add_argument(
        "--smallest-increment",
        type=float,
        default=2.5,
        help="Default smallest increment for the user.",
    )
    args = parser.parse_args()

    apply_schema(args.db, args.schema)

    lines = args.library.read_text(encoding="utf-8").splitlines()
    rows = parse_exercise_rows(lines)
    seed_sqlite(args.db, rows, batch_size=50)

    ensure_default_user(args.db, args.email, args.smallest_increment)


if __name__ == "__main__":
    main()
