# Current Implementation Audit & Roadmap (Post-MVP)

**Status:** The MVP is functionally complete. The backend (Flask + SQLite) and Frontend (Vanilla JS) are wired. Core logic for Plan Generation, Logging, and Progression is implemented and persists data.

## 1. Cleanup & Consolidation
The following files are obsolete and should be moved to `deprecated/`:
- `IMPLEMENTATION_PLAN.md`
- `MVP_IMPLEMENTATION_PLAN.md`
- `MVP_AUDIT_SOURCE_OF_TRUTH.md`
- `LOGIC_PLAN_UPDATE.md`
- `STAGE_4_LOGIC_CHANGES.md`
- `GEMINI_CHANGES.md`
- `NEW_CHANGES.md`
- `DECISIONS.md`
- `EXPANSION_REPORT.md`

## 2. Discrepancy Resolution
**Architecture Divergence:**
- **Issue:** `architecture.md` defines `WorkoutTemplate` entities, but `PlanGenerator` writes directly to `planned_exercises`.
- **Decision:** Align documentation to code. The MVP uses "Concrete Plans" (direct rows) rather than "Abstract Templates" to reduce complexity.
- **Action:** Update `architecture.md` to reflect that `WorkoutTemplate` is currently unused/reserved for future features (like "Save Session as Template").

## 3. Active Roadmap (The Final MVP Polish)

### Priority 1: Verification (Quality Assurance)
Since logic changes were made recently, verify these specific flows in the UI:
- [ ] **5-Day Split:** Generate a plan with "5 days/week" and ensure the UI offers the "Split Variant" selector (PPL+UL vs PPL+PP).
- [ ] **Rest Days:** Select specific training days (e.g., M/T/W/T/F) and ensure the generator accepts it (consecutive day logic relaxed).
- [ ] **Swaps:** Perform a swap in the Dashboard and ensure the new exercise persists with a safe starting weight (rounded to increment).
- [ ] **Progression:** Log a session with "Form Audit" checked. Ensure the *next* session recommendation shows a 10% deload.

### Priority 1: Plan
Use this plan to execute the Priority 1 verification items above one-by-one in Codex.

**Execution loop prompt (repeat until complete):**
> Look at Jan 26 implementation.md section "Priority 1: Plan." Find the first task listed in the plan and execute it, then follow up with a review to ensure the item has been completed. When you can confirm via test that the fix works, update the MD by ticking off that item. If no items remain unticked on the plan, say "COMPLETE".

**Plan tasks (ordered):**

Task A
Name: Plan verification setup
Complete: N
Setup: Initialize a clean database (`python3 scripts/init_db.py --db ./sandbox.db`) and start the app (`python3 server/app.py --db ./sandbox.db --port 5000`). Confirm the UI loads at `http://localhost:5000/` with no prior plan/log data.
Steps: Create a new questionnaire flow and confirm there are no existing plans, sessions, or logs in the UI history.
Expected results: The app loads without errors and shows empty/initial states before any plan generation.
Evidence to capture: Screenshot or note of the empty plan/session state and the running server terminal.
Test to validate: Manual UI smoke check (load home, navigate questionnaire, verify empty history).
Manual UI required: This item cannot be confirmed without running the UI.

Task B
Name: 5-Day Split check
Complete: N
Setup: Use the clean user from Task A. In the questionnaire, set weekly frequency to 5 days and select full gym equipment to avoid filtering issues.
Steps: Complete the questionnaire with 5 days/week, generate the plan, and inspect the plan summary or split selection UI.
Expected results: UI exposes a split variant selector with options PPL+UL vs PPL+PP for 5-day plans.
Evidence to capture: Screenshot of the split variant selector and generated 5-day plan summary.
Test to validate: Manual UI verification of split selector presence for 5-day frequency.
Manual UI required: This item cannot be confirmed without running the UI.

Task C
Name: Rest Days check
Complete: N
Setup: Continue from Task B with a 5-day frequency. Use the schedule selector.
Steps: Select consecutive training days (e.g., M/T/W/T/F) and attempt to generate the plan.
Expected results: Plan generation succeeds without validation errors for consecutive days in split routines.
Evidence to capture: Screenshot or note showing the selected days and successful plan generation.
Test to validate: Manual UI verification that no error is shown and plan is created.
Manual UI required: This item cannot be confirmed without running the UI.

Task D
Name: Swap persistence check
Complete: N
Setup: From the generated plan, open the Dashboard and locate a planned exercise with a swap control.
Steps: Perform a swap, save it, reload or navigate away and back to the Dashboard, and review the swapped exercise’s starting weight.
Expected results: The swapped exercise persists and the starting weight is conservative and rounded to the smallest increment.
Evidence to capture: Before/after screenshots of the exercise swap and the rounded starting weight.
Test to validate: Manual UI verification after reload that the swap persists with rounded weight.
Manual UI required: This item cannot be confirmed without running the UI.

Task E
Name: Form Audit deload check
Complete: N
Setup: Open a planned session for the swapped or original lift and prepare to log it.
Steps: Log a session with “Form Audit” checked, save the session, then open the next session’s recommendation for the same lift.
Expected results: The next recommendation applies a 10% deload for the affected lift.
Evidence to capture: Screenshot or note showing the logged form audit and the next session’s reduced target weight.
Test to validate: Manual UI verification that the next recommendation is reduced by 10%.
Manual UI required: This item cannot be confirmed without running the UI.

### Priority 1.5: Logic changes (Logic)
- [ ] **Full workout generation logic audit:** Conduct a full audit by both Codex and the user of how the app actually handles workout generation. 
- [ ] **Full workout logger audit:** Conduct a full audit by both Codex and the user of how the app actually handles workout logging. 
  - Codex audit report: `AUDIT_TASK_1_5_CODEX.md` (user validation still required).

### Priority 2: UI "Hardening" (Phase 6)
- [ ] **Empty States:** Ensure History screen looks good for a brand new user (no crashes on empty arrays).
- [ ] **Error Handling:** Verify that if the server is down, the UI shows the red alert banners defined in `styles.css`.

### Priority 3: Code Cleanup
- [ ] **Unused Imports:** Scan `domain/` and `api/` for unused imports left over from refactors.
- [ ] **Type Hints:** Ensure all new logic in `generator.py` and `swap.py` is fully type-hinted.

## 4. Operational Source of Truth
- **Schema:** `db/schema/001_create_core_tables.sql`
- **Logic:** `PLAN_GENERATION_LOGIC.md` & `PROGRESSION_RULES.md`
- **Data:** `EXERCISE_LIBRARY_EXPANDED.md`
- **Run:** `python3 server/app.py`
