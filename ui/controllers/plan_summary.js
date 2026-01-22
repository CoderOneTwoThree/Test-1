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
    this.planData = null;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadPlan();
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
                    ${exercise.sequence}. ${exercise.name}
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
}

export { PlanSummaryController };
