# System Summary

## What this app does
- Provides a minimal workout app focused on logging workout sessions, sets, and exercises, and reviewing history per exercise.
- Generates simple, rules-based progression recommendations (e.g., weight increases or deloads) using logged set performance and recent trends.
- Uses a short intake questionnaire to capture goals, experience, schedule, equipment, and constraints, then generates and stores a multi-week plan.
- Offers a guided, step-by-step questionnaire flow with validation, navigation (Next/Back/Skip), and a confirmation summary.
- Stores core workout, plan, and questionnaire data using a defined data model and exposes basic API endpoints for sessions, exercises, progression recommendations, and plans.

## What this app explicitly does not do
- It does not include an advanced “engine” for multi-week periodization, muscle-group volume balancing, or complex schedule resolution.
- It does not automatically accommodate injuries or constraints with sophisticated exercise substitutions while preserving stimulus beyond simple rules-based filtering.

## Core constraints and assumptions
- Progression is rules-based with fixed rep targets (6–12), RIR expectations, and weight increment rules that depend on lift type and available plates.
- Advancing weight requires completion of all prescribed sets and meeting target reps without form breaks, with deload rules for repeated misses.
- The system assumes workouts are logged per session and that progression decisions are based on those logs (including user-confirmed completion and effort).
- Questionnaire inputs (goals, experience, schedule, equipment, injuries/constraints) are required to generate plans and guide recommendations.
- The MVP is designed around simple, explicit flows and data entries rather than automated sensor-driven or inference-heavy logic.
