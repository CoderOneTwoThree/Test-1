# Architecture Decisions

## Product
1. Who is the primary user persona for this architecture, and what is their top success metric?
2. What is the minimum feature set required for a viable first release?

## Data
3. What core in-app or user-generated data must we store for the MVP (e.g., workouts, exercises, progress), and how frequently does it change?
4. What user data can be deleted, when, and how?

## Progression logic
5. What criteria determine when a user advances to the next stage?
6. How should the system handle regressions or setbacks in user progress?

## Plan generation
7. What inputs (constraints, preferences, goals) are required to generate a plan?
8. How should the system prioritize or rank candidate plan steps?

## Non-functional
9. What are the target performance and scalability requirements (latency, throughput, concurrency)?
10. What security and privacy controls (auth, access, encryption) are mandatory?
11. How will users access the app (web, native mobile, hybrid), and what constraints does that impose?
