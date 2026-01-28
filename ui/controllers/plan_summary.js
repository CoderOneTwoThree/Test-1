import {
  DAY_LABELS,
  formatDateLabel,
  normalizePlanData,
} from "../js/plan-utils.js";
import { ViewManager } from "../js/view-manager.js";

class PlanSummaryController {
  constructor({ store, viewManager } = {}) {
    this.store = store;
    this.viewManager = viewManager ?? new ViewManager();
    this.root = document.querySelector('[data-screen-id="plan_summary"]');
    this.overviewGrid = document.querySelector("[data-plan-overview]");
    this.scheduleGrid = document.querySelector("[data-plan-schedule]");
    this.exerciseGrid = document.querySelector("[data-plan-exercises]");
    this.statusAlert = document.querySelector("[data-plan-summary-status]");
    this.acceptButton = document.querySelector("[data-accept-plan]");
    this.swapModal = document.querySelector("[data-plan-swap-modal]");
    this.swapList = document.querySelector("[data-plan-swap-options]");
    this.swapStatus = document.querySelector("[data-plan-swap-status]");
    this.swapClose = document.querySelector("[data-plan-swap-close]");
    this.planData = null;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadPlan();
    window.addEventListener("plan:created", () => {
      this.loadPlan();
    });
  }

  bindEvents() {
    if (this.acceptButton) {
      this.acceptButton.addEventListener("click", () => {
        if (!this.planData) {
          this.setStatus("Plan unavailable. Fetch required.", true);
          return;
        }
        const planId = this.planData.id;
        if (!planId) {
          this.setStatus("Plan ID missing. Sync required.", true);
          return;
        }
        this.store.setCurrentPlan(this.planData);
        this.store.setActivePlanId(planId);
        this.store.setPendingPlanId(null);
        this.setStatus("Plan accepted. Plan synchronized.", false);
        window.dispatchEvent(
          new CustomEvent("plan:accepted", { detail: this.planData }),
        );
        this.viewManager.show("dashboard");
      });
    }

    if (this.swapClose) {
      this.swapClose.addEventListener("click", () => {
        this.closeSwapModal();
      });
    }

    if (this.exerciseGrid) {
      this.exerciseGrid.addEventListener("click", (event) => {
        const swapButton = event.target.closest("[data-plan-swap]");
        if (!swapButton) {
          return;
        }
        const dayIndex = Number(swapButton.dataset.dayIndex);
        const sequence = Number(swapButton.dataset.sequence);
        this.openSwapModal(dayIndex, sequence);
      });
    }

    if (this.swapList) {
      this.swapList.addEventListener("click", (event) => {
        const optionButton = event.target.closest("[data-plan-swap-option]");
        if (!optionButton) {
          return;
        }
        const exerciseId = Number(optionButton.dataset.exerciseId);
        const dayIndex = Number(optionButton.dataset.dayIndex);
        const sequence = Number(optionButton.dataset.sequence);
        this.applySwap(dayIndex, sequence, exerciseId);
      });
    }
  }

  async loadPlan() {
    const { pendingPlanId, currentPlan } = this.store.getState();
    const planId = pendingPlanId ?? currentPlan?.id ?? null;
    if (!planId) {
      this.setStatus("Plan ID missing. Return to intake.", true);
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
      this.renderPlan(this.planData);
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

  renderPlan(plan) {
    this.renderOverview(plan);
    this.renderSchedule(plan);
    this.renderExercises(plan);
  }

  renderOverview(plan) {
    if (!this.overviewGrid) {
      return;
    }
    const entries = [
      { label: "Plan Name", value: plan.name },
      { label: "Goal", value: plan.goals ?? "Unknown" },
      { label: "Experience", value: plan.experience_level ?? "Unknown" },
      {
        label: "Training Frequency",
        value: plan.schedule_days ? `${plan.schedule_days} days/week` : "Unknown",
      },
      { label: "Start Date", value: formatDateLabel(plan.start_date) },
    ];
    this.overviewGrid.innerHTML = entries
      .map(
        (entry) => `
          <div class="tile tile--compact">
            <span class="tile__label">${entry.label}</span>
            <span class="tile__value">${entry.value}</span>
          </div>
        `,
      )
      .join("");
  }

  renderSchedule(plan) {
    if (!this.scheduleGrid) {
      return;
    }
    const trainingDays = Array.isArray(plan.training_days_of_week)
      ? plan.training_days_of_week
      : [];
    const sortedDays = [...trainingDays].sort((a, b) => a - b);
    const workouts = Array.isArray(plan.workouts) ? plan.workouts : [];

    const scheduleRows = sortedDays.length
      ? sortedDays.map((dayValue, index) => {
          const workout = workouts[index];
          return {
            label: DAY_LABELS[dayValue] ?? `Day ${index + 1}`,
            session: workout?.session_type ?? "Session",
          };
        })
      : workouts.map((workout, index) => ({
          label: `Day ${index + 1}`,
          session: workout.session_type ?? "Session",
        }));

    if (!scheduleRows.length) {
      this.scheduleGrid.innerHTML =
        '<div class="tile tile--compact">Schedule unavailable.</div>';
      return;
    }

    this.scheduleGrid.innerHTML = scheduleRows
      .map(
        (row) => `
          <div class="tile tile--compact">
            <span class="tile__label">${row.label}</span>
            <span class="tile__value">${row.session}</span>
          </div>
        `,
      )
      .join("");
  }

  renderExercises(plan) {
    if (!this.exerciseGrid) {
      return;
    }
    const workouts = Array.isArray(plan.workouts) ? plan.workouts : [];
    if (!workouts.length) {
      this.exerciseGrid.innerHTML =
        '<div class="tile tile--compact">Exercise list unavailable.</div>';
      return;
    }

    this.exerciseGrid.innerHTML = workouts
      .map((workout, index) => {
        const exercises = workout.exercises ?? [];
        const exerciseList = exercises.length
          ? exercises
              .map(
                (exercise) => `
                  <li>
                    <div class="session-row">
                      <div class="session-row__details">
                        <span class="session-row__name">${exercise.sequence}. ${exercise.name}</span>
                      </div>
                      <button
                        class="action"
                        type="button"
                        data-plan-swap
                        data-day-index="${workout.day_index}"
                        data-sequence="${exercise.sequence}"
                      >
                        Swap
                      </button>
                    </div>
                  </li>
                `,
              )
              .join("")
          : "<li>No exercises assigned.</li>";
        return `
          <div class="panel">
            <h4 class="panel__title">Session ${index + 1}: ${
              workout.session_type ?? "Session"
            }</h4>
            <ol class="key-list">${exerciseList}</ol>
          </div>
        `;
      })
      .join("");
  }

  async openSwapModal(dayIndex, sequence) {
    if (!this.swapModal || !this.swapList || !this.swapStatus) {
      return;
    }
    if (!this.planData?.id) {
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
        `/plans/${this.planData.id}/swap-options?day_index=${dayIndex}&sequence=${sequence}`,
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
            data-plan-swap-option
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
    if (!this.planData?.id) {
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
      const response = await fetch(`/plans/${this.planData.id}/swap`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: this.planData.id,
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

export { PlanSummaryController };
