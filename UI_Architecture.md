UI Architecture (MVP)
1. Navigation & State Machine
The UI operates as a Single-Page Application (SPA) managed by a central ViewManager. Navigation is restricted to the transitions defined in UI_SCREENS.md.

Screen Registry

Every screen must have a unique data-screen-id.

welcome

questionnaire

plan_summary

dashboard

session_detail

history

settings

Transition Rules

Forward-only progression: In onboarding, users cannot skip required fields.

State-driven visibility: Only one data-screen-id panel is visible at a time. Transitions are executed via ViewManager.show(screenId).

2. State Management
The UI distinguishes between Transient UI State and Persistent Domain State.

UI Store

A global Store object manages the application state during a session:

currentPlan: The active workout plan object.

activeSession: The set logs for the current workout.

onboardingData: Temporary questionnaire responses before submission.

Persistence Layer

Local: localStorage is used only for caching the current session if the browser refreshes.

Remote: The questionnaire_responses and workout_sessions tables in the SQLite database are the ultimate sources of truth.

3. Component Registry (Brutalist Standards)
To maintain "Jonathan Ive discipline and restraint," all UI elements must use these standardized HTML patterns:

Component	HTML Pattern	Style Rule
Panel	<section class="panel">	Rigid 4px black border, high-density padding.
Primary Action	<button class="action action--primary">	Red background, white text, uppercase, no rounding.
Data Tile	<div class="tile">	Used for selection grids. Background flips to red when selected.
Alert	<div class="panel__alert">	Hidden by default; displayed only for critical validation errors.
4. View-Logic Decoupling
Each screen must be implemented using a Controller Pattern to prevent script bloat.

Directory Structure

ui/controllers/: Logic for handling clicks, validation, and API calls.

ui/templates/: Pure HTML snippets for dynamic elements (e.g., exercise rows).

ui/services/: Wrappers for Fetch API calls to /workouts/sessions, /questionnaire, etc.

Implementation Protocol

Define the Template: Create the HTML structure in index.html using a panel class.

Register the Controller: Add a function in the script to handle inputs and validation for that specific data-screen-id.

Bind the Service: Use a dedicated service function to send/receive data from the Python backend.

5. Validation & Feedback Rules
Interventionist Validation: Required questions block the "Next" action immediately.

Austerity in Success: Do not use "Good job" or "Congratulations." Use concrete status updates like "Payload sent to backend" or "Session Saved".

Failure Visibility: Call out errors directly with high-contrast red alerts.
