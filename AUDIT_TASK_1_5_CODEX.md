# Task 1.5 Codex Audit Report (Logic)

## Scope
- Workout plan generation logic (PlanGenerator + swap logic)
- Workout logging + progression recommendation engine

## Sources reviewed
- PLAN_GENERATION_LOGIC.md
- PROGRESSION_RULES.md
- SYSTEM_SUMMARY.md
- domain/plans/generator.py
- domain/plans/swap.py
- domain/workouts/logging.py
- domain/progression/engine.py

## Plan generation audit (spec vs code)

### Split selection
- **Spec:** goal + weekly frequency determine split (full body, upper/lower, PPL). Five-day plans should support PPL variants.
- **Code:** `_select_split` and `_build_week_structure` follow the same mapping, with a PPL variant selector for 5-day splits.
- **Result:** ✅ Match.

### Weekly structure
- **Spec:** 1–3 days default to full body; 4 days upper/lower; 5 days PPL variants; 6+ days PPL repeat (+ optional full body).
- **Code:** `_build_week_structure` matches the described structures and extends with full-body sessions for 7+ days.
- **Result:** ✅ Match.

### Rest-day spacing
- **Spec:** for frequency <= 3, avoid >2 consecutive training days; for split routines (>=4), consecutive days are allowed.
- **Code:** `_validate_training_day_spacing` only enforces consecutive-day limits when weekly_frequency < 4.
- **Result:** ✅ Match.

### Exercise selection & rotation
- **Spec:** deterministic rotation by name order and cycle through patterns to avoid repeats.
- **Code:** `_group_by_pattern` sorts by name; `_select_exercise_for_pattern` uses occurrence_index to cycle through options.
- **Result:** ✅ Match.

### Experience volume and accessory limits
- **Spec:** beginner volume low; intermediate moderate; advanced high; beginner accessory limits.
- **Code:** `_session_exercise_budget` uses 4/5/6 baseline for beginner/intermediate/advanced. Beginner accessory cap enforced by `_apply_beginner_accessory_limit` and `_audit_plan`.
- **Result:** ✅ Match.

### Equipment filtering
- **Spec:** equipment availability constrains exercise pool.
- **Code:** `EQUIPMENT_ALLOWED` and `fetch_exercise_pool` implement this filter.
- **Result:** ✅ Match.

### Swap behavior
- **Spec:** swaps act as new lifts; conservative starting load with smallest increment rounding.
- **Code:** `apply_swap` uses latest performance if present, otherwise defaults via `EQUIPMENT_DEFAULTS` and `round_down_to_increment`.
- **Result:** ✅ Match.

## Workout logging & progression audit (spec vs code)

### Preconditions for increase
- **Spec:** completed session, min 6 reps, first set 12 reps, last set >=10, and prior session exists.
- **Code:** `_summarize_session` computes eligibility + increase_achieved; `recommend_progression` requires `state.has_prior_session` before increase.
- **Result:** ✅ Match.

### Increase amounts & rounding
- **Spec:** lower-body +5 lb, upper-body +2.5 lb, accessories +2.5 lb; round down to smallest increment; hold if rounding doesn’t exceed current weight.
- **Code:** `_select_raw_increase` aligns with lower/body vs accessory logic; rounding uses `round_down_to_increment`; hold if rounded target <= current.
- **Result:** ✅ Match.

### Deload rules
- **Spec:** 2 misses = -5%, 3 misses = -10%, manual form audit = one-time 10% deload with priority.
- **Code:** `recommend_progression` checks manual audit first, then consecutive misses (>=3 then >=2) with correct percentages.
- **Result:** ✅ Match.

### Hold rules
- **Spec:** hold when targets missed or <2 sessions logged.
- **Code:** hold branch used when no deload and no increase; `state.has_prior_session` gates increases.
- **Result:** ✅ Match.

### Edge cases
- **Spec:** new lifts/swap start with conservative defaults; missed sessions repeat last completed weight.
- **Code:** no prior sessions -> default conservative starting load; holds use current weight by default.
- **Result:** ✅ Match.

## Findings
- No mismatches identified between written specs and current code for plan generation or logging/progression logic.

## Follow-ups for user validation
- Manual UI verification for swap persistence and form-audit deload remains in Priority 1 tasks (separate from this logic audit).
