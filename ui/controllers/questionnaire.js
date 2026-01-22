import { ViewManager } from "../js/view-manager.js";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

class QuestionnaireController {
  constructor({ store, viewManager } = {}) {
    this.store = store;
    this.viewManager = viewManager ?? new ViewManager();
    this.root = document.querySelector('[data-screen-id="questionnaire"]');
    this.stepPanels = Array.from(document.querySelectorAll("[data-step]"));
    this.progressItems = Array.from(
      document.querySelectorAll("[data-step-indicator]"),
    );
    this.equipmentGrid = document.querySelector("[data-equipment-grid]");
    this.incrementButtons = Array.from(
      document.querySelectorAll("[data-increment]"),
    );
    this.goalButtons = Array.from(document.querySelectorAll("[data-goal]"));
    this.experienceButtons = Array.from(
      document.querySelectorAll("[data-experience]"),
    );
    this.scheduleButtons = Array.from(
      document.querySelectorAll("[data-schedule-days]"),
    );
    this.trainingDayButtons = Array.from(
      document.querySelectorAll("[data-training-day]"),
    );
    this.splitButtons = Array.from(
      document.querySelectorAll("[data-split-variant]"),
    );
    this.splitSection = document.querySelector("[data-split-section]");
    this.measurementInputs = Array.from(
      document.querySelectorAll("[data-measurement]"),
    );
    this.injuriesInput = document.querySelector("[data-injuries]");
    this.excludedInput = document.querySelector("[data-excluded]");
    this.reviewList = document.querySelector("[data-review-list]");
    this.outputPanel = document.querySelector("[data-output]");
    this.equipmentError = document.querySelector("[data-equipment-error]");
    this.incrementError = document.querySelector("[data-increment-error]");
    this.goalError = document.querySelector("[data-goal-error]");
    this.experienceError = document.querySelector("[data-experience-error]");
    this.scheduleError = document.querySelector("[data-schedule-error]");
    this.submitStatus = document.querySelector("[data-submit-status]");
    this.scheduleNextButton = document.querySelector("[data-schedule-next]");
    this.totalSteps = this.progressItems.length;
    this.currentStep = 1;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.viewManager.show("questionnaire");
    this.setActiveStep(1);
    this.syncSelections();
    this.updateOutput();
  }

