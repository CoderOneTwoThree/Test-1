import argparse
import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse


DEFAULT_EXERCISES = [
    {
        "name": "Back Squat",
        "category": "Lower",
        "target_sets": 4,
        "target_reps_min": 5,
        "target_reps_max": 8,
    },
    {
        "name": "Bench Press",
        "category": "Upper",
        "target_sets": 4,
        "target_reps_min": 6,
        "target_reps_max": 10,
    },
    {
        "name": "Romanian Deadlift",
        "category": "Lower",
        "target_sets": 3,
        "target_reps_min": 8,
        "target_reps_max": 12,
    },
    {
        "name": "Lat Pulldown",
        "category": "Upper",
        "target_sets": 3,
        "target_reps_min": 8,
        "target_reps_max": 12,
    },
    {
        "name": "Dumbbell Shoulder Press",
        "category": "Upper",
        "target_sets": 3,
        "target_reps_min": 8,
        "target_reps_max": 12,
    },
    {
        "name": "Split Squat",
        "category": "Lower",
        "target_sets": 3,
        "target_reps_min": 10,
        "target_reps_max": 12,
    },
    {
        "name": "Cable Row",
        "category": "Upper",
        "target_sets": 3,
        "target_reps_min": 8,
        "target_reps_max": 12,
    },
    {
        "name": "Plank",
        "category": "Core",
        "target_sets": 3,
        "target_reps_min": 30,
        "target_reps_max": 60,
    },
]


def build_exercises_for_session(session_index, count=4):
    exercises = []
    for i in range(count):
        base = DEFAULT_EXERCISES[(session_index + i) % len(DEFAULT_EXERCISES)]
        exercises.append(
            {
                "exercise_id": session_index * 100 + i + 1,
                "name": base["name"],
                "category": base["category"],
                "sequence": i + 1,
                "target_sets": base["target_sets"],
                "target_reps_min": base["target_reps_min"],
                "target_reps_max": base["target_reps_max"],
                "starting_weight": None,
                "is_initial_load": False,
            }
        )
    return exercises


def get_session_types(schedule_days):
    if schedule_days <= 2:
        return ["Full Body A", "Full Body B"]
    if schedule_days == 3:
        return ["Full Body A", "Full Body B", "Full Body C"]
    if schedule_days == 4:
        return ["Upper", "Lower", "Upper", "Lower"]
    if schedule_days == 5:
        return ["Push", "Pull", "Legs", "Upper", "Lower"]
    return [f"Session {index + 1}" for index in range(schedule_days)]


def build_plan(payload):
    schedule_days = int(payload.get("schedule_days") or 3)
    training_days = payload.get("training_days_of_week") or list(range(schedule_days))
    training_days = training_days[:schedule_days]
    session_types = get_session_types(schedule_days)
    workouts = []
    for index in range(schedule_days):
        workouts.append(
            {
                "day_index": training_days[index] if index < len(training_days) else index,
                "session_type": session_types[index] if index < len(session_types) else "Session",
                "exercises": build_exercises_for_session(index, 4),
            }
        )
    return {
        "name": "Mock Generated Plan",
        "start_date": time.strftime("%Y-%m-%d"),
        "weeks": 4,
        "goals": payload.get("goals"),
        "experience_level": payload.get("experience_level"),
        "schedule_days": schedule_days,
        "training_days_of_week": training_days,
        "workouts": workouts,
    }


def get_swap_options():
    options = []
    for index, base in enumerate(DEFAULT_EXERCISES):
        options.append(
            {
                "id": 1000 + index,
                "name": base["name"],
                "movement_pattern": base["category"],
                "category": base["category"],
                "equipment_id": None,
                "primary_muscle": base["category"],
            }
        )
    return options


class MockState:
    def __init__(self):
        self.plans = {}
        self.next_id = 1

    def create_plan(self, payload):
        plan = build_plan(payload)
        plan_id = self.next_id
        self.next_id += 1
        plan["id"] = plan_id
        self.plans[plan_id] = plan
        return plan_id, plan

    def get_plan(self, plan_id):
        return self.plans.get(plan_id)

    def apply_swap(self, plan_id, day_index, sequence, exercise_id):
        plan = self.plans.get(plan_id)
        if not plan:
            return None
        workouts = plan.get("workouts", [])
        target = None
        for workout in workouts:
            if int(workout.get("day_index", -1)) == int(day_index):
                target = workout
                break
        if not target:
            return plan
        exercises = target.get("exercises", [])
        for exercise in exercises:
            if int(exercise.get("sequence", -1)) == int(sequence):
                for option in get_swap_options():
                    if int(option["id"]) == int(exercise_id):
                        exercise["name"] = option["name"]
                        exercise["category"] = option["category"]
                        break
                break
        return plan


class MockHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory=None, state=None, **kwargs):
        self.state = state
        super().__init__(*args, directory=directory, **kwargs)

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError:
            return {}

    def do_POST(self):
        if self.path == "/questionnaire":
            payload = self._read_json()
            plan_id, _plan = self.state.create_plan(payload)
            self._send_json(200, {"plan_id": plan_id})
            return
        if self.path == "/workouts/sessions":
            payload = self._read_json()
            payload["id"] = int(time.time())
            self._send_json(200, payload)
            return
        self._send_json(404, {"error": "Not Found"})

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/progression/recommendations":
            query = parse_qs(parsed.query)
            try:
                exercise_id = int(query.get("exercise_id", [0])[0])
            except ValueError:
                exercise_id = 0
            base = DEFAULT_EXERCISES[exercise_id % len(DEFAULT_EXERCISES)]
            payload = {
                "exercise_id": exercise_id,
                "rep_range": [base["target_reps_min"], base["target_reps_max"]],
                "next_weight": 95,
            }
            self._send_json(200, payload)
            return
        if parsed.path.startswith("/plans/"):
            parts = parsed.path.strip("/").split("/")
            if len(parts) >= 2:
                try:
                    plan_id = int(parts[1])
                except ValueError:
                    self._send_json(400, {"error": "Invalid plan id"})
                    return
                if len(parts) == 3 and parts[2] == "swap-options":
                    self._send_json(200, get_swap_options())
                    return
                plan = self.state.get_plan(plan_id)
                if not plan:
                    self._send_json(404, {"error": "Plan not found"})
                    return
                self._send_json(200, plan)
                return
        super().do_GET()

    def do_PATCH(self):
        parsed = urlparse(self.path)
        if parsed.path.startswith("/plans/") and parsed.path.endswith("/swap"):
            parts = parsed.path.strip("/").split("/")
            if len(parts) >= 3:
                try:
                    plan_id = int(parts[1])
                except ValueError:
                    self._send_json(400, {"error": "Invalid plan id"})
                    return
                payload = self._read_json()
                day_index = payload.get("day_index")
                sequence = payload.get("sequence")
                exercise_id = payload.get("exercise_id")
                updated = self.state.apply_swap(plan_id, day_index, sequence, exercise_id)
                if not updated:
                    self._send_json(404, {"error": "Plan not found"})
                    return
                self._send_json(200, {"status": "ok"})
                return
        self._send_json(404, {"error": "Not Found"})


def main():
    parser = argparse.ArgumentParser(description="Mock API + static UI server")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    repo_root = os.path.dirname(os.path.abspath(__file__))
    ui_dir = os.path.join(repo_root, "ui")
    state = MockState()

    def handler(*handler_args, **handler_kwargs):
        return MockHandler(*handler_args, directory=ui_dir, state=state, **handler_kwargs)

    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    print(f"Serving UI + mock API at http://127.0.0.1:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
