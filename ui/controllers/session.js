import { normalizePlanData } from "../js/plan-utils.js";
import { ViewManager } from "../js/view-manager.js";

class SessionController {
  constructor({ store, viewManager } = {}) {
    this.store = store;
    this.viewManager = viewManager ?? new ViewManager();
    this.root = document.querySelector('[data-screen-id="session_detail"]');
    this.statusAlert = document.querySelector("[data-session-status]");
    this.startingWeightPanel = document.querySelector(
      "[data-starting-weight-panel]",
    );
    this.startingWeightList = document.querySelector(
      "[data-starting-weight-list]",
    );
    this.startingWeightGuidance = document.querySelector(
      "[data-starting-weight-guidance]",
    );
    this.exerciseGrid = document.querySelector("[data-session-exercises]");
    this.saveButton = document.querySelector("[data-save-session]");
    this.skipToggle = document.querySelector("[data-skip-session]");
    this.defaultSaveLabel = this.saveButton?.textContent ?? "Save Session";
    this.planData = null;
    this.activeSession = null;
    this.exercises = [];
    this.recommendations = new Map();
    this.missingExercises = new Set();
    this.recommendationFailures = new Set();
    this.draftKey = "ui.sessionDraft";
    this.draftState = null;
    this.isSaving = false;
    this.isReadOnly = false;
    this.isSkipping = false;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadSession();
    window.addEventListener("session:started", () => {
      this.loadSession();
    });
  }