  bindEvents() {
    if (this.equipmentGrid) {
      this.equipmentGrid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-equipment]");
        if (!button) return;
        const value = button.dataset.equipment;
        this.store.updateOnboardingData({ equipment_available: value });
        this.setAlertState(this.equipmentError, false);
        this.syncSelections();
        this.updateOutput();
      });
    }

    this.incrementButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.store.updateOnboardingData({
          smallest_increment: Number(button.dataset.increment),
        });
        this.setAlertState(this.incrementError, false);
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.goalButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.store.updateOnboardingData({ goals: button.dataset.goal });
        this.setAlertState(this.goalError, false);
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.experienceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.store.updateOnboardingData({
          experience_level: button.dataset.experience,
        });
        this.setAlertState(this.experienceError, false);
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.scheduleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const scheduleDays = Number(button.dataset.scheduleDays);
        this.store.updateOnboardingData({
          schedule_days: scheduleDays,
          training_days_of_week: [],
          split_variant: null,
        });
        this.setAlertState(this.scheduleError, false);
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.trainingDayButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const { onboardingData } = this.store.getState();
        const scheduleDays = Number(onboardingData.schedule_days);
        if (!scheduleDays) {
          this.setAlertState(this.scheduleError, true);
          return;
        }
        const dayValue = Number(button.dataset.trainingDay);
        const selected = new Set(onboardingData.training_days_of_week);
        if (selected.has(dayValue)) {
          selected.delete(dayValue);
        } else if (selected.size < scheduleDays) {
          selected.add(dayValue);
        }
        this.store.updateOnboardingData({
          training_days_of_week: Array.from(selected).sort((a, b) => a - b),
        });
        this.setAlertState(this.scheduleError, false);
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.splitButtons.forEach((button) => {
      button.addEventListener("click", () => {
        this.store.updateOnboardingData({
          split_variant: button.dataset.splitVariant,
        });
        this.syncSelections();
        this.updateOutput();
      });
    });

    this.measurementInputs.forEach((input) => {
      input.addEventListener("change", () => {
        const value = this.normalizeMeasurementValue(input);
        this.store.updateOnboardingData({
          [input.dataset.measurement]: value,
        });
        this.updateOutput();
      });
    });

    if (this.injuriesInput) {
      this.injuriesInput.addEventListener("input", () => {
        this.store.updateOnboardingData({
          injuries_constraints: this.normalizeTextValue(this.injuriesInput.value),
        });
        this.updateOutput();
      });
    }

    if (this.excludedInput) {
      this.excludedInput.addEventListener("input", () => {
        this.store.updateOnboardingData({
          excluded_patterns: this.normalizeTextValue(this.excludedInput.value),
        });
        this.updateOutput();
      });
    }

    document.addEventListener("click", (event) => {
      if (event.target.matches("[data-next]")) {
        if (this.validateStep()) {
          this.store.setStepComplete(this.currentStep);
          const nextStep = this.currentStep + 1;
          if (this.viewManager.show("questionnaire", { step: nextStep })) {
            this.setActiveStep(nextStep);
            this.updateOutput();
          }
        }
      }
      if (event.target.matches("[data-back]")) {
        this.setActiveStep(this.currentStep - 1);
      }
      if (event.target.matches("[data-skip-measurements]")) {
        this.store.updateOnboardingData({
          age: null,
          sex: null,
          height: null,
          weight: null,
        });
        this.syncSelections();
        this.store.setStepComplete(this.currentStep);
        this.advanceToNextStep();
      }
      if (event.target.matches("[data-skip-health]")) {
        this.store.updateOnboardingData({
          injuries_constraints: null,
          excluded_patterns: null,
        });
        this.syncSelections();
        this.store.setStepComplete(this.currentStep);
        this.advanceToNextStep();
      }
      if (event.target.matches("[data-edit-step]")) {
        const step = Number(event.target.dataset.editStep);
        if (this.viewManager.show("questionnaire", { step })) {
          this.setActiveStep(step);
        }
      }
      if (event.target.matches("[data-submit]")) {
        this.submitQuestionnaire();
      }
    });
  }

  normalizeMeasurementValue(input) {
    if (input.tagName === "SELECT") {
      return input.value ? input.value : null;
    }
    const value = input.value.trim();
    if (!value) {
      return null;
    }
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
  }

  normalizeTextValue(value) {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  advanceToNextStep() {
    const nextStep = this.currentStep + 1;
    if (this.viewManager.show("questionnaire", { step: nextStep })) {
      this.setActiveStep(nextStep);
      this.updateOutput();
    }
  }

  setAlertState(alertElement, hasError) {
    if (!alertElement) {
      return;
    }
    alertElement.classList.toggle("panel__alert--hidden", !hasError);
    alertElement.classList.toggle("panel__alert--error", hasError);
  }

  setSubmitStatus(message, isError = false) {
    if (!this.submitStatus) {
      return;
    }
    this.submitStatus.textContent = message;
    this.setAlertState(this.submitStatus, true);
    this.submitStatus.classList.toggle("panel__alert--error", isError);
  }

  setActiveStep(step) {
    this.currentStep = Math.max(1, Math.min(step, this.totalSteps));
    if (this.root) {
      this.root.dataset.step = String(this.currentStep);
    }
    this.stepPanels.forEach((panel) => {
      panel.classList.toggle(
        "questionnaire--hidden",
        Number(panel.dataset.step) !== this.currentStep,
      );
    });
    this.progressItems.forEach((item) => {
      item.classList.toggle(
        "progress-list__item--active",
        Number(item.dataset.stepIndicator) === this.currentStep,
      );
    });
    this.syncSelections();
    this.updateScheduleActionState();
    this.updateReviewList();
  }

  validateStep() {
    const { onboardingData } = this.store.getState();
    if (this.currentStep === 1) {
      const hasError = !onboardingData.equipment_available;
      this.setAlertState(this.equipmentError, hasError);
      return !hasError;
    }
    if (this.currentStep === 2) {
      const hasError = !onboardingData.smallest_increment;
      this.setAlertState(this.incrementError, hasError);
      return !hasError;
    }
    if (this.currentStep === 3) {
      const hasError = !onboardingData.goals;
      this.setAlertState(this.goalError, hasError);
      return !hasError;
    }
    if (this.currentStep === 4) {
      const hasError = !onboardingData.experience_level;
      this.setAlertState(this.experienceError, hasError);
      return !hasError;
    }
    if (this.currentStep === 5) {
      const scheduleDays = Number(onboardingData.schedule_days);
      const trainingDaysCount = onboardingData.training_days_of_week.length;
      const scheduleMissing = !scheduleDays;
      const scheduleMismatch =
        scheduleDays && scheduleDays !== trainingDaysCount;
      const splitMissing =
        scheduleDays === 5 && !onboardingData.split_variant;
      const hasError = scheduleMissing || scheduleMismatch || splitMissing;
      this.setAlertState(this.scheduleError, hasError);
      return !hasError;
    }
    return true;
  }

  validateAllSteps() {
    const { onboardingData } = this.store.getState();
    const equipmentInvalid = !onboardingData.equipment_available;
    const incrementInvalid = !onboardingData.smallest_increment;
    const goalInvalid = !onboardingData.goals;
    const experienceInvalid = !onboardingData.experience_level;
    const scheduleDays = Number(onboardingData.schedule_days);
    const scheduleInvalid =
      !scheduleDays ||
      onboardingData.training_days_of_week.length !== scheduleDays;
    const splitInvalid = scheduleDays === 5 && !onboardingData.split_variant;
    this.setAlertState(this.equipmentError, equipmentInvalid);
    this.setAlertState(this.incrementError, incrementInvalid);
    this.setAlertState(this.goalError, goalInvalid);
    this.setAlertState(this.experienceError, experienceInvalid);
    this.setAlertState(this.scheduleError, scheduleInvalid || splitInvalid);
    return !(
      equipmentInvalid ||
      incrementInvalid ||
      goalInvalid ||
      experienceInvalid ||
      scheduleInvalid ||
      splitInvalid
    );
  }

  buildPayload() {
    const { onboardingData } = this.store.getState();
    return {
      user_id: Number(onboardingData.user_id) || 1,
      goals: onboardingData.goals,
      experience_level: onboardingData.experience_level,
      equipment_available: onboardingData.equipment_available,
      smallest_increment: Number(onboardingData.smallest_increment),
      schedule_days: Number(onboardingData.schedule_days),
      training_days_of_week: onboardingData.training_days_of_week,
      split_variant: onboardingData.split_variant,
      injuries_constraints: onboardingData.injuries_constraints,
      excluded_patterns: onboardingData.excluded_patterns,
      age: onboardingData.age,
      sex: onboardingData.sex,
      height: onboardingData.height,
      weight: onboardingData.weight,
    };
  }

  async submitQuestionnaire() {
    if (!this.validateAllSteps()) {
      this.setSubmitStatus("Submit blocked: required fields missing.", true);
      return;
    }
    this.setSubmitStatus("Processing intake data...", false);
    const payload = this.buildPayload();

    try {
      const response = await fetch("/questionnaire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Request failed");
      }
      this.setSubmitStatus("Intake submitted. Redirecting...", false);
      this.viewManager.show("plan_summary");
      this.store.resetOnboarding();
    } catch (error) {
      this.setSubmitStatus(
        `Submit failed: ${error?.message ?? "Unknown error"}`,
        true,
      );
    }
  }

  syncSelections() {
    const { onboardingData } = this.store.getState();
    const equipmentButtons = Array.from(
      document.querySelectorAll("[data-equipment]"),
    );
    equipmentButtons.forEach((button) => {
      const value = button.dataset.equipment;
      button.classList.toggle(
        "tile--selected",
        onboardingData.equipment_available === value,
      );
    });

    this.incrementButtons.forEach((button) => {
      button.classList.toggle(
        "increment--selected",
        Number(button.dataset.increment) ===
          Number(onboardingData.smallest_increment),
      );
    });

    this.goalButtons.forEach((button) => {
      button.classList.toggle(
        "goal--selected",
        button.dataset.goal === onboardingData.goals,
      );
    });

    this.experienceButtons.forEach((button) => {
      button.classList.toggle(
        "tile--selected",
        button.dataset.experience === onboardingData.experience_level,
      );
    });

    this.scheduleButtons.forEach((button) => {
      button.classList.toggle(
        "tile--selected",
        Number(button.dataset.scheduleDays) ===
          Number(onboardingData.schedule_days),
      );
    });

    this.trainingDayButtons.forEach((button) => {
      const dayValue = Number(button.dataset.trainingDay);
      button.classList.toggle(
        "tile--selected",
        onboardingData.training_days_of_week.includes(dayValue),
      );
    });

    this.splitButtons.forEach((button) => {
      button.classList.toggle(
        "tile--selected",
        button.dataset.splitVariant === onboardingData.split_variant,
      );
    });

    if (this.splitSection) {
      const showSplit = Number(onboardingData.schedule_days) === 5;
      this.splitSection.classList.toggle("questionnaire--hidden", !showSplit);
      if (!showSplit && onboardingData.split_variant) {
        this.store.updateOnboardingData({ split_variant: null });
      }
    }

    this.measurementInputs.forEach((input) => {
      const value = onboardingData[input.dataset.measurement];
      if (input.tagName === "SELECT") {
        input.value = value ?? "";
      } else {
        input.value = value ?? "";
      }
    });

    if (this.injuriesInput) {
      this.injuriesInput.value = onboardingData.injuries_constraints ?? "";
    }

    if (this.excludedInput) {
      this.excludedInput.value = onboardingData.excluded_patterns ?? "";
    }

    this.updateScheduleActionState();
    this.updateReviewList();
  }

  updateScheduleActionState() {
    if (!this.scheduleNextButton) {
      return;
    }
    const { onboardingData } = this.store.getState();
    const scheduleDays = Number(onboardingData.schedule_days);
    const selectedCount = onboardingData.training_days_of_week.length;
    const requiresSplit = scheduleDays === 5;
    const splitReady = !requiresSplit || Boolean(onboardingData.split_variant);
    const isReady =
      Boolean(scheduleDays) && selectedCount === scheduleDays && splitReady;
    this.scheduleNextButton.disabled = !isReady;
  }

  updateReviewList() {
    if (!this.reviewList) {
      return;
    }
    const { onboardingData } = this.store.getState();
    const equipmentLabels = {
      none: "None",
      dumbbells_only: "Dumbbells Only",
      home_gym: "Home Gym",
      full_gym: "Full Gym",
    };
    const goalLabels = {
      general_fitness: "General Fitness",
      muscle_gain: "Muscle Gain",
      strength: "Strength",
      weight_loss: "Weight Loss",
    };
    const experienceLabels = {
      beginner: "Beginner",
      intermediate: "Intermediate",
      advanced: "Advanced",
    };
    const splitLabels = {
      ppl_upper_lower: "PPL + Upper/Lower",
      ppl_push_pull: "PPL + Push/Pull",
    };
    const dayNames = onboardingData.training_days_of_week
      .map((day) => DAY_LABELS[day])
      .filter(Boolean)
      .join(", ");

    const entries = [
      {
        label: "Equipment",
        value: equipmentLabels[onboardingData.equipment_available],
        step: 1,
      },
      {
        label: "Smallest Increment",
        value: onboardingData.smallest_increment
          ? `${onboardingData.smallest_increment} lb`
          : null,
        step: 2,
      },
      {
        label: "Goal",
        value: goalLabels[onboardingData.goals],
        step: 3,
      },
      {
        label: "Experience",
        value: experienceLabels[onboardingData.experience_level],
        step: 4,
      },
      {
        label: "Training Days",
        value: onboardingData.schedule_days
          ? `${onboardingData.schedule_days} days/week`
          : null,
        step: 5,
      },
      {
        label: "Days of Week",
        value: dayNames,
        step: 5,
      },
      {
        label: "Split Variant",
        value: splitLabels[onboardingData.split_variant],
        step: 5,
      },
      {
        label: "Age",
        value: onboardingData.age ? `${onboardingData.age} years` : null,
        step: 6,
      },
      { label: "Sex", value: onboardingData.sex, step: 6 },
      {
        label: "Height",
        value: onboardingData.height ? `${onboardingData.height} in` : null,
        step: 6,
      },
      {
        label: "Weight",
        value: onboardingData.weight ? `${onboardingData.weight} lb` : null,
        step: 6,
      },
      {
        label: "Injuries/Constraints",
        value: onboardingData.injuries_constraints,
        step: 7,
      },
      {
        label: "Movements to Avoid",
        value: onboardingData.excluded_patterns,
        step: 7,
      },
    ];

    this.reviewList.innerHTML = entries
      .map(({ label, value, step }) => {
        const displayValue =
          value === null || value === undefined || value === ""
            ? "No response"
            : String(value);
        return `
          <div class="review-row">
            <div class="review-row__content">
              <span class="review-row__label">${label}</span>
              <span class="review-row__value">${displayValue}</span>
            </div>
            <button class="action" type="button" data-edit-step="${step}">
              Edit
            </button>
          </div>
        `;
      })
      .join("");
  }

  updateOutput() {
    if (!this.outputPanel) {
      return;
    }
    const { onboardingData } = this.store.getState();
    this.outputPanel.textContent = JSON.stringify(onboardingData, null, 2);
  }
}

export { QuestionnaireController };
