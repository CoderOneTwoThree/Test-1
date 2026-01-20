# Failure Modes

Top 10 realistic ways this workout app could give bad advice or mislead users, with likely causes and simple MVP mitigations.

1. **Noisy or inaccurate sensor data**
   - **Why it happens:** Wearable devices and phone sensors can misread heart rate, reps, or movement quality due to poor placement, loose straps, or device limitations.
   - **MVP mitigation:** Add a “data confidence” badge and prompt users to confirm or edit key metrics when readings look inconsistent with recent history.

2. **Skipped or partially completed sessions**
   - **Why it happens:** Users may miss workouts, stop early, or skip sets but the app assumes full completion.
   - **MVP mitigation:** Require a quick end-of-session confirmation checklist (completed, partial, skipped) before logging results.

3. **Ego lifting / inflated self-reported weights**
   - **Why it happens:** Users overstate lifted weight or reps, intentionally or unintentionally, to appear stronger or due to memory errors.
   - **MVP mitigation:** Add a “felt difficulty” (RPE) slider and flag mismatches between reported weight and recent RPE trends.

4. **Inconsistent logging (missing sets, exercises, or rest times)**
   - **Why it happens:** Users log only highlights or forget accessory work, leading to incomplete training history.
   - **MVP mitigation:** Provide a quick “auto-fill” from last session and nudge users to confirm or mark skipped items.

5. **Poor exercise form not captured**
   - **Why it happens:** The app infers progress from numbers only, missing form breakdowns that make a lift unsafe.
   - **MVP mitigation:** Add a weekly form check-in prompt (self-rated) with a reminder to deload if form worsened.

6. **Unrealistic progression recommendations**
   - **Why it happens:** The app assumes linear progress, ignoring plateaus, fatigue, or recovery deficits.
   - **MVP mitigation:** Cap weekly load increases and require a recovery check-in before advancing targets.

7. **One-size-fits-all advice ignoring individual constraints**
   - **Why it happens:** Generic programming does not account for age, injury history, equipment access, or schedule.
   - **MVP mitigation:** Ask for a minimal constraints profile (injuries, equipment, days/week) and filter recommendations accordingly.

8. **Misleading calorie burn or intensity estimates**
   - **Why it happens:** Calorie formulas are broad averages and can overestimate for many users.
   - **MVP mitigation:** Display calorie ranges (low/likely/high) and a note that estimates are approximate.

9. **Overemphasis on short-term trends**
   - **Why it happens:** Day-to-day fluctuations in weight or performance can be interpreted as true progress or regression.
   - **MVP mitigation:** Use 7-day rolling averages and show trend lines instead of single-session deltas.

10. **Ignoring recovery signals**
   - **Why it happens:** The app focuses on performance metrics and misses sleep, soreness, or stress indicators.
   - **MVP mitigation:** Add a simple readiness prompt (sleep, soreness, stress) and reduce recommended intensity when low.
