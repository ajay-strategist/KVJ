import { useState, useEffect } from 'react';

interface SimulatorProps {
  simulationKey: string;
  onClose: () => void;
  onNavigateToRealPage?: (route: string) => void;
}

export function TutorialSimulatorModal({
  simulationKey,
  onClose,
  onNavigateToRealPage,
}: SimulatorProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface, #ffffff)',
          color: 'var(--text-primary, #0f172a)',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: 620,
          width: '100%',
          overflow: 'hidden',
          border: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-sunken, #f8fafc)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                fontSize: 18,
                padding: '4px 8px',
                borderRadius: 8,
                background: '#e0e7ff',
                color: '#4338ca',
                fontWeight: 800,
              }}
            >
              🧪
            </span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Interactive Practice Sandbox
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Safe tutorial practice — Does NOT save or affect any live database records
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Simulator Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {simulationKey === 'sim-clock-in' && (
            <SimClockIn onComplete={() => onNavigateToRealPage?.('/app')} />
          )}

          {simulationKey === 'sim-task-timer' && (
            <SimTaskTimer onComplete={() => onNavigateToRealPage?.('/app')} />
          )}

          {simulationKey === 'sim-create-task' && (
            <SimCreateTask onComplete={() => onNavigateToRealPage?.('/app/project/tasks')} />
          )}

          {simulationKey === 'sim-calendar-schedule' && (
            <SimCalendarSchedule onComplete={() => onNavigateToRealPage?.('/app/training/calendar')} />
          )}

          {simulationKey === 'sim-submit-expense' && (
            <SimSubmitExpense onComplete={() => onNavigateToRealPage?.('/app/finance/expenses')} />
          )}

          {simulationKey === 'sim-create-batch' && (
            <SimCreateBatch onComplete={() => onNavigateToRealPage?.('/app/training/batches')} />
          )}

          {simulationKey === 'sim-add-employee' && (
            <SimAddEmployee onComplete={() => onNavigateToRealPage?.('/app/employees')} />
          )}
        </div>

        {/* Disclaimer Footer */}
        <div
          style={{
            padding: '12px 20px',
            background: '#fffbeb',
            borderTop: '1px solid #fde68a',
            fontSize: 12,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            ℹ️ <strong>Zero Database Footprint:</strong> Any action here is for learning only. You must perform the action explicitly on the actual page.
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: '1px solid #d97706',
              background: '#ffffff',
              color: '#92400e',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Done Practicing
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 1. CLOCK IN SIMULATOR ───────────────────────────────────────────────────
function SimClockIn({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<'Office' | 'Training' | 'Remote'>('Training');
  const [selectedBatch, setSelectedBatch] = useState('Christ - Christ Teachers - Batch 1');
  const [gpsVerified, setGpsVerified] = useState(false);
  const [clockedIn, setClockedIn] = useState(false);

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Attendance Clock In</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Experience how trainers clock in for their training batch with GPS coordinates so they are recognized in active training.
      </p>

      {!clockedIn ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>1. Select Work Mode:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {(['Office', 'Training', 'Remote'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: mode === m ? '2px solid #6366f1' : '1px solid var(--border)',
                    background: mode === m ? '#eef2ff' : 'var(--bg-surface)',
                    color: mode === m ? '#4f46e5' : 'var(--text-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {m === 'Office' ? '🏢 Office' : m === 'Training' ? '🎓 Training' : '🏠 Remote'}
                </button>
              ))}
            </div>
          </div>

          {mode === 'Training' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>2. Select Assigned Batch:</label>
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-surface)' }}
              >
                <option value="Christ - Christ Teachers - Batch 1">Christ - Christ Teachers - Batch 1 (Python)</option>
                <option value="MIM - UG - Batch 1">MIM - UG - Batch 1 (Data Visualization)</option>
                <option value="SJCET - 2 MBA - Batch 1">SJCET - 2 MBA - Batch 1 (Excel Expert)</option>
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>3. GPS Coordinates Check:</label>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-sunken)', borderRadius: 8 }}>
              <span style={{ fontSize: 12 }}>
                {gpsVerified ? '🟢 GPS Status: Verified (9.9842° N, 76.2743° E)' : '🟡 GPS pending verification'}
              </span>
              <button
                type="button"
                onClick={() => setGpsVerified(true)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: gpsVerified ? '#10b981' : '#6366f1',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {gpsVerified ? '✓ Verified' : 'Verify GPS'}
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!gpsVerified}
            onClick={() => setClockedIn(true)}
            style={{
              padding: 12,
              borderRadius: 8,
              border: 'none',
              background: gpsVerified ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              cursor: gpsVerified ? 'pointer' : 'not-allowed',
              marginTop: 10,
            }}
          >
            Confirm Clock In ({mode})
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 10px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎉</div>
          <h4 style={{ margin: '0 0 8px', fontSize: 16, color: '#059669' }}>Clock In Successfully Simulated!</h4>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 16px' }}>
            In FlowDesk, you are now marked as <strong>🟢 Clocked In</strong>.
            {mode === 'Training' && (
              <span> Because you selected <em>{selectedBatch}</em>, your current work shows 🎓 and you will <strong>never be flagged as idle</strong>!</span>
            )}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => { setClockedIn(false); setGpsVerified(false); }}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer' }}
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={onComplete}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              Go to Live My Day →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 2. TASK TIMER & MANDATORY PROGRESS NOTE SIMULATOR ───────────────────────
function SimTaskTimer({ onComplete }: { onComplete: () => void }) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(14);
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [workNote, setWorkNote] = useState('');
  const [loggedUpdates, setLoggedUpdates] = useState<string[]>([]);

  useEffect(() => {
    let iv: any;
    if (timerRunning) {
      iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(iv);
  }, [timerRunning]);

  const handleSaveProgress = () => {
    if (!workNote.trim()) return;
    setLoggedUpdates((prev) => [workNote.trim(), ...prev]);
    setTimerRunning(false);
    setPauseModalOpen(false);
    setWorkNote('');
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Live Task Timer & Mandatory Pause Note</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        FlowDesk enforces accountability: whenever a task is paused or switched, the employee is prompted for a brief progress note to record in the worklog.
      </p>

      <div style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-sunken)', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Task: Build SJCET KPI Dashboard Cards</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Project: Academic Analytics · Assignee: You</div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: timerRunning ? '#10b981' : 'var(--text-secondary)' }}>
            ⏱️ 00:00:{String(seconds).padStart(2, '0')}
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
          {!timerRunning ? (
            <button
              type="button"
              onClick={() => setTimerRunning(true)}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              ▶ Start Timer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPauseModalOpen(true)}
              style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
            >
              ⏸ Pause / Switch Task
            </button>
          )}
        </div>
      </div>

      {pauseModalOpen && (
        <div style={{ padding: 14, border: '2px solid #f59e0b', borderRadius: 10, background: '#fffbeb', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#b45309', marginBottom: 6 }}>
            ⏸ Mandatory Progress Note
          </div>
          <p style={{ fontSize: 12, color: '#92400e', margin: '0 0 10px' }}>
            Please write what you completed during this session before pausing or switching tasks:
          </p>
          <textarea
            rows={2}
            value={workNote}
            onChange={(e) => setWorkNote(e.target.value)}
            placeholder="e.g. Completed initial DAX calculations and verified student score card visuals."
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #fde68a', boxSizing: 'border-box', fontSize: 13 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={() => setPauseModalOpen(false)}
              style={{ padding: '5px 12px', border: '1px solid var(--border)', background: '#fff', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!workNote.trim()}
              onClick={handleSaveProgress}
              style={{ padding: '5px 14px', border: 'none', background: '#d97706', color: '#fff', borderRadius: 6, fontWeight: 700, cursor: workNote.trim() ? 'pointer' : 'not-allowed', fontSize: 12 }}
            >
              Save Progress & Pause
            </button>
          </div>
        </div>
      )}

      {loggedUpdates.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>
            📝 Worklog Updates Recorded in this Practice Session:
          </div>
          {loggedUpdates.map((u, i) => (
            <div key={i} style={{ padding: '6px 10px', background: 'var(--bg-sunken)', borderRadius: 6, fontSize: 12, marginBottom: 4 }}>
              • {u}
            </div>
          ))}
          <button
            type="button"
            onClick={onComplete}
            style={{ marginTop: 10, padding: '7px 14px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}
          >
            Practice Done — Go to Live Tasks →
          </button>
        </div>
      )}
    </div>
  );
}

// ── 3. CALENDAR MULTI-DAY SCHEDULE SIMULATOR ────────────────────────────────
function SimCalendarSchedule({ onComplete }: { onComplete: () => void }) {
  const [mode, setMode] = useState<'consecutive' | 'range'>('consecutive');
  const [daysCount, setDaysCount] = useState(3);
  const [generatedDates, setGeneratedDates] = useState<string[]>([]);

  const handleSimulateSchedule = () => {
    const dates: string[] = [];
    const base = new Date();
    let count = 0;
    let curr = new Date(base);

    while (count < daysCount) {
      if (curr.getDay() !== 0) { // Skip Sundays!
        dates.push(curr.toISOString().slice(0, 10));
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    setGeneratedDates(dates);
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Multi-Day Recurring Training Scheduler</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Test how FlowDesk calculates multi-day repeating slots and automatically protects trainers by skipping Sundays and holidays.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Select Mode:</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => setMode('consecutive')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: mode === 'consecutive' ? '2px solid #6366f1' : '1px solid var(--border)',
                background: mode === 'consecutive' ? '#eef2ff' : 'var(--bg-surface)',
                color: mode === 'consecutive' ? '#4f46e5' : 'var(--text-primary)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Consecutive Working Days
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: mode === 'range' ? '2px solid #6366f1' : '1px solid var(--border)',
                background: mode === 'range' ? '#eef2ff' : 'var(--bg-surface)',
                color: mode === 'range' ? '#4f46e5' : 'var(--text-primary)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Date Range Window
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Number of Sessions to Schedule:</label>
          <input
            type="number"
            min={1}
            max={14}
            value={daysCount}
            onChange={(e) => setDaysCount(Number(e.target.value))}
            style={{ width: 120, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>

        <button
          type="button"
          onClick={handleSimulateSchedule}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          Compute Calendar Schedule Slots
        </button>

        {generatedDates.length > 0 && (
          <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', marginBottom: 6 }}>
              ✓ Computed {generatedDates.length} Dates (Sundays Automatically Skipped):
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: '#15803d' }}>
              {generatedDates.map((d) => {
                const dayName = new Date(d).toLocaleDateString('en-US', { weekday: 'long' });
                return (
                  <li key={d}>
                    <strong>{d}</strong> ({dayName}) — Christ Teachers Batch 1
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={onComplete}
              style={{ marginTop: 10, padding: '6px 12px', borderRadius: 6, border: 'none', background: '#166534', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Go to Live Training Calendar →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 4. EXPENSE CLAIM KM CALCULATOR SIMULATOR ────────────────────────────────
function SimSubmitExpense({ onComplete }: { onComplete: () => void }) {
  const [vehicle, setVehicle] = useState<'car' | 'bike' | 'bus'>('car');
  const [km, setKm] = useState(110);
  const rate = vehicle === 'car' ? 9.5 : vehicle === 'bike' ? 4.5 : 0;
  const calculatedAmount = vehicle === 'bus' ? 60 : Math.round(km * rate);

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Travel Claim with KM Auto-Calculation</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        When trainers drive to colleges, FlowDesk calculates exact reimbursement amounts automatically using company travel policies.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Select Travel Mode:</label>
          <select
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value as any)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          >
            <option value="car">Self Travel (Car — ₹9.50 / KM)</option>
            <option value="bike">Self Travel (Bike — ₹4.50 / KM)</option>
            <option value="bus">Public Transport (Bus / Metro)</option>
          </select>
        </div>

        {vehicle !== 'bus' && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Distance Traveled (KM):</label>
            <input
              type="number"
              value={km}
              onChange={(e) => setKm(Number(e.target.value))}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </div>
        )}

        <div style={{ padding: 12, borderRadius: 8, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: 12, color: '#1e40af' }}>Reimbursement Calculation:</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>
            ₹ {calculatedAmount.toLocaleString()}
          </div>
          <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 2 }}>
            {vehicle !== 'bus' ? `${km} KM × ₹${rate}/KM` : 'Fixed fare ticket'}
          </div>
        </div>

        <button
          type="button"
          onClick={onComplete}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          Practice Done — Go to Live Expenses →
        </button>
      </div>
    </div>
  );
}

// ── 4B. TASK CREATION SIMULATOR ─────────────────────────────────────────────
function SimCreateTask({ onComplete }: { onComplete: () => void }) {
  const [taskTitle, setTaskTitle] = useState('Build Financial Report Module');
  const [project, setProject] = useState('Analytics Core');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('HIGH');
  const [estHours, setEstHours] = useState(4);
  const [created, setCreated] = useState(false);

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Create a Project Task</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Assign actionable deliverables to project boards with estimates and priority levels.
      </p>

      {created ? (
        <div style={{ padding: 16, background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8, textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, color: '#065f46' }}>Task Created Successfully in Simulation!</div>
          <p style={{ fontSize: 12, color: '#047857', margin: '4px 0 16px' }}>
            Note: This practice task was stored in-memory only. To create a live task in FlowDesk, click below.
          </p>
          <button
            type="button"
            onClick={onComplete}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Go to Live Task Board →
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Task Title *</label>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Project</label>
              <select
                value={project}
                onChange={(e) => setProject(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="Analytics Core">Analytics Core</option>
                <option value="Training Operations">Training Operations</option>
                <option value="Internal Tools">Internal Tools</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Estimated Hours</label>
            <input
              type="number"
              value={estHours}
              onChange={(e) => setEstHours(Number(e.target.value))}
              style={{ width: 120, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
            />
          </div>
          <button
            type="button"
            onClick={() => setCreated(true)}
            style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            Create Task (Sandbox Practice)
          </button>
        </div>
      )}
    </div>
  );
}

// ── 5. BATCH CREATION SIMULATOR ─────────────────────────────────────────────
function SimCreateBatch({ onComplete }: { onComplete: () => void }) {
  const [batchCode, setBatchCode] = useState('SJCET - 2 MBA - 2026-2027 - Batch 1');
  const [students, setStudents] = useState(60);

  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Create a Training Cohort</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        Configure batch naming, college mapping, and student counts for academic training.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Batch Code:</label>
          <input
            type="text"
            value={batchCode}
            onChange={(e) => setBatchCode(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Student Enrolled Count:</label>
          <input
            type="number"
            value={students}
            onChange={(e) => setStudents(Number(e.target.value))}
            style={{ width: 120, padding: 8, borderRadius: 6, border: '1px solid var(--border)' }}
          />
        </div>
        <button
          type="button"
          onClick={onComplete}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
        >
          Practice Done — Go to Live Batches →
        </button>
      </div>
    </div>
  );
}

// ── 6. ADD EMPLOYEE SIMULATOR ───────────────────────────────────────────────
function SimAddEmployee({ onComplete }: { onComplete: () => void }) {
  return (
    <div>
      <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Practice: Employee Profile Creation</h3>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
        FlowDesk enforces sequential numerical EMP codes (`EMP-001`, `EMP-002`, `EMP-401`, `EMP-708`).
      </p>
      <button
        type="button"
        onClick={onComplete}
        style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
      >
        Go to Live Employee Directory →
      </button>
    </div>
  );
}
