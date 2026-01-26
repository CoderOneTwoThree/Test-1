# Test-1 MVP (Local Run)

This repo is a minimal workout app MVP with a vanilla JS UI and a Python + SQLite backend (WIP). For now, the easiest way to run the UI is with the mock server.

## Quickstart (UI + API Server)

This serves the UI and a minimal Flask API that talks to a local SQLite DB.

1) Install Flask (once):

```bash
pip3 install flask
```

2) Initialize the sandbox database:

```bash
python3 scripts/init_db.py --db ./sandbox.db
```

3) Start the server:

```bash
python3 server/app.py --db ./sandbox.db --port 5000
```

Then open:

```
http://localhost:5000/
```

## Alternate: UI + Mock API

This serves the UI and a fake API so you can click through the flow without a database.

```bash
cd /Users/jacobreynolds/Test-1
python3 mock_server.py --port 8000
```

Then open:

```
http://localhost:8000/ui/
```

## Database Setup (SQLite)

The schema lives in `db/schema/001_create_core_tables.sql` and exercises are seeded from `EXERCISE_LIBRARY_EXPANDED.md`.

1) Create a database file and apply the schema:

```bash
sqlite3 ./local.db < db/schema/001_create_core_tables.sql
```

2) Seed exercises:

```bash
python3 data/exercises/seed_exercises.py --db ./local.db
```

3) Insert a default user (required by FK constraints and smallest_increment):

```bash
sqlite3 ./local.db "INSERT INTO users (id, email, smallest_increment) VALUES (1, 'local@user', 2.5);"
```

## Notes / Current Limitations

- The real API server wiring is not implemented yet; `api/*.py` are functions only.
- The mock server does not persist data.
- The UI expects API endpoints like `/questionnaire`, `/plans/{id}`, `/workouts/sessions`, and `/progression/recommendations`.

## Project Docs

Key specs and plans:
- `SYSTEM_SUMMARY.md`
- `TARGETS.md`
- `PROGRESSION_RULES.md`
- `PLAN_GENERATION_LOGIC.md`
- `UI_SCREENS.md`
- `UX_QA_FLOW.md`
- `MINIMAL_DATABASE_MVP_AUDIT.md`
