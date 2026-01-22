import { ViewManager } from "../js/view-manager.js";

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
    this.outputPanel = document.querySelector("[data-output]");
    this.equipmentError = document.querySelector("[data-equipment-error]");
    this.incrementError = document.querySelector("[data-increment-error]");
    this.goalError = document.querySelector("[data-goal-error]");
    this.submitStatus = document.querySelector("[data-submit-status]");
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
        const { onboardingData } = this.store.getState();
        if (onboardingData.equipment_id.includes(value)) {
          this.store.removeEquipment(value);
        } else {
          this.store.addEquipment(value);
        }
        this.setAlertState(
          this.equipmentError,
          onboardingData.equipment_id.length === 0,
        );
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
      if (event.target.matches("[data-submit]")) {
        if (!this.validateAllSteps()) {
          this.setSubmitStatus(
            "Submit blocked: required fields missing.",
            true,
          );
          return;
        }
        this.viewManager.show("plan_summary");
      }
    });
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
    this.currentStep = Math.max(1, Math.min(step, 4));
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
  }

  validateStep() {
    const { onboardingData } = this.store.getState();
    if (this.currentStep === 1) {
      const hasError = onboardingData.equipment_id.length === 0;
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
    return true;
  }

  validateAllSteps() {
    const { onboardingData } = this.store.getState();
    const equipmentInvalid = onboardingData.equipment_id.length === 0;
    const incrementInvalid = !onboardingData.smallest_increment;
    const goalInvalid = !onboardingData.goals;
    this.setAlertState(this.equipmentError, equipmentInvalid);
    this.setAlertState(this.incrementError, incrementInvalid);
    this.setAlertState(this.goalError, goalInvalid);
    return !(equipmentInvalid || incrementInvalid || goalInvalid);
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
        onboardingData.equipment_id.includes(value),
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
