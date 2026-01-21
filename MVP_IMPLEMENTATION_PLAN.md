# MVP Implementation Plan

1. Define the minimal data storage schema for workouts and sets (including exercise, load, reps, and timestamp), use EXERCISE_LIBRARY_EXPANDED.md as the sole source of truth, and persist it using a SQLite database to support the relational queries required by the logic.
2. Implement the logging flow that lets a user start a workout, add sets to exercises, and save the session as a completed workout record.
3. Build the computation step that reads TARGETS.md and PROGRESSION_RULES.md, combines them with the latest logged performance, and outputs the next-session targets for each exercise.
4. Create a minimal UI surface that lists today’s workout, provides inputs for logging sets, and displays the computed next-session targets.
5. Add basic validation and feedback so the logging flow prevents incomplete entries and confirms successful saves.
6. Write basic tests that cover data storage read/write, logging flow persistence, and target computation from rules and prior sessions.
