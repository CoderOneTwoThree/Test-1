# Stage 4 Logic Changes — Remediation Plan

This document provides a **comprehensive, step-by-step plan** to resolve the Phase 4 plan generation audit findings. It is intentionally detailed and implementation-ready, while **not** changing any code yet.

---

## 1) Weekly Frequency = 5 Split Mismatch

**Issue:** The current generator produces `upper/lower/upper/lower/upper` when the split is not `push_pull_legs`, but the spec only allows:
- `push/pull/legs + upper/lower`, or
- `push/pull/legs + push/pull`.

### Plan (Concrete Steps)
1. **Add a split-variant selector** for weekly frequency = 5.
   - **Option A (deterministic default):** Always choose `push/pull/legs + upper/lower`.
   - **Option B (questionnaire-driven):** Add a field like `preferred_5day_structure` or `split_variant` with allowed values:
     - `ppl_upper_lower`
     - `ppl_push_pull`
2. **Update week-structure builder** to allow *only* the two structures when `weekly_frequency == 5`.
3. **Validate configuration**: if the questionnaire does not provide a supported variant, either:
   - fall back to the deterministic default, or
   - reject the request with a validation error.
4. **Add regression tests** (or unit checks) asserting:
   - `weekly_frequency=5` + `split_variant=ppl_upper_lower` → `push, pull, legs, upper, lower`.
   - `weekly_frequency=5` + `split_variant=ppl_push_pull` → `push, pull, legs, push, pull`.
   - no other 5-day structure is generated.

---

## 2) Rest Day Intercalation & User-Selected Training Days

**Issue:** The spec requires rest-day intercalation and avoids >2 consecutive training days for frequencies < 6, but the system only uses `schedule_days` as a numeric count. Users cannot specify *which* days are training.

### Plan (Concrete Steps)
1. **Expand questionnaire schema**
   - Replace or augment `schedule_days` (count) with explicit day selection, e.g.:
     - `training_days_of_week`: array of weekday indices (0=Mon..6=Sun),
     - or `training_day_names`: array of strings (`["Mon", "Wed", "Fri"]`).
2. **Add validation rules** for the selection:
   - Must have **N distinct days** matching `weekly_frequency`.
   - Must be within allowed range (0–6 or valid names).
3. **Plan structure mapping**:
   - Generate the ordered session types (e.g., `push, pull, legs`) **independent** of the calendar.
   - Assign them sequentially across the user’s selected days (sorted order by weekday), leaving non-selected days as rest.
4. **Rest-day compliance**:
   - Check for >2 consecutive training days when `weekly_frequency < 6`.
   - If violated, return a **validation error** with guidance (e.g., “Select at least one rest day between training days”).
5. **Migration approach**:
   - For existing users with only `schedule_days`:
     - Use a default day pattern (e.g., evenly spaced week pattern) and prompt for confirmation.
6. **UI/UX changes** (future work):
   - Provide a calendar UI or toggle list to select training days.
   - Provide a clear warning when the selection violates rest-day rules.

---

## 3) Remove Automatic Exercise Rotation/Variation

**Issue:** The spec mentions “moderate variation” and “advanced variations,” but the current implementation always selects the first eligible exercise (sorted by name), which is deterministic and non-rotational.

### Plan (Concrete Steps)
1. **Update documentation** to remove any claim of automatic exercise variation.
   - Replace with: “Exercise variation is currently manual via swaps.”
2. **Clarify behavior in code comments** (future work):
   - Document that selection is deterministic and sorted (no rotation).
3. **Defer variation logic** to a dedicated roadmap item.
   - Introduce a future plan for rotation rules, if desired, but **remove** any implied automatic variability from specs.

---

## 4) Data Model Alignment With Architecture

**Issue:** The current persistence layer for plan exercises stores `target_reps_min/max`, `starting_weight`, and `is_initial_load` inside `planned_exercises`, while the architecture defines `WorkoutTemplate` and `WorkoutTemplateExercise` with a single `target_reps` and `target_rpe_or_intensity`.

### Plan (Concrete Steps)

### Decision Point
Choose **one** of the following paths:

### **Path A — Align Code to Architecture (Recommended if architecture is authoritative)**
1. **Introduce workout templates in plan generation**:
   - Create a `WorkoutTemplate` per session type per week (or per day index).
   - Insert `WorkoutTemplateExercise` rows using `target_sets`, `target_reps`, and `target_rpe_or_intensity`.
2. **Update plan-workout linkage**:
   - Set `plan_workouts.template_id` to the created `WorkoutTemplate` for each day.
3. **Move progression metadata out of planned exercises**:
   - Keep `starting_weight` and `is_initial_load` in session-level logging or progression recommendations.
   - Use `ProgressionRecommendation` or next-session logic to provide starting weights.
4. **Migrate existing data**:
   - Convert `planned_exercises` into `WorkoutTemplateExercise` entries.
   - Backfill or reassign plans to templates.
5. **Update swap logic**:
   - Swaps should modify `WorkoutTemplateExercise` records rather than `planned_exercises`.
   - Keep `PlannedExerciseSwap` for audit trail (still valid per architecture).

### **Path B — Align Architecture to Implementation (Recommended if current model is intentional)**
1. **Update `architecture.md`** to define `PlannedExercise` explicitly with:
   - `target_reps_min`, `target_reps_max`, `starting_weight`, `is_initial_load`.
2. **Document plan generation as a direct `planned_exercises` writer** (no templates).
3. **Clarify that `WorkoutTemplate` is optional or deferred** to a later phase.

---

## 5) Validation & Regression Coverage

**Core validation tests to add once implementation begins:**
1. **Frequency = 5 structure compliance**
   - Ensure only the two allowed 5-day structures are generated.
2. **Training day selection**
   - Reject invalid counts or duplicate days.
   - Reject >2 consecutive training days for frequency < 6.
3. **Equipment filtering**
   - Ensure exercise pools always obey `equipment_available` mapping.
4. **Initial load rules**
   - New exercises must set `is_initial_load = true` and use default weights rounded by smallest increment.
5. **Swap equivalency**
   - Swaps must enforce movement pattern equivalence and equipment constraints.

---

## 6) Implementation Sequencing (Recommended)

1. **Schema & questionnaire updates** (training day selection).
2. **Week structure logic fixes** (frequency 5 variants).
3. **Rest-day intercalation logic** (assign sessions to selected days).
4. **Documentation update to remove automatic variation**.
5. **Data model alignment** (choose Path A or Path B and implement).
6. **Tests + QA** for split selection, rest-day validation, and swap behavior.

---

## 7) Risks & Mitigations

- **User migration risk:** Existing data lacks explicit training days.
  - *Mitigation:* Provide a default schedule and prompt users to confirm in the UI.
- **Schema refactors:** Aligning architecture may require significant data migration.
  - *Mitigation:* Add transitional compatibility, or choose Path B (documentation alignment).

---

## 8) Definition of Done

- `weekly_frequency=5` only yields compliant split structures.
- Users choose training days and rest-day constraints are enforced.
- No documentation claims automatic variation unless implemented.
- Data model is consistent between code, schema, and architecture docs.
- Regression tests cover the above constraints.
