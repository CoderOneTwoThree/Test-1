import {
  getState,
  addEquipment,
  removeEquipment,
  updateOnboardingData,
} from "../store.js";
import { show } from "../view-manager.js";

const initQuestionnaire = () => {
  const stepPanels = Array.from(document.querySelectorAll("[data-step]"));
  const progressItems = Array.from(
    document.querySelectorAll("[data-step-indicator]")
  );
  const equipmentGrid = document.querySelector("[data-equipment-grid]");
  const incrementButtons = Array.from(
    document.querySelectorAll("[data-increment]")
  );
  const goalButtons = Array.from(document.querySelectorAll("[data-goal]"));
  const outputPanel = document.querySelector("[data-output]");

  const equipmentError = document.querySelector("[data-equipment-error]");
  const incrementError = document.querySelector("[data-increment-error]");
  const goalError = document.querySelector("[data-goal-error]");
  const submitStatus = document.querySelector("[data-submit-status]");

  let currentStep = 1;

  const updateOutput = () => {
    const { onboardingData } = getState();
    outputPanel.textContent = JSON.stringify(onboardingData, null, 2);
  };

  const setSubmitStatus = (message, isError = false) => {
    submitStatus.textContent = message;
    submitStatus.classList.remove("panel__alert--hidden");
    submitStatus.classList.toggle("panel__alert--error", isError);
  };

  const setActiveStep = (step) => {
    currentStep = step;
    stepPanels.forEach((panel) => {
      panel.classList.toggle(
        "questionnaire--hidden",
        Number(panel.dataset.step) !== step
      );
    });
    progressItems.forEach((item) => {
      item.classList.toggle(
        "progress-list__item--active",
        Number(item.dataset.stepIndicator) === step
      );
    });
  };

  const validateStep = () => {
    const { onboardingData } = getState();
    if (currentStep === 1) {
      const isValid = onboardingData.equipment_id.length > 0;
      equipmentError.classList.toggle("panel__alert--hidden", isValid);
      return isValid;
    }
    if (currentStep === 2) {
      const isValid = Boolean(onboardingData.smallest_increment);
      incrementError.classList.toggle("panel__alert--hidden", isValid);
      return isValid;
    }
    if (currentStep === 3) {
      const isValid = Boolean(onboardingData.fitness_goal);
      goalError.classList.toggle("panel__alert--hidden", isValid);
      return isValid;
    }
    return true;
  };

  const syncSelections = () => {
    const { onboardingData } = getState();
    const equipmentButtons = Array.from(
      document.querySelectorAll("[data-equipment]")
    );
    equipmentButtons.forEach((button) => {
      const value = button.dataset.equipment;
      button.classList.toggle(
        "tile--selected",
        onboardingData.equipment_id.includes(value)
      );
    });

    incrementButtons.forEach((button) => {
      button.classList.toggle(
        "increment--selected",
        Number(button.dataset.increment) ===
          Number(onboardingData.smallest_increment)
      );
    });

    goalButtons.forEach((button) => {
      button.classList.toggle(
        "goal--selected",
        button.dataset.goal === onboardingData.fitness_goal
      );
    });
  };

  const submitPayload = async () => {
    const { onboardingData } = getState();
    const payload = { ...onboardingData };
    try {
      const response = await fetch("/questionnaire", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      setSubmitStatus("Payload sent to backend.");
    } catch (error) {
      setSubmitStatus(`Submit failed: ${error.message}`, true);
    }
  };

  equipmentGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-equipment]");
    if (!button) return;
    const value = button.dataset.equipment;
    if (getState().onboardingData.equipment_id.includes(value)) {
      removeEquipment(value);
    } else {
      addEquipment(value);
    }
    equipmentError.classList.toggle(
      "panel__alert--hidden",
      getState().onboardingData.equipment_id.length > 0
    );
    syncSelections();
    updateOutput();
  });

  incrementButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateOnboardingData({
        smallest_increment: Number(button.dataset.increment),
      });
      incrementError.classList.add("panel__alert--hidden");
      syncSelections();
      updateOutput();
    });
  });

  goalButtons.forEach((button) => {
    button.addEventListener("click", () => {
      updateOnboardingData({ fitness_goal: button.dataset.goal });
      goalError.classList.add("panel__alert--hidden");
      syncSelections();
      updateOutput();
    });
  });

  document.addEventListener("click", (event) => {
    if (event.target.matches("[data-next]")) {
      if (validateStep()) {
        setActiveStep(currentStep + 1);
        updateOutput();
      }
    }
    if (event.target.matches("[data-back]")) {
      setActiveStep(currentStep - 1);
    }
    if (event.target.matches("[data-submit]")) {
      const { onboardingData } = getState();
      const allValid =
        onboardingData.equipment_id.length > 0 &&
        onboardingData.smallest_increment &&
        onboardingData.fitness_goal;
      if (!allValid) {
        setSubmitStatus("Submit blocked: required fields missing.", true);
        return;
      }
      submitPayload();
    }
  });

  show("questionnaire");
  setActiveStep(1);
  syncSelections();
  updateOutput();
};

export { initQuestionnaire };
