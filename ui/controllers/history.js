import { ViewManager } from "../js/view-manager.js";

class HistoryController {
  constructor({ store, viewManager } = {}) {
    this.store = store;
    this.viewManager = viewManager ?? new ViewManager();
    this.root = document.querySelector('[data-screen-id="history"]');
    this.statusAlert = document.querySelector("[data-history-status]");
    this.sessionList = document.querySelector("[data-history-session-list]");
    this.exerciseList = document.querySelector("[data-history-exercise-list]");
    this.bestSetsPanel = document.querySelector("[data-history-best-sets]");
    this.recentLogsBody = document.querySelector("[data-history-recent-logs]");
    this.trendLabel = document.querySelector("[data-history-trend]");
    this.volumeBars = document.querySelector("[data-history-volume-bars]");
    this.sessions = [];
    this.exercises = [];
    this.activeExerciseId = null;
  }

  init() {
    if (!this.root) {
      return;
    }
    this.bindEvents();
    this.loadSessions();
    window.addEventListener("session:saved", () => {
      this.loadSessions();
    });
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => {
      const exerciseButton = event.target.closest("[data-history-exercise]");
      if (exerciseButton) {
        const exerciseId = Number(exerciseButton.dataset.historyExercise ?? 0);
        if (Number.isFinite(exerciseId) && exerciseId > 0) {
          this.selectExercise(exerciseId);
        }
        return;
      }

      const sessionButton = event.target.closest("[data-history-session]");
      if (sessionButton) {
        const sessionId = sessionButton.dataset.historySession ?? null;
        this.openSessionDetail(sessionId);
      }
    });
  }

  async loadSessions() {
    if (!this.sessionList) {
      return;
    }
    this.setStatus("History loading...", false);
    const userId = Number(this.store?.getState?.()?.onboardingData?.user_id ?? 1);
    const query = Number.isFinite(userId) ? `?user_id=${userId}` : "";

    try {
      const response = await fetch(`/workouts/sessions${query}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "History request failed");
      }
      const payload = await response.json();
      this.sessions = Array.isArray(payload) ? payload : payload?.sessions ?? [];
      this.renderSessions();
      this.buildExerciseList();
      this.setStatus("History synchronized.", false);
    } catch (error) {
      this.sessions = [];
      this.renderSessions();
      this.buildExerciseList();
      this.setStatus(
        `History fetch failed: ${error?.message ?? "Unknown error"}`,
        true,
      );
    }
  }

  setStatus(message, isError) {
    if (!this.statusAlert) {
      return;
    }
    this.statusAlert.textContent = message;
    this.statusAlert.classList.remove("panel__alert--hidden");
    this.statusAlert.classList.toggle("panel__alert--error", isError);
  }

  renderSessions() {
    if (!this.sessionList) {
      return;
    }
    if (!this.sessions.length) {
      this.sessionList.innerHTML =
        '<div class="history-entry">No sessions available.</div>';
      return;
    }

    this.sessionList.innerHTML = this.sessions
      .map((session) => {
        const sessionId = session.id ?? session.session_id ?? session.sessionId;
        const dateLabel = this.formatDate(
          session.performed_at ?? session.started_at ?? session.date,
        );
        const duration = session.duration_minutes ?? session.duration ?? null;
        const durationLabel = duration ? `${duration} min` : "--";
        const statusLabel = this.formatCompletion(
          session.completion_status ?? session.status ?? null,
        );
        return `
          <button
            class="history-entry"
            type="button"
            data-history-session="${sessionId ?? ""}"
          >
            <span class="history-entry__title">${dateLabel}</span>
            <span class="history-entry__meta">Duration: ${durationLabel}</span>
            <span class="history-entry__meta">Status: ${statusLabel}</span>
          </button>
        `;
      })
      .join("");
  }

  buildExerciseList() {
    if (!this.exerciseList) {
      return;
    }
    const exerciseMap = new Map();

    this.sessions.forEach((session) => {
      const entries = this.extractExerciseEntries(session);
      entries.forEach(({ id, name }) => {
        if (!id) {
          return;
        }
        if (!exerciseMap.has(id)) {
          exerciseMap.set(id, name || `Exercise ${id}`);
        }
      });
    });

    this.exercises = Array.from(exerciseMap, ([id, name]) => ({ id, name }));

    if (!this.exercises.length) {
      this.exerciseList.innerHTML =
        '<div class="history-entry">Exercises unavailable.</div>';
      this.clearExerciseDetail();
      return;
    }

    this.exerciseList.innerHTML = this.exercises
      .map((exercise) => {
        const isActive = exercise.id === this.activeExerciseId;
        return `
          <button
            class="history-entry ${isActive ? "history-entry--active" : ""}"
            type="button"
            data-history-exercise="${exercise.id}"
          >
            <span class="history-entry__title">${exercise.name}</span>
            <span class="history-entry__meta">ID: ${exercise.id}</span>
          </button>
        `;
      })
      .join("");

    if (!this.activeExerciseId && this.exercises.length) {
      this.selectExercise(this.exercises[0].id);
    }
  }

  extractExerciseEntries(session) {
    const candidates =
      session.exercises ?? session.exercise_logs ?? session.set_logs ?? [];
    if (!Array.isArray(candidates)) {
      return [];
    }
    return candidates
      .map((entry) => ({
        id: Number(entry.exercise_id ?? entry.exerciseId ?? entry.id ?? 0),
        name: entry.exercise_name ?? entry.name ?? entry.exercise ?? null,
      }))
      .filter((entry) => Number.isFinite(entry.id) && entry.id > 0);
  }

  async selectExercise(exerciseId) {
    if (!Number.isFinite(exerciseId) || exerciseId <= 0) {
      return;
    }
    this.activeExerciseId = exerciseId;
    this.updateExerciseSelection();
    await this.loadExerciseHistory(exerciseId);
  }

  updateExerciseSelection() {
    if (!this.exerciseList) {
      return;
    }
    this.exerciseList
      .querySelectorAll("[data-history-exercise]")
      .forEach((button) => {
        const id = Number(button.dataset.historyExercise ?? 0);
        button.classList.toggle("history-entry--active", id === this.activeExerciseId);
      });
  }

  async loadExerciseHistory(exerciseId) {
    if (!this.bestSetsPanel || !this.recentLogsBody || !this.trendLabel) {
      return;
    }

    this.bestSetsPanel.innerHTML = "";
    this.recentLogsBody.innerHTML = "";
    this.trendLabel.textContent = "Volume Trend (7-day): Status pending.";
    if (this.volumeBars) {
      this.volumeBars.textContent = "";
    }

    const userId = Number(this.store?.getState?.()?.onboardingData?.user_id ?? 1);
    const query = Number.isFinite(userId) ? `?user_id=${userId}` : "";

    try {
      const response = await fetch(`/exercises/${exerciseId}/history${query}`);
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Exercise history failed");
      }
      const payload = await response.json();
      const { bestSets, recentSessions } = this.normalizeHistoryPayload(payload);
      this.renderBestSets(bestSets);
      const sessionEntries = this.normalizeRecentSessions(recentSessions);
      this.renderRecentLogs(sessionEntries);
      this.renderVolumeTrend(sessionEntries);
      this.renderVolumeBars(sessionEntries);
    } catch (error) {
      this.bestSetsPanel.innerHTML =
        '<div class="history-entry">No history available.</div>';
      this.recentLogsBody.innerHTML =
        '<tr><td colspan="4">No recent logs available.</td></tr>';
      this.trendLabel.textContent = "Status: Plateau.";
      if (this.volumeBars) {
        this.volumeBars.textContent = "";
      }
    }
  }

  normalizeHistoryPayload(payload) {
    const bestSets = Array.isArray(payload?.best_sets)
      ? payload.best_sets
      : Array.isArray(payload?.bestSets)
        ? payload.bestSets
        : [];
    const recentSessions = Array.isArray(payload?.recent_sessions)
      ? payload.recent_sessions
      : Array.isArray(payload?.recentSessions)
        ? payload.recentSessions
        : [];
    return { bestSets, recentSessions };
  }

  renderBestSets(bestSets) {
    if (!this.bestSetsPanel) {
      return;
    }
    if (!bestSets.length) {
      this.bestSetsPanel.innerHTML =
        '<div class="history-entry">No best sets recorded.</div>';
      return;
    }
    const ranked = bestSets
      .map((entry) => ({
        weight: Number(entry.weight ?? 0),
        reps: Number(entry.reps ?? 0),
        date: entry.performed_at ?? null,
        setNumber: entry.set_number ?? entry.setNumber ?? null,
      }))
      .filter((entry) => Number.isFinite(entry.weight) && Number.isFinite(entry.reps));

    if (!ranked.length) {
      this.bestSetsPanel.innerHTML =
        '<div class="history-entry">No best sets recorded.</div>';
      return;
    }

    this.bestSetsPanel.innerHTML = ranked
      .map((entry, index) => {
        const dateLabel = this.formatDate(entry.date);
        const setLabel = entry.setNumber ? `Set ${entry.setNumber}` : "Set";
        return `
          <div class="history-entry">
            <span class="history-entry__title">Rank ${index + 1}</span>
            <span class="history-entry__meta">${entry.weight} lb x ${entry.reps}</span>
            <span class="history-entry__meta">${setLabel} | ${dateLabel}</span>
          </div>
        `;
      })
      .join("");
  }

  normalizeRecentSessions(recentSessions) {
    return recentSessions
      .map((session) => {
        const sets = Array.isArray(session.sets) ? session.sets : [];
        const volume = sets.reduce((total, set) => {
          const weight = Number(set.weight ?? 0);
          const reps = Number(set.reps ?? 0);
          if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
            return total;
          }
          return total + weight * reps;
        }, 0);
        return {
          date: session.performed_at ?? null,
          volume,
          sets: sets.length,
          status: session.completion_status ?? session.status ?? "logged",
        };
      })
      .filter((entry) => entry.date)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  renderRecentLogs(entries) {
    if (!this.recentLogsBody) {
      return;
    }
    if (!entries.length) {
      this.recentLogsBody.innerHTML =
        '<tr><td colspan="4">No recent logs available.</td></tr>';
      return;
    }

    this.recentLogsBody.innerHTML = entries.slice(0, 5)
      .map((entry) => {
        const statusLabel = this.formatCompletion(entry.status);
        return `
          <tr>
            <td>${this.formatDate(entry.date)}</td>
            <td>${entry.sets}</td>
            <td>${Math.round(entry.volume)}</td>
            <td>${statusLabel}</td>
          </tr>
        `;
      })
      .join("");
  }

  renderVolumeTrend(entries) {
    if (!this.trendLabel) {
      return;
    }
    if (!entries.length) {
      this.trendLabel.textContent = "Status: Plateau.";
      return;
    }

    const { currentAvg, previousAvg } = this.computeRollingAverage(entries);
    if (!Number.isFinite(currentAvg) || !Number.isFinite(previousAvg) || previousAvg === 0) {
      this.trendLabel.textContent = "Status: Plateau.";
      return;
    }
    const change = ((currentAvg - previousAvg) / previousAvg) * 100;
    if (Math.abs(change) < 1) {
      this.trendLabel.textContent = "Status: Plateau.";
      return;
    }
    const sign = change > 0 ? "+" : "";
    this.trendLabel.textContent = `Volume Trend (7-day): ${sign}${change.toFixed(1)}%`;
  }

  renderVolumeBars(entries) {
    if (!this.volumeBars) {
      return;
    }
    if (!entries.length) {
      this.volumeBars.textContent = "";
      return;
    }
    const lastSeven = entries.slice(0, 7).reverse();
    const volumes = lastSeven.map((entry) => entry.volume);
    const maxVolume = Math.max(...volumes, 1);
    const lines = lastSeven.map((entry) => {
      const barLength = Math.round((entry.volume / maxVolume) * 20);
      const bar = "#".repeat(barLength || 1);
      return `${this.formatDate(entry.date)} | ${bar} ${Math.round(entry.volume)}`;
    });
    this.volumeBars.textContent = lines.join("\n");
  }

  computeRollingAverage(entries) {
    const volumeByDate = new Map();
    entries.forEach((entry) => {
      const date = this.normalizeDate(entry.date);
      if (!date) {
        return;
      }
      const key = date.toISOString().slice(0, 10);
      volumeByDate.set(key, entry.volume);
    });

    const latestDate = this.normalizeDate(entries[0]?.date);
    if (!latestDate) {
      return { currentAvg: NaN, previousAvg: NaN };
    }

    const currentAvg = this.averageVolumeForRange(latestDate, volumeByDate, 0);
    const previousAvg = this.averageVolumeForRange(latestDate, volumeByDate, 7);
    return { currentAvg, previousAvg };
  }

  averageVolumeForRange(latestDate, volumeByDate, offsetDays) {
    let total = 0;
    for (let i = offsetDays; i < offsetDays + 7; i += 1) {
      const date = new Date(latestDate);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      total += volumeByDate.get(key) ?? 0;
    }
    return total / 7;
  }

  openSessionDetail(sessionId) {
    if (!sessionId) {
      return;
    }
    const session = this.sessions.find((entry) => {
      const id = entry.id ?? entry.session_id ?? entry.sessionId;
      return String(id) === String(sessionId);
    });
    if (!session) {
      return;
    }
    const payload = { ...session, readOnly: true };
    this.store.initializeSession(payload);
    window.dispatchEvent(new CustomEvent("session:started"));
    this.viewManager.show("session_detail");
  }

  clearExerciseDetail() {
    if (this.bestSetsPanel) {
      this.bestSetsPanel.innerHTML =
        '<div class="history-entry">No exercise selected.</div>';
    }
    if (this.recentLogsBody) {
      this.recentLogsBody.innerHTML =
        '<tr><td colspan="4">No exercise selected.</td></tr>';
    }
    if (this.trendLabel) {
      this.trendLabel.textContent = "Status: Plateau.";
    }
    if (this.volumeBars) {
      this.volumeBars.textContent = "";
    }
  }

  formatDate(value) {
    if (!value) {
      return "--";
    }
    const date = this.normalizeDate(value);
    if (!date) {
      return "--";
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
  }

  normalizeDate(value) {
    if (!value) {
      return null;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  formatCompletion(value) {
    const normalized = String(value ?? "").toLowerCase();
    if (normalized === "completed") {
      return "Completed";
    }
    if (normalized === "partial") {
      return "Partial";
    }
    if (normalized === "skipped") {
      return "Skipped";
    }
    return "Partial";
  }
}

export { HistoryController };
