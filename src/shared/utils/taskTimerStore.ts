/**
 * Global Task Timer Store — synchronizes task work timer state across
 * MyDay dashboard, TaskBoard, and all workspace pages in real-time.
 * 
 * Continuous Task Duration Accumulation:
 * - Timers continuously accumulate across multiple Start, Pause, and Resume operations.
 * - Resuming a task starts from the previously accumulated duration mark, not zero.
 * - Multi-day continuity is preserved without artificial midnight resets.
 */

export interface TaskTimerState {
  taskId: string;
  startTime: number;
  elapsedMs: number;
  isRunning: boolean;
}

const STORAGE_KEY = 'kvj_task_timers';
const MY_DAY_KEY = 'kvj_task_timer_state_v1';

type TimerListener = (timers: Record<string, TaskTimerState>) => void;
const listeners = new Set<TimerListener>();

function loadTimers(): Record<string, TaskTimerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const result: Record<string, TaskTimerState> = raw ? JSON.parse(raw) : {};

    // Merge from MyDay storage key if present
    const rawMyDay = localStorage.getItem(MY_DAY_KEY);
    if (rawMyDay) {
      const myDayData: Record<string, { secondsToday: number; active: boolean; lastStartTime?: number; date?: string; underReview?: boolean }> = JSON.parse(rawMyDay);
      Object.entries(myDayData).forEach(([id, val]) => {
        // If task is underReview, it can never be running
        const isRunning = !val.underReview && !!val.active;

        if (!result[id]) {
          let elapsed = (val.secondsToday || 0) * 1000;
          if (isRunning && val.lastStartTime) {
            // Subtract active session duration to prevent double-counting
            const activeSessionDuration = Math.max(0, Date.now() - val.lastStartTime);
            elapsed = Math.max(0, elapsed - activeSessionDuration);
          }
          result[id] = {
            taskId: id,
            startTime: val.lastStartTime || Date.now(),
            elapsedMs: elapsed,
            isRunning,
          };
        } else {
          const wasRunning = result[id].isRunning;
          result[id].isRunning = isRunning;
          if (isRunning) {
            // If the task is running, do NOT overwrite elapsedMs with ticking val.secondsToday
            if (!wasRunning) {
              result[id].startTime = val.lastStartTime || Date.now();
            }
          } else {
            // If the task is paused, update elapsedMs from stored value if higher
            if (val.secondsToday && val.secondsToday * 1000 > result[id].elapsedMs) {
              result[id].elapsedMs = val.secondsToday * 1000;
            }
          }
        }
      });
    }

    return result;
  } catch {
    return {};
  }
}

function saveTimers(timers: Record<string, TaskTimerState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));

    // Also sync to MyDay key format for backward compatibility, preserving underReview status
    let existingMyDay: Record<string, any> = {};
    try {
      const raw = localStorage.getItem(MY_DAY_KEY);
      if (raw) existingMyDay = JSON.parse(raw);
    } catch {}

    const myDayStates: Record<string, any> = { ...existingMyDay };
    Object.entries(timers).forEach(([id, t]) => {
      let sec = Math.floor(t.elapsedMs / 1000);
      if (t.isRunning) {
        sec += Math.floor((Date.now() - t.startTime) / 1000);
      }
      myDayStates[id] = {
        ...myDayStates[id],
        secondsToday: sec,
        active: t.isRunning,
        lastStartTime: t.startTime,
      };
      if (t.isRunning) {
        delete myDayStates[id].underReview;
      }
    });
    localStorage.setItem(MY_DAY_KEY, JSON.stringify(myDayStates));
  } catch {}
}

export const taskTimerStore = {
  getTimers(): Record<string, TaskTimerState> {
    return loadTimers();
  },

  getTimer(taskId: string): TaskTimerState | undefined {
    return loadTimers()[taskId];
  },

  subscribe(listener: TimerListener) {
    listeners.add(listener);

    const handleCustom = () => listener(loadTimers());
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === MY_DAY_KEY) {
        listener(loadTimers());
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('kvj_task_timer_updated', handleCustom);

    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('kvj_task_timer_updated', handleCustom);
    };
  },

  notify() {
    const current = loadTimers();
    listeners.forEach((fn) => fn(current));
    try {
      window.dispatchEvent(new CustomEvent('kvj_task_timer_updated'));
    } catch {}
  },

  startTask(taskId: string, initialElapsedMs?: number) {
    const current = loadTimers();
    const now = Date.now();

    // Auto-pause any other running task in the global store to ensure
    // only one task runs at a time and prevent timesheet corruption
    Object.keys(current).forEach((id) => {
      if (id !== taskId && current[id].isRunning) {
        const existing = current[id];
        const sessionElapsed = now - existing.startTime;
        current[id] = {
          taskId: id,
          startTime: now,
          elapsedMs: existing.elapsedMs + Math.max(0, sessionElapsed),
          isRunning: false,
        };
      }
    });

    const existing = current[taskId];
    if (existing?.isRunning) {
      // Already running; avoid resetting startTime or triggering redundant updates
      return;
    }
    const baseElapsed = Math.max(
      existing ? existing.elapsedMs : 0,
      initialElapsedMs || 0
    );
    current[taskId] = {
      taskId,
      startTime: now,
      elapsedMs: baseElapsed,
      isRunning: true,
    };
    saveTimers(current);
    this.notify();
  },

  pauseTask(taskId: string) {
    const current = loadTimers();
    const existing = current[taskId];
    if (!existing) {
      current[taskId] = {
        taskId,
        startTime: Date.now(),
        elapsedMs: 0,
        isRunning: false,
      };
    } else {
      const sessionElapsed = existing.isRunning ? (Date.now() - existing.startTime) : 0;
      current[taskId] = {
        taskId,
        startTime: Date.now(),
        elapsedMs: existing.elapsedMs + Math.max(0, sessionElapsed),
        isRunning: false,
      };
    }
    saveTimers(current);
    this.notify();
  },

  resetTask(taskId: string) {
    const current = loadTimers();
    delete current[taskId];
    saveTimers(current);
    this.notify();
  },

  syncTaskTime(taskId: string, actualHours: number) {
    const current = loadTimers();
    const dbMs = Math.round((actualHours || 0) * 3600 * 1000);
    const existing = current[taskId];

    if (!existing) {
      current[taskId] = {
        taskId,
        startTime: Date.now(),
        elapsedMs: dbMs,
        isRunning: false,
      };
      saveTimers(current);
      this.notify();
    } else if (!existing.isRunning && dbMs > existing.elapsedMs) {
      current[taskId] = {
        ...existing,
        elapsedMs: dbMs,
      };
      saveTimers(current);
      this.notify();
    }
  },
};
