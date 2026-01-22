import {
  DAY_LABELS,
  formatDateLabel,
  getWeekdayIndex,
  normalizePlanData,
  parseIsoDate,
} from "../js/plan-utils.js";
import { ViewManager } from "../js/view-manager.js";

class DashboardController {
  constructor({ store, viewManager } = {}) {
    this.store = store;
    this.viewManager = viewManager ?? new ViewManager();
    this.root = document.querySelector('[data-screen-id="dashboard"]');
    this.statusAlert = document.querySelector("[data-dashboard-status]");
    this.todayPanel = document.querySelector("[data-today-summary]");
    this.sessionList = document.querySelector("[data-session-snapshot]");
    this.startButton = document.querySelector("[data-start-session]");
    this.swapModal = document.querySelector("[data-swap-modal]");
    this.swapList = document.querySelector("[data-swap-options]");
    this.swapStatus = document.querySelector("[data-swap-status]");
    this.swapClose = document.querySelector("[data-swap-close]");
    this.planData = null;
    this.currentWorkout = null;
    this.currentDayIndex = null;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadPlan();
    window.addEventListener("plan:accepted", () => {
      this.loadPlan();
    });
  }

  bindEvents() {
    if (this.startButton) {
      this.startButton.addEventListener("click", () => {
        this.startSession();
      });
    }

    if (this.swapClose) {
      this.swapClose.addEventListener("click", () => {
        this.closeSwapModal();
      });
    }

    document.addEventListener("click", (event) => {
      const swapButton = event.target.closest("[data-swap]");
      if (!swapButton) {
        return;
      }
      const dayIndex = Number(swapButton.dataset.dayIndex);
      const sequence = Number(swapButton.dataset.sequence);
      this.openSwapModal(dayIndex, sequence);
    });

    document.addEventListener("click", (event) => {
      const optionButton = event.target.closest("[data-swap-option]");
      if (!optionButton) {
        return;
      }
      const exerciseId = Number(optionButton.dataset.exerciseId);
      const dayIndex = Number(optionButton.dataset.dayIndex);
      const sequence = Number(optionButton.dataset.sequence);
      this.applySwap(dayIndex, sequence, exerciseId);
    });
  }

  async loadPlan() {
    const { currentPlan, pendingPlanId } = this.store.getState();
    const planId =
      this.store.getActivePlanId() ?? currentPlan?.id ?? pendingPlanId ?? null;
    if (!planId) {
      this.setStatus("No plan on file. Accept a plan first.", true);
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
      if (!this.planData) {
        throw new Error("Plan data unavailable");
      }
      this.renderToday(this.planData);
      this.setStatus("Plan synchronized.", false);
    } catch (error) {
      this.setStatus(
        `Plan fetch failed: ${error?.message ?? "Unknown error"}`,
        true,
      );
    }
  }

  setStatus(message, isError) {
    if (!this.statusAlert) {
      return;
    }
    this.statusAlert.textContent = message;
    this.statusAlert.classList.remove("panel__alert--hidden");
    this.statusAlert.classList.toggle("panel__alert--error", isError);
  }

  renderToday(plan) {
    const today = new Date();
    const startDate = parseIsoDate(plan.start_date);
    if (!startDate) {
      this.renderNoSession("Start date missing. Plan sync required.");
      return;
    }
    const dayIndex = getWeekdayIndex(today);
    const trainingDays = [...(plan.training_days_of_week ?? [])].sort(
      (a, b) => a - b,
    );
    const isTrainingDay = trainingDays.includes(dayIndex);
    const daysSinceStart = Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceStart < 0) {
      this.renderNoSession(
        `Plan starts ${formatDateLabel(plan.start_date)}.`,
      );
      return;
    }

    if (!isTrainingDay) {
      this.renderNoSession("Rest day. No session scheduled.");
      return;
    }

    const workoutIndex = trainingDays.indexOf(dayIndex);
    const workout = plan.workouts?.[workoutIndex];
    if (!workout) {
      this.renderNoSession("Training day scheduled. Session missing.");
      return;
    }
    this.currentWorkout = workout;
    this.currentDayIndex = dayIndex;

    if (this.todayPanel) {
      this.todayPanel.innerHTML = `
        <div class="tile tile--compact">
          <span class="tile__label">Today</span>
          <span class="tile__value">${DAY_LABELS[dayIndex]}</span>
        </div>
        <div class="tile tile--compact">
          <span class="tile__label">Session Type</span>
          <span class="tile__value">${workout.session_type}</span>
        </div>
        <div class="tile tile--compact">
          <span class="tile__label">Plan Start</span>
          <span class="tile__value">${formatDateLabel(plan.start_date)}</span>
        </div>
      `;
    }

