[Minimal Change Set

Action: Apply these specific edits to move to "Ready".

EXERCISE_LIBRARY_EXPANDED.md

Add column Category (Values: Compound, Accessory) to header and all rows.

Add column Equipment_ID (Values: barbell, dumbbell, machine, bodyweight, cable, band) to normalize filtering.

QUESTIONNAIRE.md

Replace open-ended questions with single-select lists matching PLAN_GENERATION_LOGIC keys.

Goal: [General Fitness, Muscle Gain, Strength, Weight Loss]

Experience: [Beginner, Intermediate, Advanced]

Equipment: [None, Dumbbells Only, Home Gym, Full Gym]

PROGRESSION_RULES.md

Update Preconditions: "All working sets completed. First set hits 12 reps. Last set hits >= 10 reps." -> "All working sets must meet minimum rep count (6). First set hits 12 reps. Last set hits >= 10 reps."

Update Increase rules: "If fractional plates are unavailable: round down to nearest available increment (default 5lb/2.5kg)."

TARGETS.md

Add: "RIR 1-2 corresponds to RPE 8-9."

Add: "For a new lift with no history, the user must select a weight they can perform for 6 reps with good form."

PLAN_GENERATION_LOGIC.md

Add: "Rest Days: Intercalate rest days between sessions to maximize recovery. Avoid >2 consecutive training days unless Frequency >= 6."

architecture.md

Update QuestionnaireResponse: Add excluded_patterns (array of strings).

Update Exercise: Add category (compound/accessory).

MVP_IMPLEMENTATION_PLAN.md

Update Step 1: "Use EXERCISE_LIBRARY_EXPANDED.md as the sole source of truth."

Delete reference to "simple local store" and replace with "SQLite database" to support the relational queries required by the logic.]
