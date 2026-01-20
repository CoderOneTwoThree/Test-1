# UI Screens (MVP)

## 1) Welcome / Entry
- **Primary purpose:** Introduce the MVP and start the onboarding flow.
- **Key data shown:** Brief product description, value proposition summary, and a “Get Started” prompt.
- **Primary user actions:** Start onboarding.
- **Navigation in/out:**
  - **In:** First launch, logged-out entry.
  - **Out:** Onboarding / Questionnaire.

## 2) Onboarding / Questionnaire
- **Primary purpose:** Collect user goals, preferences, and baseline information.
- **Key data shown:** Question prompts, progress indicator, current answers.
- **Primary user actions:** Answer questions, move to next/previous question, submit questionnaire.
- **Navigation in/out:**
  - **In:** From Welcome / Entry; from Settings if user re-runs onboarding.
  - **Out:** Plan Summary (after submission).

## 3) Plan Summary
- **Primary purpose:** Present the generated plan at a high level before execution.
- **Key data shown:** Plan overview, schedule summary, key milestones.
- **Primary user actions:** Confirm plan, adjust plan parameters (if supported), proceed to Dashboard.
- **Navigation in/out:**
  - **In:** From Onboarding / Questionnaire.
  - **Out:** Dashboard (on confirmation); Settings (optional adjustments).

## 4) Dashboard / Today
- **Primary purpose:** Show the user’s current day status and next steps.
- **Key data shown:** Today’s session summary, upcoming tasks, progress snapshot.
- **Primary user actions:** Start session, mark tasks complete, view details.
- **Navigation in/out:**
  - **In:** From Plan Summary; from Sessions; from navigation menu.
  - **Out:** Session Detail; Progress; Settings.

## 5) Session Detail / Execution
- **Primary purpose:** Guide the user through the current session or task sequence.
- **Key data shown:** Session steps, exercise/task list, timers or counters (if applicable), completion status.
- **Primary user actions:** Start/stop, mark steps complete, log notes or feedback.
- **Navigation in/out:**
  - **In:** From Dashboard / Today.
  - **Out:** Dashboard / Today (on completion); Progress (optional review).

## 6) Progress / History
- **Primary purpose:** Provide historical performance and progress tracking.
- **Key data shown:** Completed sessions, streaks, metrics, trends.
- **Primary user actions:** Filter history, drill into a past session.
- **Navigation in/out:**
  - **In:** From Dashboard / Today; from navigation menu.
  - **Out:** Session Detail (historical view); Dashboard / Today.

## 7) Settings / Profile
- **Primary purpose:** Manage account and plan preferences.
- **Key data shown:** Profile info, plan parameters, notification preferences.
- **Primary user actions:** Edit profile, update preferences, re-run onboarding.
- **Navigation in/out:**
  - **In:** From Dashboard / Today; from Plan Summary.
  - **Out:** Dashboard / Today; Onboarding / Questionnaire (if re-run).
