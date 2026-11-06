import { useTutorial } from './TutorialContext';

export function SafeDemoModeBanner() {
  const { isDemoMode, setDemoMode, resetDemoState } = useTutorial();

  if (!isDemoMode) return null;

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 99980,
        width: '100%',
        background: 'linear-gradient(90deg, #d97706, #b45309)',
        color: '#ffffff',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 4px 12px rgba(180, 83, 9, 0.25)',
        fontSize: 12.5,
        fontWeight: 600,
        animation: 'slideDown 180ms ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 16 }}>🧪</span>
        <div>
          <span>
            <strong>Safe Demo Mode Active:</strong> You are in a non-persistent practice sandbox.
          </span>
          <span style={{ opacity: 0.9, marginLeft: 6, display: 'inline-block' }}>
            Actions taken here do NOT save to the database.
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          onClick={() => {
            resetDemoState();
            alert('Demo sandbox state has been reset to defaults.');
          }}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.4)',
            background: 'rgba(255,255,255,0.15)',
            color: '#ffffff',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 120ms',
          }}
          title="Reset sandbox dummy data"
        >
          🧹 Reset Demo Data
        </button>

        <button
          type="button"
          onClick={() => setDemoMode(false)}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            background: '#ffffff',
            color: '#92400e',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
        >
          Exit Demo Mode
        </button>
      </div>
    </div>
  );
}