    this.renderSessionSnapshot(plan.id, workout);
  }

  renderNoSession(message) {
    if (this.todayPanel) {
      this.todayPanel.innerHTML = `
        <div class="tile tile--compact">
          <span class="tile__label">Status</span>
          <span class="tile__value">${message}</span>
        </div>
      `;
    }
    this.currentWorkout = null;
    this.currentDayIndex = null;
    if (this.sessionList) {
      this.sessionList.innerHTML =
        '<div class="tile tile--compact">No session snapshot available.</div>';
    }
  }

  renderSessionSnapshot(planId, workout) {
    if (!this.sessionList) {
      return;
    }
    const exercises = workout.exercises ?? [];
    if (!exercises.length) {
      this.sessionList.innerHTML =
        '<div class="tile tile--compact">No exercises assigned.</div>';
      return;
    }

    this.sessionList.innerHTML = exercises
      .map((exercise) => {
        const repsRange =
          exercise.target_reps_min && exercise.target_reps_max
            ? `${exercise.target_reps_min}-${exercise.target_reps_max}`
            : "-";
        const sets = exercise.target_sets ?? "-";
        return `
          <div class="panel session-row">
            <div class="session-row__details">
              <span class="session-row__name">${exercise.name}</span>
              <span class="session-row__meta">Sets: ${sets} | Reps: ${repsRange}</span>
            </div>
            <button
              class="action"
              type="button"
              data-swap
              data-day-index="${workout.day_index}"
              data-sequence="${exercise.sequence}"
              data-plan-id="${planId}"
            >
              Swap
            </button>
          </div>
        `;
      })
      .join("");
  }

  async startSession() {
    if (!this.currentWorkout || this.currentDayIndex === null) {
      this.setStatus("Session initialization blocked: no workout.", true);
      return;
    }
    const planId =
      this.store.getActivePlanId() ?? this.planData?.id ?? null;
    if (!planId) {
      this.setStatus("Session initialization blocked: plan missing.", true);
      return;
    }
    const payload = {
      plan_id: planId,
      day_index: this.currentWorkout.day_index ?? this.currentDayIndex,
      started_at: new Date().toISOString(),
    };

    try {
      const response = await fetch("/workouts/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Backend unreachable");
      }
      let sessionData = null;
      try {
        sessionData = await response.json();
      } catch (error) {
        sessionData = { ...payload, id: null };
      }
      this.store.initializeSession(sessionData);
      this.setStatus("Session initialized.", false);
      window.dispatchEvent(new CustomEvent("session:started"));
      this.viewManager.show("session_detail");
    } catch (error) {
      this.setStatus(
        "Session Initialization Failed: Backend unreachable.",
        true,
      );
    }
  }

  async openSwapModal(dayIndex, sequence) {
    if (!this.swapModal || !this.swapList || !this.swapStatus) {
      return;
    }
    const { currentPlan } = this.store.getState();
    const planId = this.store.getActivePlanId() ?? currentPlan?.id ?? null;
    if (!planId) {
      this.swapStatus.textContent = "Swap blocked: plan missing.";
      this.swapStatus.classList.remove("panel__alert--hidden");
      this.swapStatus.classList.add("panel__alert--error");
      this.swapModal.classList.remove("modal--hidden");
      return;
    }

    this.swapModal.dataset.sequence = String(sequence);
    this.swapModal.dataset.dayIndex = String(dayIndex);
    this.swapStatus.textContent = "Swap options loading...";
    this.swapStatus.classList.remove("panel__alert--hidden");
    this.swapStatus.classList.remove("panel__alert--error");
    this.swapList.innerHTML = "";
    this.swapModal.classList.remove("modal--hidden");

    try {
      const response = await fetch(
        `/plans/${planId}/swap-options?day_index=${dayIndex}&sequence=${sequence}`,
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Swap options failed");
      }
      const options = await response.json();
      this.renderSwapOptions(options);
      this.swapStatus.textContent = "Swap options synchronized.";
    } catch (error) {
      this.swapStatus.textContent = `Swap options failed: ${
        error?.message ?? "Unknown error"
      }`;
      this.swapStatus.classList.add("panel__alert--error");
    }
  }

  renderSwapOptions(options) {
    if (!this.swapList) {
      return;
    }
    if (!Array.isArray(options) || options.length === 0) {
      this.swapList.innerHTML =
        '<div class="tile tile--compact">No swap options available.</div>';
      return;
    }
    const dayIndex = Number(this.swapModal?.dataset.dayIndex ?? 0);
    const sequence = this.swapModal?.dataset.sequence ?? null;
    this.swapList.innerHTML = options
      .map(
        (option) => `
          <button
            class="tile tile--compact"
            type="button"
            data-swap-option
            data-exercise-id="${option.id}"
            data-day-index="${dayIndex}"
            data-sequence="${sequence ?? ""}"
          >
            <span class="tile__label">${option.name}</span>
            <span class="tile__value">${option.movement_pattern} | ${
              option.primary_muscle
            }</span>
          </button>
        `,
      )
      .join("");
  }

  closeSwapModal() {
    if (!this.swapModal) {
      return;
    }
    this.swapModal.classList.add("modal--hidden");
  }

  async applySwap(dayIndex, sequence, exerciseId) {
    const planId = this.store.getActivePlanId() ?? this.planData?.id ?? null;
    if (!planId) {
      this.swapStatus.textContent = "Swap blocked: plan missing.";
      this.swapStatus.classList.remove("panel__alert--hidden");
      this.swapStatus.classList.add("panel__alert--error");
      return;
    }
    if (!dayIndex && dayIndex !== 0) {
      this.swapStatus.textContent = "Swap blocked: day index missing.";
      this.swapStatus.classList.remove("panel__alert--hidden");
      this.swapStatus.classList.add("panel__alert--error");
      return;
    }
    if (!sequence) {
      this.swapStatus.textContent = "Swap blocked: sequence missing.";
      this.swapStatus.classList.remove("panel__alert--hidden");
      this.swapStatus.classList.add("panel__alert--error");
      return;
    }
    this.swapStatus.textContent = "Applying swap...";
    this.swapStatus.classList.remove("panel__alert--hidden");
    this.swapStatus.classList.remove("panel__alert--error");

    try {
      const response = await fetch(`/plans/${planId}/swap`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: planId,
          day_index: dayIndex,
          sequence,
          exercise_id: exerciseId,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Swap failed");
      }
      this.swapStatus.textContent = "Swap applied.";
      await this.loadPlan();
      this.closeSwapModal();
    } catch (error) {
      this.swapStatus.textContent = `Swap failed: ${error?.message ?? "Unknown error"}`;
      this.swapStatus.classList.add("panel__alert--error");
    }
  }
}

export { DashboardController };
