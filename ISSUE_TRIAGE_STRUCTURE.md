# Issue Identification & Resolution Structure (Aligned with AGENTS.md)

## Purpose
Provide a repeatable structure to identify, document, and resolve UI/logic issues while following the multi-agent workflow and the Ralph Wiggum loop defined in `AGENTS.md`.

## 1) Intake & Classification
Use this checklist for each incoming issue:

- **Issue summary:** one sentence of the observed behavior.
- **Scope:** UI, logic, data, or cross-cutting.
- **User impact:** confusion, incorrect output, blocked flow, or minor friction.
- **Reproduction steps:** exact screen and action path.
- **Expected behavior:** based on specs or product intent.
- **Actual behavior:** what happens now.

## 2) Spec Alignment (Spec-Guardian)
Confirm alignment with specs before proposing a fix:

- **Primary specs to check:**
  - `TARGETS.md`
  - `PROGRESSION_RULES.md`
  - `SYSTEM_SUMMARY.md`
- **Flow specs to check:**
  - `PLAN_GENERATION_LOGIC.md`
  - `UX_QA_FLOW.md`
  - `UI_SCREENS.md`
- **Decision rules:**
  - If specs conflict or are ambiguous, pause and escalate.
  - If code contradicts specs, code should be updated to match specs.
  - If behavior changes, update docs in the same PR.

## 3) Issue Record Template
Use this template to ensure each issue is fully specified and ready for implementation:

```
Issue ID:
Title:
Summary:
Scope:
Screens/flows affected:
Specs referenced:
Expected vs actual:
Root cause hypothesis:
Proposed solution:
Acceptance criteria:
Tests/verification:
Docs to update:

Ralph Wiggum loop state:
- Plan:
- Chunks:
- Implement:
- Run checks:
- Evaluate:
- Fix:
```

## 4) Prioritization & Sequencing
- **Order by impact:** blocked flows and incorrect plan/logging behavior first.
- **Dependency check:** confirm data or API changes required.
- **One concern per PR:** each PR targets a single issue record.

## 5) Implementation Workflow (Builder)
- Draft a plan and break into chunks.
- Implement minimal changes to address the issue.
- Update specs or UX docs if behavior changes.
- Keep scope narrow and focused on the single issue.

## 6) Verification Gates (Tester)
For each issue:
- Run standard tests, lint, format, and build/type checks as configured.
- Capture command outputs in the test report.

## 7) Review & Consistency (Reviewer + Spec-Guardian)
- Reviewer checks correctness, style, and scope.
- Spec-Guardian confirms zero mismatches with specs.
- If any blocking findings, re-enter the Ralph Wiggum loop.

---

# Issue Records for Current UI/Logic Concerns

## Issue 1: Starting weight undefined (random)
- **Summary:** Initial working weight is undefined; users see seemingly random starting weights.
- **Expected:** On workout generation and first workout, prompt user to input current working weight. If user selected "beginner," provide guidance on how to select a starting weight.
- **Proposed solution:** Add a first-workout prompt with user input for working weight; if beginner, show guidance text (e.g., pick a weight you can do ~10 reps with, then attempt max reps on first set).
- **Acceptance criteria:** Users are explicitly prompted for starting weight; beginner guidance appears when applicable.

## Issue 2: Swap exercise doesn’t update logger
- **Summary:** Swapping exercise in workout view does not update the logger; logger continues with original exercise.
- **Expected:** Swapped exercise updates the logging flow and any downstream state.
- **Proposed solution:** Ensure swap action updates the workout session state that feeds the logger.
- **Acceptance criteria:** After swap, logger reflects the new exercise name and parameters.

## Issue 3: Swap exercise needed at plan-level
- **Summary:** No option to reject or swap exercises during plan generation.
- **Expected:** Users can reject/swap exercises at plan level before starting workouts.
- **Proposed solution:** Add plan-level swap/reject UI with regeneration logic for a single exercise slot.
- **Acceptance criteria:** Users can swap a plan exercise; the plan reflects the new choice before entering workout flow.

---

# Issue Records

## Issue 1 Record
Issue ID: 1
Title: Starting weight undefined (random)
Summary: Starting weights were missing for new lifts, leading to unclear or random targets in the session logger.
Scope: UI + state
Screens/flows affected: Session Detail / Execution
Specs referenced: TARGETS.md, UI_SCREENS.md
Expected vs actual: Expected a prompt for starting weight on first workout (with beginner guidance); actual UI skipped the prompt and showed "Target unavailable."
Root cause hypothesis: Session Detail relied on plan/recommendation data without prompting when weights were null.
Proposed solution: Add a session prompt to capture starting weights, show beginner guidance, and persist user input into the stored plan.
Acceptance criteria: Users are prompted for starting weights when missing; beginner guidance appears for beginner plans; targets update to reflect input.
Tests/verification: PYTHONPATH=. pytest
Docs to update: UI_SCREENS.md (Session Detail)

Ralph Wiggum loop state:
- Plan: Define prompt behavior and persistence for missing starting weights.
- Chunks: Add UI panel; add controller logic; update docs.
- Implement: Completed.
- Run checks: Completed (pytest with PYTHONPATH).
- Evaluate: Prompt appears for missing weights and guidance shown for beginners.
- Fix: None needed.

## Issue 2 Record
Issue ID: 2
Title: Swap exercise doesn’t update logger
Summary: Swapping an exercise on the dashboard did not update the session logger, which still showed the original exercise.
Scope: UI + state
Screens/flows affected: Dashboard / Today, Session Detail / Execution
Specs referenced: SYSTEM_SUMMARY.md, UI_SCREENS.md
Expected vs actual: Expected swap to update session logger; actual logger used stale plan data.
Root cause hypothesis: Dashboard swap refreshed local render but did not persist the updated plan into store state used by Session Detail.
Proposed solution: Persist the refreshed plan into store state after swap so Session Detail reads the swapped exercise list.
Acceptance criteria: After swap, starting a session uses the swapped exercise in Session Detail and logging payloads.
Tests/verification: PYTHONPATH=. pytest
Docs to update: None (behavior already implied by swap workflow).

Ralph Wiggum loop state:
- Plan: Persist swapped plan state in Store after swap refresh.
- Chunks: Update dashboard plan load; verify session logger uses updated plan.
- Implement: Completed.
- Run checks: Completed (PYTHONPATH=. pytest).
- Evaluate: Swap now refreshes Store so Session Detail reflects updated exercises.
- Fix: None needed.

## Issue 3 Record
Issue ID: 3
Title: Swap exercise needed at plan-level
Summary: Plan Summary lacked a way to swap exercises before plan activation.
Scope: UI + state
Screens/flows affected: Plan Summary
Specs referenced: UI_SCREENS.md, SYSTEM_SUMMARY.md
Expected vs actual: Expected plan-level swap to be available before accepting the plan; actual flow only allowed swaps from the dashboard.
Root cause hypothesis: Plan Summary UI did not expose swap controls or swap option modal.
Proposed solution: Add swap buttons and a swap modal in Plan Summary, backed by existing swap endpoints.
Acceptance criteria: Users can swap an exercise in Plan Summary and see the updated plan before acceptance.
Tests/verification: PYTHONPATH=. pytest
Docs to update: None (swap functionality already implied in plan summary actions).

Ralph Wiggum loop state:
- Plan: Add plan-level swap controls and modal to Plan Summary.
- Chunks: Add modal markup; wire swap handlers; refresh plan after swap.
- Implement: Completed.
- Run checks: Completed (PYTHONPATH=. pytest).
- Evaluate: Plan Summary swaps refresh the displayed exercise list.
- Fix: None needed.