  bindEvents() {
    if (this.saveButton) {
      this.saveButton.addEventListener("click", () => {
        this.handleSave();
      });
    }

    if (this.skipToggle) {
      this.skipToggle.addEventListener("change", () => {
        this.handleSkipToggle();
      });
    }

    if (this.root) {
      this.root.addEventListener("click", (event) => {
        if (this.isReadOnly) {
          return;
        }
        const addButton = event.target.closest("[data-add-set]");
        if (!addButton) {
          return;
        }
        const card = addButton.closest("[data-exercise-card]");
        if (!card) {
          return;
        }
        const index = Number(card.dataset.exerciseIndex ?? -1);
        if (!Number.isInteger(index) || index < 0) {
          return;
        }
        const exercise = this.exercises[index];
        const setList = card.querySelector("[data-set-list]");
        if (!exercise || !setList) {
          return;
        }
        this.addSetRow(setList, exercise, this.getSetDefaults(exercise));
      });
    }

    if (this.root) {
      this.root.addEventListener("input", () => {
        if (this.isReadOnly) {
          return;
        }
        this.persistDraft();
      });
      this.root.addEventListener("change", () => {
        if (this.isReadOnly) {
          return;
        }
        this.persistDraft();
      });
    }

    if (this.startingWeightPanel) {
      this.startingWeightPanel.addEventListener("input", (event) => {
        if (this.isReadOnly) {
          return;
        }
        const input = event.target.closest("[data-starting-weight-input]");
        if (!input) {
          return;
        }
        const exerciseId = Number(input.dataset.exerciseId ?? 0);
        if (!Number.isFinite(exerciseId) || exerciseId <= 0) {
          return;
        }
        const rawValue = input.value ?? "";
        if (rawValue === "") {
          this.applyStartingWeight(exerciseId, null);
          return;
        }
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return;
        }
        this.applyStartingWeight(exerciseId, parsed);
      });
    }
  }

  async loadSession() {
    this.activeSession = this.store.getActiveSession();
    if (!this.activeSession) {
      this.setStatus("Session missing. Return to dashboard.", true);
      return;
    }
    this.isReadOnly = Boolean(this.activeSession?.readOnly);
    if (this.skipToggle) {
      this.skipToggle.checked = false;
    }
    this.isSkipping = false;
    this.draftState = this.loadDraft();

    await this.loadPlanData();
    if (!this.planData) {
      this.setStatus("Session plan missing. Sync required.", true);
      return;
    }

    const workout = this.findWorkout();
    if (!workout) {
      this.setStatus("Session workout missing. Sync required.", true);
      return;
    }

    this.exercises = Array.isArray(workout.exercises) ? workout.exercises : [];
    if (!this.exercises.length) {
      this.setStatus("Session exercises missing.", true);
      return;
    }

    await this.loadRecommendations();
    this.renderExercises();
    this.renderStartingWeightPrompt();
    this.applyReadOnlyState();
    if (this.missingExercises.size > 0 && !this.isReadOnly) {
      this.setStatus("Exercise ID missing. Sync required.", true);
      return;
    }
    if (this.isReadOnly) {
      this.setStatus("Read-only view. Session locked.", false);
      return;
    }
    if (this.recommendationFailures.size > 0) {
      this.setStatus(
        "Recommendations unavailable. You can still log this session.",
        false,
      );
      return;
    }
    this.setStatus("Session ready for logging.", false);
  }

  async loadPlanData() {
    const { currentPlan } = this.store.getState();
    if (currentPlan) {
      this.planData = normalizePlanData(currentPlan);
      return;
    }

    const planId =
      this.store.getActivePlanId?.() ??
      this.activeSession?.plan_id ??
      this.activeSession?.planId ??
      null;
    if (!planId) {
      this.planData = null;
      return;
    }

    try {
      const response = await fetch(`/plans/${planId}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Plan request failed");
      }
      const payload = await response.json();
      this.planData = normalizePlanData(payload);
    } catch (error) {
      this.planData = null;
    }
  }

  findWorkout() {
    if (!this.planData) {
      return null;
    }
    const dayIndex = Number(
      this.activeSession?.day_index ?? this.activeSession?.dayIndex ?? 0,
    );
    return (
      this.planData.workouts?.find(
        (workout) => Number(workout.day_index) === dayIndex,
      ) ?? null
    );
  }

  async loadRecommendations() {
    this.recommendations = new Map();
    this.missingExercises = new Set();
    this.recommendationFailures = new Set();
    const userId = Number(
      this.store.getState()?.onboardingData?.user_id ?? 1,
    );
    const recommendationTasks = this.exercises.map(async (exercise) => {
      if (!exercise.exercise_id) {
        this.missingExercises.add(
          exercise.sequence ?? exercise.name ?? "Exercise",
        );
        return;
      }
      try {
        const response = await fetch(
          `/progression/recommendations?user_id=${userId}&exercise_id=${exercise.exercise_id}`,
        );
        if (!response.ok) {
          this.recommendationFailures.add(
            exercise.name ?? exercise.exercise_id,
          );
          return;
        }
        const payload = await response.json();
        if (!payload) {
          this.recommendationFailures.add(
            exercise.name ?? exercise.exercise_id,
          );
          return;
        }
        this.recommendations.set(exercise.exercise_id, payload);
      } catch (error) {
        this.recommendationFailures.add(
          exercise.name ?? exercise.exercise_id,
        );
        return;
      }
    });

    await Promise.all(recommendationTasks);
    if (this.saveButton) {
      this.saveButton.disabled =
        this.missingExercises.size > 0 || this.isReadOnly;
    }
  }

  renderExercises() {
    if (!this.exerciseGrid) {
      return;
    }
    this.exerciseGrid.innerHTML = "";

    this.exercises.forEach((exercise, index) => {
      const setDefaults = this.getSetDefaults(exercise);
      const card = document.createElement("div");
      card.className = "panel exercise-card";
      card.dataset.exerciseCard = "true";
      card.dataset.exerciseIndex = String(index);
      if (exercise.exercise_id) {
        card.dataset.exerciseId = String(exercise.exercise_id);
      }
      if (exercise.category) {
        card.dataset.category = exercise.category;
      }
      const plannedSets = exercise.target_sets ?? "-";
      const repsRange =
        exercise.target_reps_min && exercise.target_reps_max
          ? `${exercise.target_reps_min}-${exercise.target_reps_max}`
          : "-";
      const targetLabel = this.formatTarget(exercise);
      card.innerHTML = `
        <div class="session-row">
          <div class="session-row__details">
            <span class="session-row__name">${exercise.name}</span>
            <span class="session-row__meta">Planned: ${plannedSets} sets | Reps: ${repsRange}</span>
          </div>
          <button class="action" type="button" data-add-set>
            Add Set
          </button>
        </div>
        <p class="panel__note" data-target>${targetLabel}</p>
        <div class="grid-stack" data-set-list></div>
      `;

      const setList = card.querySelector("[data-set-list]");
      if (setList) {
        const draftSets = this.getDraftSets(exercise);
        if (draftSets.length) {
          setList.innerHTML = "";
          draftSets.forEach((draftSet) => {
            const row = this.addSetRow(setList, exercise, setDefaults);
            this.applyDraftToRow(row, draftSet);
          });
        } else {
          const targetSets = this.getTargetSetCount(exercise);
          for (let setIndex = 0; setIndex < targetSets; setIndex += 1) {
            this.addSetRow(setList, exercise, setDefaults);
          }
        }
      }

      this.exerciseGrid.appendChild(card);
    });
  }

  renderStartingWeightPrompt() {
    if (!this.startingWeightPanel || !this.startingWeightList) {
      return;
    }
    const exercisesNeedingWeight = this.exercises.filter((exercise) =>
      this.needsStartingWeightPrompt(exercise),
    );
    if (!exercisesNeedingWeight.length || this.isReadOnly) {
      this.startingWeightPanel.classList.add("screen--hidden");
      return;
    }

    this.startingWeightPanel.classList.remove("screen--hidden");
    this.startingWeightList.innerHTML = exercisesNeedingWeight
      .map(
        (exercise) => `
          <div class="panel">
            <div class="session-row">
              <div class="session-row__details">
                <span class="session-row__name">${exercise.name}</span>
                <span class="session-row__meta">Enter a starting weight for this lift.</span>
              </div>
            </div>
            <label class="field">
              Starting weight (lb)
              <input
                type="number"
                inputmode="decimal"
                min="0"
                step="0.5"
                data-starting-weight-input
                data-exercise-id="${exercise.exercise_id ?? ""}"
                placeholder="lb"
              />
            </label>
          </div>
        `,
      )
      .join("");

    this.updateStartingWeightGuidance();
  }

  updateStartingWeightGuidance() {
    if (!this.startingWeightGuidance) {
      return;
    }
    const experience = String(this.planData?.experience_level ?? "").toLowerCase();
    if (experience === "beginner") {
      this.startingWeightGuidance.textContent =
        "Beginner tip: choose a weight you can lift for about 6 reps with 2–3 reps in reserve, then log your best effort for the first set.";
      this.startingWeightGuidance.classList.remove("panel__alert--hidden");
      return;
    }
    this.startingWeightGuidance.textContent = "";
    this.startingWeightGuidance.classList.add("panel__alert--hidden");
  }

  needsStartingWeightPrompt(exercise) {
    if (!exercise) {
      return false;
    }
    const hasStartingWeight =
      exercise.starting_weight !== null && exercise.starting_weight !== undefined;
    if (hasStartingWeight) {
      return false;
    }
    const recommendation = this.recommendations.get(exercise.exercise_id);
    const recommendedWeight =
      recommendation?.next_weight ?? recommendation?.nextWeight ?? null;
    if (exercise.is_initial_load) {
      return true;
    }
    return recommendedWeight === null || recommendedWeight === undefined;
  }

  applyStartingWeight(exerciseId, weight) {
    const exercise = this.exercises.find(
      (entry) => Number(entry.exercise_id) === Number(exerciseId),
    );
    if (!exercise) {
      return;
    }
    exercise.starting_weight = weight;
    this.persistStartingWeight(exerciseId, weight);
    this.updateExerciseCard(exercise);
    this.renderStartingWeightPrompt();
  }

  persistStartingWeight(exerciseId, weight) {
    const { currentPlan } = this.store.getState();
    if (!currentPlan) {
      return;
    }
    if (!Array.isArray(currentPlan.workouts)) {
      return;
    }
    const updatedPlan = {
      ...currentPlan,
      workouts: currentPlan.workouts.map((workout) => ({
        ...workout,
        exercises: Array.isArray(workout.exercises)
          ? workout.exercises.map((entry) => {
              if (Number(entry.exercise_id) !== Number(exerciseId)) {
                return entry;
              }
              return { ...entry, starting_weight: weight };
            })
          : workout.exercises,
      })),
    };
    this.store.setCurrentPlan(updatedPlan);
  }

  updateExerciseCard(exercise) {
    if (!this.exerciseGrid || !exercise) {
      return;
    }
    const card = this.exerciseGrid.querySelector(
      `[data-exercise-id="${exercise.exercise_id}"]`,
    );
    if (!card) {
      return;
    }
    const target = card.querySelector("[data-target]");
    if (target) {
      target.textContent = this.formatTarget(exercise);
    }
    if (exercise.starting_weight === null || exercise.starting_weight === undefined) {
      return;
    }
    card.querySelectorAll('[data-field="weight"]').forEach((input) => {
      if ((input?.value ?? "") === "") {
        input.value = String(exercise.starting_weight);
      }
    });
  }

  applyReadOnlyState() {
    if (!this.root) {
      return;
    }
    const shouldDisable = this.isReadOnly;
    this.root
      .querySelectorAll("input, textarea, select, button[data-add-set]")
      .forEach((field) => {
        field.disabled = shouldDisable;
      });
    if (this.saveButton) {
      this.saveButton.disabled =
        shouldDisable || this.missingExercises.size > 0;
      this.saveButton.textContent = shouldDisable
        ? "Read Only"
        : this.defaultSaveLabel;
    }
  }

  formatTarget(exercise) {
    const recommendation = this.recommendations.get(exercise.exercise_id);
    if (!recommendation) {
      return "Target: sync required";
    }
    const repRange = recommendation?.rep_range ?? recommendation?.repRange ?? null;
    const repMin = Array.isArray(repRange) ? repRange[0] : null;
    const repMax = Array.isArray(repRange) ? repRange[1] : null;
    const repsLabel =
      repMin && repMax ? (repMin === repMax ? `${repMin}` : `${repMin}-${repMax}`) :
      exercise.target_reps_min && exercise.target_reps_max
        ? `${exercise.target_reps_min}-${exercise.target_reps_max}`
        : "-";
    const weightValue =
      recommendation?.next_weight ??
      recommendation?.nextWeight ??
      exercise.starting_weight ??
      null;
    const weightLabel =
      weightValue === null || weightValue === undefined
        ? "Target unavailable"
        : `${weightValue} lb`;
    if (weightLabel === "Target unavailable") {
      return `Target: ${weightLabel}`;
    }
    return `Target: ${weightLabel} x ${repsLabel}`;
  }

  addSetRow(setList, exercise, defaults = {}) {
    const setNumber = setList.querySelectorAll("[data-set-row]").length + 1;
    const row = document.createElement("div");
    row.className = "panel session-set";
    row.dataset.setRow = "true";
    row.dataset.setNumber = String(setNumber);
    row.innerHTML = `
      <div class="session-row">
        <div class="session-row__details">
          <span class="session-row__name">Set ${setNumber}</span>
          <span class="session-row__meta">Input required.</span>
        </div>
      </div>
      <div class="grid-stack grid-stack--two">
        <label class="field">
          Weight (lb)
          <input
            type="number"
            inputmode="decimal"
            min="0"
            step="0.5"
            data-field="weight"
            placeholder="lb"
          />
        </label>
        <label class="field">
          Reps (1-100)
          <input
            type="number"
            inputmode="numeric"
            min="1"
            max="100"
            step="1"
            data-field="reps"
            placeholder="reps"
          />
        </label>
        <label class="checkbox">
          <input type="checkbox" data-set-complete />
          Complete
        </label>
        <label class="field">
          RPE (1-10)
          <input
            type="number"
            inputmode="decimal"
            min="1"
            max="10"
            step="0.5"
            data-field="rpe"
            placeholder="rpe"
          />
        </label>
        <label class="field">
          Rest (sec)
          <input
            type="number"
            inputmode="numeric"
            min="1"
            step="1"
            data-field="rest"
            placeholder="sec"
          />
        </label>
        <label class="field">
          <input type="checkbox" data-field="audit" />
          Form Audit
        </label>
      </div>
    `;

    setList.appendChild(row);

    const weightInput = row.querySelector('[data-field="weight"]');
    const repsInput = row.querySelector('[data-field="reps"]');
    if (weightInput && defaults.weight !== null && defaults.weight !== undefined) {
      weightInput.value = String(defaults.weight);
    } else if (this.isBodyweight(exercise) && weightInput && weightInput.value === "") {
      weightInput.value = "0";
    }
    if (repsInput && defaults.reps !== null && defaults.reps !== undefined) {
      repsInput.value = String(defaults.reps);
    }
    this.persistDraft();
    return row;
  }

  isBodyweight(exercise) {
    return String(exercise?.category ?? "").toLowerCase() === "bodyweight";
  }

  getTargetSetCount(exercise) {
    const targetSets = Number(exercise?.target_sets ?? 3);
    if (!Number.isFinite(targetSets) || targetSets <= 0) {
      return 3;
    }
    return Math.floor(targetSets);
  }

  getSetDefaults(exercise) {
    const recommendation = this.recommendations.get(exercise.exercise_id);
    const repRange =
      recommendation?.rep_range ?? recommendation?.repRange ?? null;
    const reps =
      Array.isArray(repRange) && repRange.length > 1
        ? repRange[1]
        : exercise?.target_reps_max ?? null;
    const weight =
      recommendation?.next_weight ??
      recommendation?.nextWeight ??
      exercise?.starting_weight ??
      null;
    return { weight, reps };
  }

  collectSetLogs() {
    const setLogs = [];
    let manualAuditFlag = false;
    const exerciseCompletion = new Map();

    const cards = this.exerciseGrid?.querySelectorAll("[data-exercise-card]") ?? [];
    cards.forEach((card) => {
      const exerciseIndex = Number(card.dataset.exerciseIndex ?? -1);
      const exercise = this.exercises[exerciseIndex];
      if (!exercise) {
        return;
      }
      const setRows = Array.from(card.querySelectorAll("[data-set-row]"));
      const hasLoggedSet = setRows.some((row) => !this.isRowEmpty(row));
      exerciseCompletion.set(exerciseIndex, hasLoggedSet);

      let loggedSetNumber = 0;
      setRows.forEach((row) => {
        if (this.isRowEmpty(row)) {
          return;
        }
        loggedSetNumber += 1;
        const weightInput = row.querySelector('[data-field="weight"]');
        const repsInput = row.querySelector('[data-field="reps"]');
        const rpeInput = row.querySelector('[data-field="rpe"]');
        const restInput = row.querySelector('[data-field="rest"]');
        const auditInput = row.querySelector('[data-field="audit"]');

        const weightRaw = weightInput?.value ?? "";
        const repsRaw = repsInput?.value ?? "";
        const rpeRaw = rpeInput?.value ?? "";
        const restRaw = restInput?.value ?? "";

        const weight = weightRaw === "" ? null : Number(weightRaw);
        const reps = repsRaw === "" ? null : Number(repsRaw);
        const rpe = rpeRaw === "" ? null : Number(rpeRaw);
        const rest = restRaw === "" ? null : Number(restRaw);

        if (auditInput?.checked) {
          manualAuditFlag = true;
        }

        setLogs.push({
          exercise,
          set_number: loggedSetNumber,
          weight,
          reps,
          rpe,
          rest_seconds: rest,
          is_initial_load: Boolean(exercise.is_initial_load) && loggedSetNumber === 1,
        });
      });
    });

    return { setLogs, manualAuditFlag, exerciseCompletion };
  }

  isRowEmpty(row) {
    const weightInput = row.querySelector('[data-field="weight"]');
    const repsInput = row.querySelector('[data-field="reps"]');
    const rpeInput = row.querySelector('[data-field="rpe"]');
    const restInput = row.querySelector('[data-field="rest"]');
    const auditInput = row.querySelector('[data-field="audit"]');
    const completeInput = row.querySelector("[data-set-complete]");
    return (
      (weightInput?.value ?? "") === "" &&
      (repsInput?.value ?? "") === "" &&
      (rpeInput?.value ?? "") === "" &&
      (restInput?.value ?? "") === "" &&
      !auditInput?.checked &&
      !completeInput?.checked
    );
  }

  handleSkipToggle() {
    this.isSkipping = Boolean(this.skipToggle?.checked);
    if (this.exerciseGrid) {
      this.exerciseGrid
        .querySelectorAll("input, textarea, select, button[data-add-set]")
        .forEach((field) => {
          field.disabled = this.isSkipping;
        });
    }
    if (this.saveButton) {
      this.saveButton.disabled =
        this.isReadOnly ||
        this.missingExercises.size > 0;
    }
    if (this.isSkipping) {
      this.setStatus("Skipped session selected. No sets will be logged.", false);
    } else if (!this.isReadOnly) {
      this.setStatus("Session ready for logging.", false);
    }
  }

  validateSets(setLogs) {
    for (const entry of setLogs) {
      const { exercise, weight, reps, rpe, rest_seconds: restSeconds } = entry;
      if (
        reps === null ||
        !Number.isFinite(reps) ||
        !Number.isInteger(reps) ||
        reps < 0 ||
        reps > 100
      ) {
        this.setStatus("Invalid Reps: Must be 0-100", true);
        return false;
      }
      if (rpe !== null) {
        if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
          this.setStatus("Invalid RPE: Must be 0-10", true);
          return false;
        }
      }
      if (restSeconds !== null) {
        if (!Number.isFinite(restSeconds) || restSeconds < 0) {
          this.setStatus("Invalid Rest: Must be 0 or greater", true);
          return false;
        }
      }

      const isBodyweight = this.isBodyweight(exercise);
      if (weight === null || !Number.isFinite(weight) || weight < 0) {
        this.setStatus("Weight Required.", true);
        return false;
      }
    }
    return true;
  }

  async handleSave() {
    if (!this.exerciseGrid) {
      return;
    }

    if (this.isReadOnly) {
      this.setStatus("Read-only view. Session locked.", true);
      return;
    }

    if (this.isSaving) {
      return;
    }

    if (this.missingExercises.size > 0) {
      this.setStatus("Exercise ID missing. Sync required.", true);
      return;
    }

    if (this.isSkipping) {
      if (!this.skipToggle?.checked) {
        this.setStatus("Skipped session requires confirmation.", true);
        return;
      }
      await this.saveSessionPayload({
        user_id: Number(this.store.getState()?.onboardingData?.user_id ?? 1),
        performed_at: new Date().toISOString(),
        duration_minutes: null,
        notes: null,
        completion_status: "skipped",
        template_id:
          this.activeSession?.template_id ?? this.activeSession?.templateId ?? null,
        plan_id:
          this.activeSession?.plan_id ?? this.activeSession?.planId ?? null,
        day_index:
          this.activeSession?.day_index ?? this.activeSession?.dayIndex ?? null,
        set_logs: [],
        manual_audit_flag: false,
      });
      return;
    }

    const { setLogs, manualAuditFlag, exerciseCompletion } = this.collectSetLogs();

    if (!setLogs.length) {
      this.setStatus(
        "No sets logged. Log at least one set or mark as skipped.",
        true,
      );
      return;
    }

    if (!this.validateSets(setLogs)) {
      return;
    }

    const allExercisesLogged = this.exercises.every((_, index) =>
      exerciseCompletion.get(index),
    );
    const completionStatus = allExercisesLogged ? "completed" : "partial";

    const payload = {
      user_id: Number(this.store.getState()?.onboardingData?.user_id ?? 1),
      performed_at: new Date().toISOString(),
      duration_minutes: null,
      notes: null,
      completion_status: completionStatus,
      template_id:
        this.activeSession?.template_id ?? this.activeSession?.templateId ?? null,
      manual_audit_flag: manualAuditFlag,
      plan_id:
        this.activeSession?.plan_id ?? this.activeSession?.planId ?? null,
      day_index:
        this.activeSession?.day_index ?? this.activeSession?.dayIndex ?? null,
      set_logs: setLogs.map((entry) => ({
        exercise_id: entry.exercise.exercise_id,
        set_number: entry.set_number,
        reps: entry.reps,
        weight: entry.weight,
        rpe: entry.rpe,
        rest_seconds: entry.rest_seconds,
        is_initial_load: entry.is_initial_load,
      })),
    };

    if (payload.set_logs.some((entry) => !entry.exercise_id)) {
      this.setStatus("Exercise ID missing. Sync required.", true);
      return;
    }

    await this.saveSessionPayload(payload);
  }

  async saveSessionPayload(payload) {
    try {
      this.isSaving = true;
      if (this.saveButton) {
        this.saveButton.disabled = true;
      }
      this.setStatus("Payload sent to backend.", false);
      const response = await fetch("/workouts/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Session save failed");
      }
      this.store.setActiveSession(null);
      this.clearDraft();
      if (this.skipToggle) {
        this.skipToggle.checked = false;
      }
      this.isSkipping = false;
      this.setStatus("Session persisted to SQLite.", false);
      window.dispatchEvent(
        new CustomEvent("session:saved", {
          detail: {
            performed_at: payload?.performed_at ?? new Date().toISOString(),
            completion_status: payload?.completion_status ?? "completed",
            plan_id:
              this.activeSession?.plan_id ?? this.activeSession?.planId ?? null,
            day_index:
              this.activeSession?.day_index ?? this.activeSession?.dayIndex ?? null,
          },
        }),
      );
      this.viewManager.show("dashboard");
    } catch (error) {
      this.setStatus(
        `Payload NOT persisted: ${error?.message ?? "Unknown error"}`,
        true,
      );
    } finally {
      this.isSaving = false;
      if (this.saveButton) {
        this.saveButton.disabled =
          this.missingExercises.size > 0 || this.isReadOnly;
      }
    }
  }

  loadDraft() {
    if (!this.activeSession) {
      return null;
    }
    const raw = localStorage.getItem(this.draftKey);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }
      if (parsed.session_id !== this.activeSession.id) {
        return null;
      }
      return parsed;
    } catch (error) {
      return null;
    }
  }

  getDraftSets(exercise) {
    const draft = this.draftState;
    if (!draft || !draft.exercises) {
      return [];
    }
    const exerciseId = String(exercise.exercise_id ?? "");
    const sets = draft.exercises[exerciseId];
    return Array.isArray(sets) ? sets : [];
  }

  applyDraftToRow(row, draftSet) {
    if (!row || !draftSet) {
      return;
    }
    const weightInput = row.querySelector('[data-field="weight"]');
    const repsInput = row.querySelector('[data-field="reps"]');
    const rpeInput = row.querySelector('[data-field="rpe"]');
    const restInput = row.querySelector('[data-field="rest"]');
    const auditInput = row.querySelector('[data-field="audit"]');
    const completeInput = row.querySelector("[data-set-complete]");

    if (weightInput && draftSet.weight !== null && draftSet.weight !== undefined) {
      weightInput.value = String(draftSet.weight);
    }
    if (repsInput && draftSet.reps !== null && draftSet.reps !== undefined) {
      repsInput.value = String(draftSet.reps);
    }
    if (rpeInput && draftSet.rpe !== null && draftSet.rpe !== undefined) {
      rpeInput.value = String(draftSet.rpe);
    }
    if (restInput && draftSet.rest_seconds !== null && draftSet.rest_seconds !== undefined) {
      restInput.value = String(draftSet.rest_seconds);
    }
    if (auditInput) {
      auditInput.checked = Boolean(draftSet.manual_audit_flag);
    }
    if (completeInput) {
      completeInput.checked = Boolean(draftSet.set_complete);
    }
  }

  persistDraft() {
    if (!this.activeSession || !this.exerciseGrid) {
      return;
    }
    const draft = {
      session_id: this.activeSession.id ?? null,
      exercises: {},
    };
    const cards = this.exerciseGrid.querySelectorAll("[data-exercise-card]");
    cards.forEach((card) => {
      const exerciseIndex = Number(card.dataset.exerciseIndex ?? -1);
      const exercise = this.exercises[exerciseIndex];
      if (!exercise?.exercise_id) {
        return;
      }
      const sets = Array.from(card.querySelectorAll("[data-set-row]")).map(
        (row) => {
          const weightInput = row.querySelector('[data-field="weight"]');
          const repsInput = row.querySelector('[data-field="reps"]');
          const rpeInput = row.querySelector('[data-field="rpe"]');
          const restInput = row.querySelector('[data-field="rest"]');
          const auditInput = row.querySelector('[data-field="audit"]');
          const completeInput = row.querySelector("[data-set-complete]");
          const weightRaw = weightInput?.value ?? "";
          const repsRaw = repsInput?.value ?? "";
          const rpeRaw = rpeInput?.value ?? "";
          const restRaw = restInput?.value ?? "";
          return {
            weight: weightRaw === "" ? null : Number(weightRaw),
            reps: repsRaw === "" ? null : Number(repsRaw),
            rpe: rpeRaw === "" ? null : Number(rpeRaw),
            rest_seconds: restRaw === "" ? null : Number(restRaw),
            manual_audit_flag: Boolean(auditInput?.checked),
            set_complete: Boolean(completeInput?.checked),
          };
        },
      );
      draft.exercises[String(exercise.exercise_id)] = sets;
    });
    localStorage.setItem(this.draftKey, JSON.stringify(draft));
    this.draftState = draft;
  }

  clearDraft() {
    localStorage.removeItem(this.draftKey);
    this.draftState = null;
  }

  setStatus(message, isError) {
    if (!this.statusAlert) {
      return;
    }
    this.statusAlert.textContent = message;
    this.statusAlert.classList.remove("panel__alert--hidden");
    this.statusAlert.classList.toggle("panel__alert--error", isError);
  }
}

export { SessionController };
