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
    user_id: 1,
    equipment_available: null,
    smallest_increment: null,
    goals: null,
    experience_level: null,
    schedule_days: null,
    training_days_of_week: [],
    split_variant: null,
    injuries_constraints: null,
    excluded_patterns: null,
    age: null,
    sex: null,
    height: null,
    weight: null,
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
    training_days_of_week: [...state.onboardingData.training_days_of_week],
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
    user_id: Number(data?.user_id) > 0 ? Number(data.user_id) : 1,
    equipment_available: data?.equipment_available ?? null,
    smallest_increment:
      data?.smallest_increment === null ||
      data?.smallest_increment === undefined
        ? null
        : Number(data.smallest_increment),
    goals: data?.goals ?? null,
    experience_level: data?.experience_level ?? null,
    schedule_days:
      data?.schedule_days === null || data?.schedule_days === undefined
        ? null
        : Number(data.schedule_days),
    training_days_of_week: Array.isArray(data?.training_days_of_week)
      ? data.training_days_of_week.map((day) => Number(day))
      : [],
    split_variant: data?.split_variant ?? null,
    injuries_constraints: data?.injuries_constraints ?? null,
    excluded_patterns: data?.excluded_patterns ?? null,
    age: data?.age === null || data?.age === undefined ? null : Number(data.age),
    sex: data?.sex ?? null,
    height:
      data?.height === null || data?.height === undefined
        ? null
        : Number(data.height),
    weight:
      data?.weight === null || data?.weight === undefined
        ? null
        : Number(data.weight),
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

const resetOnboarding = () => {
  state.onboardingData = {
    user_id: 1,
    equipment_available: null,
    smallest_increment: null,
    goals: null,
    experience_level: null,
    schedule_days: null,
    training_days_of_week: [],
    split_variant: null,
    injuries_constraints: null,
    excluded_patterns: null,
    age: null,
    sex: null,
    height: null,
    weight: null,
  };
  state.completedSteps = [];
  persistValue(STORAGE_KEYS.onboardingData, state.onboardingData);
  persistValue(STORAGE_KEYS.completedSteps, state.completedSteps);
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
  resetOnboarding,
  isOnboardingComplete: () => {
    const { onboardingData } = state;
    return (
      Boolean(onboardingData.user_id) &&
      Boolean(onboardingData.equipment_available) &&
      Boolean(onboardingData.smallest_increment) &&
      Boolean(onboardingData.goals) &&
      Boolean(onboardingData.experience_level) &&
      Boolean(onboardingData.schedule_days) &&
      onboardingData.training_days_of_week.length ===
        Number(onboardingData.schedule_days)
    );
  },
};

if (typeof window !== "undefined") {
  window.Store = Store;
}

export { Store };
