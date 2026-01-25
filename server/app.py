#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import pathlib
import sqlite3
import time
from dataclasses import asdict
from typing import Any

from flask import Flask, jsonify, redirect, request, send_from_directory

from api.plans import generate_plan, get_swap_options, swap_plan_exercise
from api.questionnaire import create_questionnaire
from api.workouts import create_session
from domain.progression.engine import recommend_next_load
from queries.exercise_history import fetch_exercise_history


BASE_DIR = pathlib.Path(__file__).resolve().parents[1]
UI_DIR = BASE_DIR / "ui"


def create_app(db_path: pathlib.Path) -> Flask:
    app = Flask(__name__)
    app.config["DB_PATH"] = str(db_path)

    @app.get("/")
    def index() -> Any:
        return redirect("/ui/")

    @app.get("/ui/")
    def ui_index() -> Any:
        return send_from_directory(UI_DIR, "index.html")

    @app.get("/ui/<path:filename>")
    def ui_static(filename: str) -> Any:
        return send_from_directory(UI_DIR, filename)

    @app.post("/questionnaire")
    def questionnaire() -> Any:
        payload = request.get_json(silent=True) or {}
        db_path_local = app.config["DB_PATH"]
        try:
            questionnaire_id = create_questionnaire(db_path_local, payload)
            plan_id = generate_plan(
                db_path_local, {"questionnaire_id": questionnaire_id}
            )
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify({"questionnaire_id": questionnaire_id, "plan_id": plan_id})

    @app.post("/plans/generate")
    def plans_generate() -> Any:
        payload = request.get_json(silent=True) or {}
        db_path_local = app.config["DB_PATH"]
        try:
            plan_id = generate_plan(db_path_local, payload)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify({"plan_id": plan_id})

    @app.get("/plans/<int:plan_id>")
    def plans_get(plan_id: int) -> Any:
        db_path_local = app.config["DB_PATH"]
        try:
            plan = _fetch_plan_payload(db_path_local, plan_id)
        except Exception as exc:
            return _error(str(exc), 404)
        return jsonify(plan)

    @app.get("/plans/<int:plan_id>/swap-options")
    def plans_swap_options(plan_id: int) -> Any:
        db_path_local = app.config["DB_PATH"]
        day_index = request.args.get("day_index", type=int)
        sequence = request.args.get("sequence", type=int)
        if day_index is None or sequence is None:
            return _error("day_index and sequence are required", 400)
        try:
            options = get_swap_options(db_path_local, plan_id, day_index, sequence)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify(options)

    @app.patch("/plans/<int:plan_id>/swap")
    def plans_swap(plan_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        payload["plan_id"] = plan_id
        db_path_local = app.config["DB_PATH"]
        try:
            swap_plan_exercise(db_path_local, payload)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify({"status": "ok"})

    @app.post("/workouts/sessions")
    def workouts_start_session() -> Any:
        payload = request.get_json(silent=True) or {}
        if payload.get("set_logs"):
            db_path_local = app.config["DB_PATH"]
            try:
                session_id = create_session(db_path_local, payload)
            except Exception as exc:
                return _error(str(exc), 400)
            return jsonify({"session_id": session_id})
        payload.setdefault("id", int(time.time()))
        return jsonify(payload)

    @app.post("/workouts")
    def workouts_save_session() -> Any:
        payload = request.get_json(silent=True) or {}
        db_path_local = app.config["DB_PATH"]
        try:
            session_id = create_session(db_path_local, payload)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify({"session_id": session_id})

    @app.get("/workouts/sessions")
    def workouts_list_sessions() -> Any:
        db_path_local = app.config["DB_PATH"]
        user_id = request.args.get("user_id", type=int, default=1)
        try:
            sessions = _fetch_sessions_with_sets(db_path_local, user_id)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify(sessions)

    @app.get("/exercises/<int:exercise_id>/history")
    def exercises_history(exercise_id: int) -> Any:
        db_path_local = app.config["DB_PATH"]
        user_id = request.args.get("user_id", type=int, default=1)
        try:
            history = fetch_exercise_history(db_path_local, user_id, exercise_id)
        except Exception as exc:
            return _error(str(exc), 400)
        return jsonify(history)

    @app.get("/progression/recommendations")
    def progression_recommendations() -> Any:
        db_path_local = app.config["DB_PATH"]
        user_id = request.args.get("user_id", type=int)
        exercise_id = request.args.get("exercise_id", type=int)
        if user_id is None or exercise_id is None:
            return _error("user_id and exercise_id are required", 400)
        try:
            recommendation = recommend_next_load(db_path_local, user_id, exercise_id)
        except Exception as exc:
            return _error(str(exc), 400)
        payload = asdict(recommendation)
        payload["rep_range"] = list(payload.get("rep_range", []))
        return jsonify(payload)

    return app


def _error(message: str, status: int) -> Any:
    return jsonify({"error": message}), status


def _parse_training_days(value: str | None) -> list[int]:
    if not value:
        return []
    return [int(day.strip()) for day in value.split(",") if day.strip()]


def _fetch_plan_payload(db_path: str, plan_id: int) -> dict[str, Any]:
    connection = sqlite3.connect(db_path)
    try:
        cursor = connection.execute(
            """
            SELECT p.id,
                   p.name,
                   p.start_date,
                   p.weeks,
                   q.goals,
                   q.experience_level,
                   q.schedule_days,
                   q.training_days_of_week
            FROM plans p
            JOIN questionnaire_responses q
              ON q.id = p.generated_from_questionnaire_id
            WHERE p.id = ?
            """,
            (plan_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise ValueError("PLAN_NOT_FOUND")

        plan = {
            "id": row[0],
            "name": row[1],
            "start_date": row[2],
            "weeks": row[3],
            "goals": row[4],
            "experience_level": row[5],
            "schedule_days": row[6],
            "training_days_of_week": _parse_training_days(row[7]),
        }

        exercise_cursor = connection.execute(
            """
            SELECT pe.day_index,
                   pe.session_type,
                   pe.sequence,
                   pe.exercise_id,
                   pe.target_sets,
                   pe.target_reps_min,
                   pe.target_reps_max,
                   pe.starting_weight,
                   pe.is_initial_load,
                   ex.name,
                   ex.category
            FROM planned_exercises pe
            JOIN exercises ex ON ex.id = pe.exercise_id
            WHERE pe.plan_id = ?
            ORDER BY pe.day_index, pe.sequence
            """,
            (plan_id,),
        )
        workouts: dict[int, dict[str, Any]] = {}
        for row in exercise_cursor.fetchall():
            day_index = int(row[0])
            if day_index not in workouts:
                workouts[day_index] = {
                    "day_index": day_index,
                    "session_type": row[1],
                    "exercises": [],
                }
            workouts[day_index]["exercises"].append(
                {
                    "sequence": row[2],
                    "exercise_id": row[3],
                    "target_sets": row[4],
                    "target_reps_min": row[5],
                    "target_reps_max": row[6],
                    "starting_weight": row[7],
                    "is_initial_load": bool(row[8]),
                    "name": row[9],
                    "category": row[10],
                }
            )
    finally:
        connection.close()

    plan["workouts"] = [
        workouts[key] for key in sorted(workouts.keys())
    ]
    return plan


def _fetch_sessions_with_sets(db_path: str, user_id: int) -> list[dict[str, Any]]:
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    try:
        session_rows = connection.execute(
            """
            SELECT id, performed_at, duration_minutes, notes, completion_status, manual_audit_flag
            FROM workout_sessions
            WHERE user_id = ?
            ORDER BY performed_at DESC
            """,
            (user_id,),
        ).fetchall()
        session_ids = [row["id"] for row in session_rows]
        set_logs: dict[int, list[dict[str, Any]]] = {sid: [] for sid in session_ids}
        if session_ids:
            placeholders = ",".join("?" for _ in session_ids)
            rows = connection.execute(
                f"""
                SELECT sl.session_id,
                       sl.exercise_id,
                       ex.name,
                       sl.set_number,
                       sl.reps,
                       sl.weight,
                       sl.rpe,
                       sl.rest_seconds,
                       sl.is_initial_load
                FROM set_logs sl
                JOIN exercises ex ON ex.id = sl.exercise_id
                WHERE sl.session_id IN ({placeholders})
                ORDER BY sl.session_id DESC, sl.set_number ASC
                """,
                session_ids,
            ).fetchall()
            for row in rows:
                set_logs[row["session_id"]].append(
                    {
                        "exercise_id": row["exercise_id"],
                        "exercise_name": row["name"],
                        "set_number": row["set_number"],
                        "reps": row["reps"],
                        "weight": row["weight"],
                        "rpe": row["rpe"],
                        "rest_seconds": row["rest_seconds"],
                        "is_initial_load": bool(row["is_initial_load"]),
                    }
                )

        sessions = []
        for row in session_rows:
            sessions.append(
                {
                    "id": row["id"],
                    "performed_at": row["performed_at"],
                    "duration_minutes": row["duration_minutes"],
                    "notes": row["notes"],
                    "completion_status": row["completion_status"],
                    "manual_audit_flag": bool(row["manual_audit_flag"]),
                    "set_logs": set_logs.get(row["id"], []),
                }
            )
        return sessions
    finally:
        connection.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        type=pathlib.Path,
        default=BASE_DIR / "sandbox.db",
        help="Path to SQLite DB file.",
    )
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()

    app = create_app(args.db)
    app.run(host=args.host, port=args.port, debug=True)


if __name__ == "__main__":
    main()
