import { QuestionnaireController } from "../controllers/questionnaire.js";
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

  initControllers({ store: Store, viewManager });
  viewManager.show("welcome");
};

initApp();
