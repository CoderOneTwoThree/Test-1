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

### Priority 1.5: Logic changes (Logic)
- [ ] **Full workout generation logic audit:** Conduct a full audit by both Codex and the user of how the app actually handles workout generation. 
- [ ] **Full workout logger audit:** Conduct a full audit by both Codex and the user of how the app actually handles workout logging. 

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
