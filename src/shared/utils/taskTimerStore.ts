/**
 * Global Task Timer Store — synchronizes task work timer state across
 * MyDay dashboard, TaskBoard, and all workspace pages in real-time.
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

function getTodayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isSameDay(timestampMs: number): boolean {
  const d = new Date(timestampMs);
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return ds === getTodayDateStr();
}

function loadTimers(): Record<string, TaskTimerState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const result: Record<string, TaskTimerState> = raw ? JSON.parse(raw) : {};

    // Guard: if a running timer's startTime is from a previous day, reset it
    // so stale elapsed time is not carried over into today's counter.
    Object.keys(result).forEach((id) => {
      const t = result[id];
      if (t.isRunning && t.startTime && !isSameDay(t.startTime)) {
        result[id] = { ...t, isRunning: false, elapsedMs: 0 };
      }
    });

    // Merge from MyDay storage key if present
    const rawMyDay = localStorage.getItem(MY_DAY_KEY);
    if (rawMyDay) {
      const myDayData: Record<string, { secondsToday: number; active: boolean; lastStartTime?: number; date?: string }> = JSON.parse(rawMyDay);
      const todayStr = getTodayDateStr();
      Object.entries(myDayData).forEach(([id, val]) => {
        // Skip stale entries from a previous day
        const isStale = val.date && val.date !== todayStr;
        if (isStale) return;

        if (!result[id]) {
          result[id] = {
            taskId: id,
            startTime: val.lastStartTime || Date.now(),
            elapsedMs: (val.secondsToday || 0) * 1000,
            isRunning: !!val.active && !!(val.lastStartTime && isSameDay(val.lastStartTime)),
          };
        } else {
          result[id].isRunning = !!val.active && !!(val.lastStartTime && isSameDay(val.lastStartTime));
          if (val.secondsToday && val.secondsToday * 1000 > result[id].elapsedMs) {
            result[id].elapsedMs = val.secondsToday * 1000;
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

    // Also sync to MyDay key format for backward compatibility
    const myDayStates: Record<string, any> = {};
    Object.entries(timers).forEach(([id, t]) => {
      let sec = Math.floor(t.elapsedMs / 1000);
      if (t.isRunning) {
        sec += Math.floor((Date.now() - t.startTime) / 1000);
      }
      myDayStates[id] = {
        secondsToday: sec,
        active: t.isRunning,
        lastStartTime: t.startTime,
      };
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

  startTask(taskId: string) {
    const current = loadTimers();
    const existing = current[taskId];
    current[taskId] = {
      taskId,
      startTime: Date.now(),
      elapsedMs: existing ? existing.elapsedMs : 0,
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
};
