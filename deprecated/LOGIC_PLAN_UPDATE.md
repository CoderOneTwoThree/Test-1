# LOGIC_PLAN_UPDATE.md

## 1. Executive Summary

**Problem 1: Invalid Schedule Validation**
The current logic in `domain/plans/generator.py` raises a `TRAINING_DAYS_TOO_CONSECUTIVE` error if a user selects more than 2 consecutive training days when the weekly frequency is less than 6. This prevents valid 5-day splits (e.g., Mon-Fri training with Sat/Sun rest), forcing users into unnatural schedules.

**Problem 2: Lack of Workout Variation**
The exercise selection logic (`_select_exercise_for_pattern`) is stateless and deterministic (always picking index `0` of the sorted candidate list). Consequently, if a plan includes two "Upper" sessions, both sessions contain identical exercises. This degrades the user experience and fails to provide comprehensive stimulus.

## 2. Proposed Solution

### Fix 1: Relax Consecutive Day Validation

We will modify the validation logic to allow consecutive days for 5-day frequencies. The strict "max 2 consecutive days" rule should only apply to low-frequency full-body splits (1-3 days) where recovery time is critical between identical sessions. For 4 and 5-day splits (Upper/Lower, PPL), consecutive days are standard practice.

**Changes:**

* Update `PLAN_GENERATION_LOGIC.md` to reflect the new rule.
* Update `domain/plans/generator.py` -> `_validate_training_day_spacing` to allow consecutive days if `weekly_frequency >= 4`.

### Fix 2: Implement Pattern Usage Tracking (Rotation)

We will introduce a stateful counter during plan generation to track how many times a specific movement pattern (e.g., "horizontal push") has been assigned within the current week structure.

**Changes:**

* Modify `_build_plan_days` in `domain/plans/generator.py` to maintain a `pattern_usage_counts` dictionary.
* Update `_select_exercise_for_pattern` to accept an `occurrence_index`.
* Change selection logic from `candidates[0]` to `candidates[occurrence_index % len(candidates)]`. This ensures that the first time we need a chest press we get "Bench Press", and the second time we get "Incline Bench Press" (or the next available option).

---

## 3. Codex Prompt Sequence

Execute these prompts in order to safely implement the changes.

### Prompt 1: Update Specs & Validation Logic (Rest Days)

```text
The user has identified a logic bug regarding schedule validation. Currently, the system rejects 5-day consecutive schedules (e.g., Mon-Fri), which prevents standard 5-day splits.

Please perform the following updates:

1. **Update `PLAN_GENERATION_LOGIC.md`**:
   - Change the rule: "Rest Days: Intercalate rest days between sessions to maximize recovery. Avoid >2 consecutive training days unless Frequency >= 6."
   - To: "Rest Days: Avoid >2 consecutive training days for Full Body splits (Frequency <= 3). For split routines (Frequency >= 4), consecutive training days are permitted."

2. **Update `domain/plans/generator.py`**:
   - Locate the method `_validate_training_day_spacing`.
   - Update the logic so that the check for `TRAINING_DAYS_TOO_CONSECUTIVE` (max consecutive > 2) is ONLY applied if `weekly_frequency <= 3`.
   - If `weekly_frequency >= 4`, skip the consecutive day check entirely.

This will allow users to select Mon-Fri as a valid schedule.

```

### Prompt 2: Implement Workout Variation (Logic Update)

```text
The user wants to fix the issue where repeated sessions (e.g., Upper A and Upper B) contain identical exercises. We need to introduce variation by rotating exercises based on how often a pattern is used.

Please update `domain/plans/generator.py` with the following changes:

1. **Update `_select_exercise_for_pattern` signature**:
   - Add a new argument `occurrence_index: int = 0`.
   - Update the selection logic at the end of the function. Instead of returning `candidates[0]`, return `candidates[occurrence_index % len(candidates)]`. This ensures that if we ask for a "horizontal push" a second time, we get the next exercise in the list.

2. **Update `_build_plan_days`**:
   - Initialize a counter dictionary `pattern_usage: dict[str, int]` outside the loop that iterates over `week_structure`.
   - Inside the loop, when iterating `enumerate(patterns)`:
     - Get the current count for the specific `pattern` (default 0).
     - Pass this count as `occurrence_index` to `_select_exercise_for_pattern`.
     - Increment the count in `pattern_usage` for that `pattern`.

3. **Verify `_apply_beginner_accessory_limit`**:
   - Ensure you pass the `occurrence_index` (or 0) if this function calls `_select_exercise_for_pattern` recursively.

This change ensures that Upper Body Day 1 and Upper Body Day 2 will select different exercises from the available pool.

```

### Prompt 3: Clean Up & Verify (Documentation)

```text
Now that the logic allows for consecutive days and provides exercise variation, please update the documentation to reflect the current state of the system.

1. **Update `PLAN_GENERATION_LOGIC.md`**:
   - Remove the line: "- Exercise variation is currently manual via swaps; automatic rotation is not enabled."
   - Replace it with: "- Exercise variation: Automatic rotation is enabled. If a pattern appears multiple times in a week, the generator cycles through available exercises (sorted by name)."

2. **Update `STAGE_4_LOGIC_CHANGES.md`**:
   - Mark "Remove Automatic Exercise Rotation/Variation" as obsolete or resolved, noting that we have now implemented deterministic rotation.

```