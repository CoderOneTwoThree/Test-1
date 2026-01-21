#!/usr/bin/env python3
import argparse
import pathlib
import sqlite3
from typing import Iterable, List, Tuple


def parse_exercise_rows(lines: Iterable[str]) -> List[Tuple[str, str, str, str, str, str]]:
    rows = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "|" not in stripped:
            continue
        parts = [part.strip() for part in stripped.split("|")]
        if len(parts) < 8:
            continue
        if parts[0] == "Exercise":
            continue
        name, pattern, muscles, equipment, _level, _alts, category, equipment_id = parts[:8]
        rows.append((name, muscles, equipment, pattern, category, equipment_id))
    return rows


def chunked(items: List[Tuple[str, str, str, str, str, str]], size: int) -> Iterable[List[Tuple[str, str, str, str, str, str]]]:
    for index in range(0, len(items), size):
        yield items[index : index + size]


def seed_sqlite(db_path: pathlib.Path, rows: List[Tuple[str, str, str, str, str, str]], batch_size: int) -> None:
    connection = sqlite3.connect(db_path)
    cursor = connection.cursor()
    cursor.execute("DELETE FROM exercises")
    connection.commit()
    for batch in chunked(rows, batch_size):
        cursor.executemany(
            """
            INSERT INTO exercises (name, primary_muscle, equipment, movement_pattern, category, equipment_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            batch,
        )
        connection.commit()
    connection.close()


def write_sql(rows: List[Tuple[str, str, str, str, str, str]]) -> str:
    values = []
    for row in rows:
        escaped = [value.replace("'", "''") for value in row]
        values.append(
            "('" + "', '".join(escaped) + "')"
        )
    joined = ",\n".join(values)
    return (
        "INSERT INTO exercises (name, primary_muscle, equipment, movement_pattern, category, equipment_id)\n"
        "VALUES\n"
        f"{joined};\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--library",
        type=pathlib.Path,
        default=pathlib.Path("EXERCISE_LIBRARY_EXPANDED.md"),
    )
    parser.add_argument("--db", type=pathlib.Path)
    parser.add_argument("--batch-size", type=int, default=50)
    parser.add_argument("--output-sql", type=pathlib.Path)
    args = parser.parse_args()

    lines = args.library.read_text(encoding="utf-8").splitlines()
    rows = parse_exercise_rows(lines)

    if args.output_sql:
        args.output_sql.write_text(write_sql(rows), encoding="utf-8")
        return

    if not args.db:
        raise SystemExit("--db is required when not writing SQL")

    seed_sqlite(args.db, rows, args.batch_size)


if __name__ == "__main__":
    main()
