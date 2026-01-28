import {
  DAY_LABELS,
  formatDateLabel,
  normalizePlanData,
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
    this.hasSessionToday = false;
    this.lastCompletedDayIndex = null;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadPlan();
    this.loadSessionStatus();
    window.addEventListener("plan:accepted", () => {
      this.loadPlan();
    });
    window.addEventListener("session:saved", (event) => {
      this.handleSessionSaved(event);
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
      this.store.setCurrentPlan(this.planData);
      if (this.planData.id) {
        this.store.setActivePlanId(this.planData.id);
      }
      await this.loadLastCompleted(planId);
      this.renderToday(this.planData);
      this.setStatus("Plan synchronized.", false);
    } catch (error) {
      this.setStatus(
        `Plan fetch failed: ${error?.message ?? "Unknown error"}`,
        true,
      );
    }
  }

  async loadLastCompleted(planId) {
    const userId = Number(this.store?.getState?.()?.onboardingData?.user_id ?? 1);
    if (!Number.isFinite(userId)) {
      this.lastCompletedDayIndex = null;
      return;
    }
    try {
      const response = await fetch(
        `/plans/${planId}/last-completed?user_id=${userId}`,
      );
      if (!response.ok) {
        this.lastCompletedDayIndex = null;
        return;
      }
      const payload = await response.json();
      const dayIndex = payload?.day_index ?? payload?.dayIndex ?? null;
      this.lastCompletedDayIndex =
        Number.isFinite(Number(dayIndex)) ? Number(dayIndex) : null;
    } catch (error) {
      this.lastCompletedDayIndex = null;
    }
  }

  async loadSessionStatus() {
    const userId = Number(this.store?.getState?.()?.onboardingData?.user_id ?? 1);
    if (!Number.isFinite(userId)) {
      return;
    }
    try {
      const response = await fetch(`/workouts/sessions?user_id=${userId}`);
      if (!response.ok) {
        return;
      }
      const payload = await response.json();
      const sessions = Array.isArray(payload) ? payload : payload?.sessions ?? [];
      if (!sessions.length) {
        this.hasSessionToday = false;
        this.renderSessionStatus();
        return;
      }
      const latest = sessions[0];
      const performedAt = latest?.performed_at ?? latest?.performedAt ?? null;
      const performedDate = performedAt ? new Date(performedAt) : null;
      if (!performedDate || Number.isNaN(performedDate.getTime())) {
        this.hasSessionToday = false;
        this.renderSessionStatus();
        return;
      }
      this.hasSessionToday = this.isSameDay(performedDate, new Date());
      this.renderSessionStatus(
        this.hasSessionToday ? "Session logged today." : null,
      );
    } catch (error) {
      // Silent fail: session status is a nice-to-have.
    }
  }

  async handleSessionSaved(event) {
    const performedAt =
      event?.detail?.performed_at ?? event?.detail?.performedAt ?? null;
    const performedDate = performedAt ? new Date(performedAt) : new Date();
    this.hasSessionToday = this.isSameDay(performedDate, new Date());
    const planId =
      event?.detail?.plan_id ?? event?.detail?.planId ?? this.planData?.id ?? null;
    if (planId) {
      await this.loadLastCompleted(planId);
      if (this.planData) {
        this.renderToday(this.planData);
      }
    }
    this.renderSessionStatus("Session saved. Ready to log another.");
  }

  renderSessionStatus(message = null) {
    if (this.startButton) {
      this.startButton.disabled = false;
      this.startButton.textContent = this.hasSessionToday
        ? "Log Another Session"
        : "Start Session";
    }
    if (this.hasSessionToday && message) {
      this.setStatus(message, false);
    }
  }

  isSameDay(first, second) {
    return (
      first.getFullYear() === second.getFullYear() &&
      first.getMonth() === second.getMonth() &&
      first.getDate() === second.getDate()
    );
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
    const workouts = Array.isArray(plan.workouts) ? plan.workouts : [];
    if (!workouts.length) {
      this.renderNoSession("Training plan missing workouts.");
      return;
    }
    const lastCompletedIndex = Number.isFinite(this.lastCompletedDayIndex)
      ? workouts.findIndex(
          (workout) => Number(workout.day_index) === this.lastCompletedDayIndex,
        )
      : -1;
    const nextIndex =
      lastCompletedIndex >= 0
        ? (lastCompletedIndex + 1) % workouts.length
        : 0;
    const workout = workouts[nextIndex];
    if (!workout) {
      this.renderNoSession("Next session missing. Sync required.");
      return;
    }
    this.currentWorkout = workout;
    this.currentDayIndex = workout.day_index ?? nextIndex;

    if (this.todayPanel) {
      this.todayPanel.innerHTML = `
        <div class="tile tile--compact">
          <span class="tile__label">Next Session</span>
          <span class="tile__value">${DAY_LABELS[workout.day_index] ?? "Day"}</span>
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
    const sessionData = {
      id: Date.now(),
      plan_id: planId,
      day_index: this.currentWorkout.day_index ?? this.currentDayIndex,
      started_at: new Date().toISOString(),
    };

    this.store.initializeSession(sessionData);
    this.setStatus("Session initialized.", false);
    window.dispatchEvent(new CustomEvent("session:started"));
    this.viewManager.show("session_detail");
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
