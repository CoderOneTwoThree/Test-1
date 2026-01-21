import sqlite3
from pathlib import Path

DbConnection = sqlite3.Connection


def get_db_connection(db_path: str | Path) -> DbConnection:
    connection = sqlite3.connect(db_path)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def verify_foreign_keys_enabled(db_path: str | Path) -> int:
    connection = get_db_connection(db_path)
    cursor = connection.execute("PRAGMA foreign_keys")
    value = cursor.fetchone()[0]
    connection.close()
    return int(value)
