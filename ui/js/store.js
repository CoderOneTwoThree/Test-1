const STORAGE_KEYS = {
  currentPlan: "ui.currentPlan",
  activeSession: "ui.activeSession",
  onboardingData: "ui.onboardingData",
  completedSteps: "ui.completedSteps",
};

const state = {
  currentPlan: null,
  activeSession: null,
  onboardingData: {
    equipment_id: [],
    smallest_increment: null,
    goals: null,
  },
  completedSteps: [],
};

const parseStoredValue = (value) => {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn("Store: unable to parse persisted value", error);
    return null;
  }
};

const persistValue = (key, value) => {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
};

const init = () => {
  state.currentPlan = parseStoredValue(
    localStorage.getItem(STORAGE_KEYS.currentPlan),
  );
  state.activeSession = parseStoredValue(
    localStorage.getItem(STORAGE_KEYS.activeSession),
  );
  const persistedOnboarding = parseStoredValue(
    localStorage.getItem(STORAGE_KEYS.onboardingData),
  );
  if (persistedOnboarding) {
    setOnboardingData(persistedOnboarding);
  }
  const persistedCompletedSteps = parseStoredValue(
    localStorage.getItem(STORAGE_KEYS.completedSteps),
  );
  if (Array.isArray(persistedCompletedSteps)) {
    state.completedSteps = [...persistedCompletedSteps];
  }
};

const getState = () => ({
  currentPlan: state.currentPlan,
  activeSession: state.activeSession,
  onboardingData: {
    ...state.onboardingData,
    equipment_id: [...state.onboardingData.equipment_id],
  },
  completedSteps: [...state.completedSteps],
});

const setCurrentPlan = (plan) => {
  state.currentPlan = plan ?? null;
  persistValue(STORAGE_KEYS.currentPlan, state.currentPlan);
};

const setActiveSession = (session) => {
  state.activeSession = session ?? null;
  persistValue(STORAGE_KEYS.activeSession, state.activeSession);
};

const setOnboardingData = (data) => {
  state.onboardingData = {
    equipment_id: Array.isArray(data?.equipment_id)
      ? [...data.equipment_id]
      : [],
    smallest_increment:
      data?.smallest_increment === null ||
      data?.smallest_increment === undefined
        ? null
        : Number(data.smallest_increment),
    goals: data?.goals ?? null,
  };
  persistValue(STORAGE_KEYS.onboardingData, state.onboardingData);
};

const setStepComplete = (stepIndex) => {
  if (!Number.isInteger(stepIndex)) {
    return;
  }
  if (!state.completedSteps.includes(stepIndex)) {
    state.completedSteps = [...state.completedSteps, stepIndex];
    persistValue(STORAGE_KEYS.completedSteps, state.completedSteps);
  }
};

const isStepAccessible = (stepIndex) => {
  if (!Number.isInteger(stepIndex)) {
    return false;
  }
  if (stepIndex === 1) {
    return true;
  }
  return state.completedSteps.includes(stepIndex - 1);
};

const updateOnboardingData = (partialData) => {
  state.onboardingData = {
    ...state.onboardingData,
    ...partialData,
  };
  persistValue(STORAGE_KEYS.onboardingData, state.onboardingData);
};

const addEquipment = (equipmentId) => {
  if (state.onboardingData.equipment_id.includes(equipmentId)) {
    return;
  }
  state.onboardingData = {
    ...state.onboardingData,
    equipment_id: [...state.onboardingData.equipment_id, equipmentId],
  };
  persistValue(STORAGE_KEYS.onboardingData, state.onboardingData);
};

const removeEquipment = (equipmentId) => {
  state.onboardingData = {
    ...state.onboardingData,
    equipment_id: state.onboardingData.equipment_id.filter(
      (item) => item !== equipmentId,
    ),
  };
  persistValue(STORAGE_KEYS.onboardingData, state.onboardingData);
};

const Store = {
  init,
  getState,
  setCurrentPlan,
  setActiveSession,
  setOnboardingData,
  setStepComplete,
  isStepAccessible,
  updateOnboardingData,
  addEquipment,
  removeEquipment,
  isOnboardingComplete: () => {
    const { onboardingData } = state;
    return (
      onboardingData.equipment_id.length > 0 &&
      Boolean(onboardingData.smallest_increment) &&
      Boolean(onboardingData.goals)
    );
  },
};

if (typeof window !== "undefined") {
  window.Store = Store;
}

export { Store };
