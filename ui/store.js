const state = {
  currentPlan: null,
  activeSession: null,
  onboardingData: {
    equipment_id: [],
    smallest_increment: null,
    fitness_goal: null,
  },
};

const getState = () => ({
  currentPlan: state.currentPlan,
  activeSession: state.activeSession,
  onboardingData: {
    ...state.onboardingData,
    equipment_id: [...state.onboardingData.equipment_id],
  },
});

const setCurrentPlan = (plan) => {
  state.currentPlan = plan;
};

const setActiveSession = (session) => {
  state.activeSession = session;
};

const setOnboardingData = (data) => {
  state.onboardingData = {
    equipment_id: Array.isArray(data.equipment_id)
      ? [...data.equipment_id]
      : [],
    smallest_increment:
      data.smallest_increment === null ? null : Number(data.smallest_increment),
    fitness_goal: data.fitness_goal ?? null,
  };
};

const updateOnboardingData = (partialData) => {
  state.onboardingData = {
    ...state.onboardingData,
    ...partialData,
  };
};

const addEquipment = (equipmentId) => {
  if (state.onboardingData.equipment_id.includes(equipmentId)) {
    return;
  }
  state.onboardingData = {
    ...state.onboardingData,
    equipment_id: [...state.onboardingData.equipment_id, equipmentId],
  };
};

const removeEquipment = (equipmentId) => {
  state.onboardingData = {
    ...state.onboardingData,
    equipment_id: state.onboardingData.equipment_id.filter(
      (item) => item !== equipmentId
    ),
  };
};

export {
  getState,
  setCurrentPlan,
  setActiveSession,
  setOnboardingData,
  updateOnboardingData,
  addEquipment,
  removeEquipment,
};
