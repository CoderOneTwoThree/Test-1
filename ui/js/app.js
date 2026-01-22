import { QuestionnaireController } from "../controllers/questionnaire.js";
import { DashboardController } from "../controllers/dashboard.js";
import { PlanSummaryController } from "../controllers/plan_summary.js";
import { SessionController } from "../controllers/session.js";
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

  registerController("questionnaire", QuestionnaireController);
  registerController("plan_summary", PlanSummaryController);
  registerController("dashboard", DashboardController);
  registerController("session_detail", SessionController);

  initControllers({ store: Store, viewManager });
  viewManager.show("welcome");
};

initApp();
