import { Store } from "./store.js";

const ONBOARDING_SCREENS = ["welcome", "questionnaire", "plan_summary"];

class ViewManager {
  constructor({ root = document, hiddenClass = "screen--hidden" } = {}) {
    this.root = root;
    this.hiddenClass = hiddenClass;
    this.screens = Array.from(this.root.querySelectorAll("[data-screen-id]"));
  }

  show(screenId, { step } = {}) {
    if (!this.canNavigateTo(screenId, step)) {
      this.showBlockedAlert("Navigation Blocked: Complete current step first.");
      return false;
    }

    let hasMatch = false;
    this.screens.forEach((screen) => {
      const isActive = screen.dataset.screenId === screenId;
      if (isActive) {
        hasMatch = true;
      }
      screen.classList.toggle(this.hiddenClass, !isActive);
    });
    if (!hasMatch) {
      console.warn(`ViewManager: screen not found for id "${screenId}"`);
    }
    return hasMatch;
  }

  showBlockedAlert(message) {
    const activeScreen = this.screens.find(
      (screen) => !screen.classList.contains(this.hiddenClass),
    );
    if (!activeScreen) {
      return;
    }
    const alert = activeScreen.querySelector(".panel__alert");
    if (!alert) {
      return;
    }
    alert.textContent = message;
    alert.classList.remove("panel__alert--hidden");
    alert.classList.add("panel__alert--error");
  }

  canNavigateTo(screenId, targetStep) {
    if (!ONBOARDING_SCREENS.includes(screenId)) {
      return true;
    }
    if (screenId === "questionnaire" && Number.isInteger(targetStep)) {
      return Store.isStepAccessible(targetStep);
    }
    const targetIndex = ONBOARDING_SCREENS.indexOf(screenId);
    if (targetIndex <= 0) {
      return true;
    }
    const precedingScreens = ONBOARDING_SCREENS.slice(1, targetIndex + 1);
    if (precedingScreens.includes("plan_summary")) {
      return Store.isOnboardingComplete();
    }
    return true;
  }
}

export { ViewManager };
