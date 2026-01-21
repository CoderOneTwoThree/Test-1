# Progression Rules (MVP)

## Preconditions (what must be true to advance)
- Lift logged for the current session.
- All prescribed work sets completed.
- All working sets must meet minimum rep count (6).
- First set hits 12 reps and last set hits at least 10 reps (1–2 RIR).
- At least 1 prior session for the same lift exists.

## Increase rules (how much to add, by lift type)
- Target = first-set target (12 reps) + last-set minimum (10 reps) logic above.
- Increase amounts are defined here:
- Lower-body compound (squat, deadlift, leg press): +5 lb.
- Upper-body compound (bench, overhead press, row): +2.5 lb.
- Accessories/isolation (curls, raises, flyes): +2.5 lb.
- If fractional plates are unavailable: round down to nearest available increment.
- Use the user's smallest available equipment increment for all rounding (ex: 10 lb plate pairs, fixed dumbbell jumps, or 2.5 kg plates).
- Outcome-first rounding: if rounding down would not exceed the current working weight (i.e., it regresses or stays flat), hold the current weight instead of increasing.
- After an increase, reset to 6–8 reps.

## Hold rules (when to keep weight the same)
- Any set missed or below target reps.
- Any set below 6 reps counts as a missed target rep.
- Less than 2 sessions completed for the lift.
- Deload in effect.

## Decrease/deload rules (when and how much to reduce)
- Miss target reps in 2 consecutive sessions for the same lift: -5% next session.
- Miss target reps in 3 consecutive sessions: -10% next session.
- Return to increases only after 1 session meets all Preconditions.
- Manual form audit: if a user manually triggers a Form Alert (via UI), apply a one-time 10% deload to the target weight for the next session of those lifts.

## Edge cases (missed sessions, exercise swap, first time logging)
- Missed session: repeat last completed weight on return.
- Exercise swap: treat as new lift; start with an empty progression history.
- Exercise swap with empty history: recommend a conservative starting load using equipment defaults, then round to the smallest available increment.
- First time logging a lift: hold for 2 sessions before any increase.
