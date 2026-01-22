const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const normalizeGoal = (raw) => {
  if (!raw) {
    return null;
  }
  return String(raw)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const normalizeExperience = (raw) => {
  if (!raw) {
    return null;
  }
  return String(raw)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
};

const getWeekdayIndex = (date) => {
  const jsDay = date.getDay();
  return (jsDay + 6) % 7;
};

const parseIsoDate = (value) => {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
};

const formatDateLabel = (value) => {
  const parsed = parseIsoDate(value);
  if (!parsed) {
    return "Unknown";
  }
  return parsed.toISOString().slice(0, 10);
};

const groupExercisesByDay = (items = []) => {
  const grouped = new Map();
  items.forEach((item) => {
    const dayIndex = Number(item.day_index ?? item.dayIndex ?? item.day ?? 0);
    if (!grouped.has(dayIndex)) {
      grouped.set(dayIndex, {
        day_index: dayIndex,
        session_type: item.session_type ?? item.sessionType ?? "Session",
        exercises: [],
      });
    }
    const entry = grouped.get(dayIndex);
    const name =
      item.name ?? item.exercise_name ?? item.exerciseName ?? item.exercise?.name;
    entry.exercises.push({
      name: name ?? "Unnamed Exercise",
      sequence: Number(item.sequence ?? item.order ?? entry.exercises.length + 1),
      target_sets: item.target_sets ?? item.targetSets ?? null,
      target_reps_min: item.target_reps_min ?? item.targetRepsMin ?? null,
      target_reps_max: item.target_reps_max ?? item.targetRepsMax ?? null,
    });
  });
  return Array.from(grouped.values()).sort(
    (a, b) => a.day_index - b.day_index,
  );
};

const normalizeWorkouts = (raw) => {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw.workouts)) {
    return raw.workouts;
  }
  if (Array.isArray(raw.sessions)) {
    return raw.sessions;
  }
  if (Array.isArray(raw.days)) {
    return raw.days;
  }
  if (Array.isArray(raw.plan_workouts)) {
    return raw.plan_workouts;
  }
  if (Array.isArray(raw.planned_exercises)) {
    return groupExercisesByDay(raw.planned_exercises);
  }
  return [];
};

const normalizePlanData = (raw) => {
  if (!raw) {
    return null;
  }
  const plan = raw.plan ?? raw;
  const trainingDays =
    plan.training_days_of_week ?? plan.trainingDaysOfWeek ?? [];
  const workouts = normalizeWorkouts(raw).map((workout, index) => {
    const exercises = Array.isArray(workout.exercises)
      ? workout.exercises
      : Array.isArray(workout.planned_exercises)
        ? workout.planned_exercises
        : [];
    return {
      day_index: Number(workout.day_index ?? workout.dayIndex ?? index),
      session_type: workout.session_type ?? workout.sessionType ?? "Session",
      exercises: exercises.map((exercise, index) => ({
        name:
          exercise.name ??
          exercise.exercise_name ??
          exercise.exerciseName ??
          exercise.exercise?.name ??
          "Unnamed Exercise",
        sequence: Number(
          exercise.sequence ?? exercise.order ?? exercise.position ?? index + 1,
        ),
        target_sets: exercise.target_sets ?? exercise.targetSets ?? null,
        target_reps_min: exercise.target_reps_min ?? exercise.targetRepsMin ?? null,
        target_reps_max: exercise.target_reps_max ?? exercise.targetRepsMax ?? null,
      })),
    };
  });

  return {
    id: plan.id ?? plan.plan_id ?? plan.planId ?? null,
    name: plan.name ?? "Generated Plan",
    start_date: plan.start_date ?? plan.startDate ?? null,
    weeks: plan.weeks ?? null,
    goals: normalizeGoal(plan.goals ?? plan.goal ?? plan.primary_goal),
    experience_level: normalizeExperience(
      plan.experience_level ?? plan.experienceLevel,
    ),
    schedule_days:
      plan.schedule_days ??
      plan.scheduleDays ??
      (Array.isArray(trainingDays) ? trainingDays.length : null),
    training_days_of_week: Array.isArray(trainingDays) ? trainingDays : [],
    workouts,
  };
};

export {
  DAY_LABELS,
  formatDateLabel,
  getWeekdayIndex,
  normalizePlanData,
  parseIsoDate,
};
