import { QuestionnaireController } from "../controllers/questionnaire.js";
import { DashboardController } from "../controllers/dashboard.js";
import { PlanSummaryController } from "../controllers/plan_summary.js";
import { SessionController } from "../controllers/session.js";
import { HistoryController } from "../controllers/history.js";
import { Store } from "./store.js";
import { ViewManager } from "./view-manager.js";

const controllerRegistry = new Map();

const registerController = (screenId, ControllerClass) => {
  if (!ControllerClass) {
    return;
  }
  controllerRegistry.set(screenId, ControllerClass);
};

const initControllers = (context) => {
  controllerRegistry.forEach((ControllerClass, screenId) => {
    const controller = new ControllerClass({ ...context, screenId });
    if (typeof controller.init === "function") {
      controller.init();
    }
  });
};

const initApp = () => {
  Store.init();
  const viewManager = new ViewManager();
  const navButtons = document.querySelectorAll("[data-nav-target]");
  const startQuestionnaire = document.querySelector(
    "[data-start-questionnaire]",
  );

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.navTarget;
      if (target) {
        viewManager.show(target);
      }
    });
  });

  if (startQuestionnaire) {
    startQuestionnaire.addEventListener("click", () => {
      viewManager.show("questionnaire", { step: 1 });
    });
  }

  registerController("questionnaire", QuestionnaireController);
  registerController("plan_summary", PlanSummaryController);
  registerController("dashboard", DashboardController);
  registerController("session_detail", SessionController);
  registerController("history", HistoryController);

  initControllers({ store: Store, viewManager });
  const { currentPlan, pendingPlanId } = Store.getState();
  const hasPlan =
    Boolean(Store.getActivePlanId?.()) ||
    Boolean(currentPlan?.id) ||
    Boolean(pendingPlanId);
  if (!hasPlan) {
    viewManager.show("questionnaire", { step: 1 });
  } else {
    viewManager.show("welcome");
  }
};

initApp();
