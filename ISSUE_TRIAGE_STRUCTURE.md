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
