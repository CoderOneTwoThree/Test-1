# Multi-Agent Implementation Workflow

## Roles and outputs
- **Builder**: implements planned changes in code and docs; produces a working patch and implementation notes.
- **Reviewer**: reviews changes for correctness, style, and spec alignment; produces review findings and required fixes.
- **Tester**: runs automated checks and reports results; produces a test report with command outputs and pass/fail status.
- **Spec-Guardian**: validates changes against written specs and flags mismatches; produces a spec-consistency report with references.
- **Refactorer**: improves structure or readability without changing behavior; produces a refactor diff summary and justification.

## Ralph Wiggum loop
**Exact sequence:** plan → break task into chunks → implement → run checks → evaluate → fix → repeat.

**Stop conditions (done means):**
- All required automated checks pass.
- Spec-Guardian reports zero mismatches.
- Reviewer has no blocking findings.
- Scope matches the single stated concern for the PR.
- Artifacts are complete: patch, test report, spec-consistency report, review findings.

## Stop-hook rule
**Must continue iterating (do not stop):**
- Any failing automated check.
- Any spec mismatch or unresolved spec ambiguity.
- Any lint or formatting error.
- Reviewer or Spec-Guardian reports a blocking issue.

**Must stop and escalate to a human:**
- Ambiguous or conflicting requirements with no authoritative source.
- Missing dependencies, credentials, or external resources required to proceed.
- Conflicting documents where source of truth cannot be determined.
- Required checks are impossible to run in the environment.

## PR protocol
- **One concern per PR:** each PR addresses a single, clearly stated objective.
- **Naming:** `concern/<short-kebab-description>`.
- **Required checks:** all automated checks listed in Verification Gates must pass.
- **Feedback incorporation:** every review round must update the plan and re-run checks; fixes are added as new iterations of the Ralph Wiggum loop.

## Verification gates
**Automated checks (required before merge):**
- Run the repository's standard test suite.
- Run formatting and linting tools configured for the repo.
- Run any build or type-check steps defined by the repo.

**Spec-consistency checks (required before merge):**
- Verify changes align with TARGETS, PROGRESSION_RULES, and SYSTEM_SUMMARY.
- Confirm any new behavior is reflected in relevant docs (e.g., PLAN_GENERATION_LOGIC, UX_QA_FLOW).

## Change-control
- **Source of truth:** written specs (TARGETS, PROGRESSION_RULES, SYSTEM_SUMMARY) are authoritative.
- **When specs conflict:** pause implementation and escalate to a human for resolution.
- **When code contradicts specs:** update code to match specs; only update specs with explicit approval.
- **When docs lag behavior:** update documentation in the same PR if the behavior is intentionally changed and approved.
