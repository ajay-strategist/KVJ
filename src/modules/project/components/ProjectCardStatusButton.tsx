import { useState, useRef, useEffect } from 'react';
import type { ProjectStatusLabel } from '../pages/ProjectList';

export interface ProjectCardStatusButtonProps {
  status: ProjectStatusLabel;
  onChange: (newStatusValue: string, newStatusLabel: ProjectStatusLabel) => void;
  loading?: boolean;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  ProjectStatusLabel,
  {
    value: string;
    label: ProjectStatusLabel;
    tone: 'neutral' | 'progress' | 'success';
    dotColor: string;
    bg: string;
    color: string;
    border: string;
  }
> = {
  'Not Started': {
    value: 'not_started',
    label: 'Not Started',
    tone: 'neutral',
    dotColor: '#94a3b8',
    bg: 'var(--status-neutral-bg, #f1f5f9)',
    color: 'var(--status-neutral, #475569)',
    border: 'var(--status-neutral-border, #cbd5e1)',
  },
  'In Progress': {
    value: 'execution',
    label: 'In Progress',
    tone: 'progress',
    dotColor: '#3b82f6',
    bg: 'var(--status-progress-bg, #eff6ff)',
    color: 'var(--status-progress, #2563eb)',
    border: 'var(--status-progress-border, #bfdbfe)',
  },
  'Completed': {
    value: 'closure',
    label: 'Completed',
    tone: 'success',
    dotColor: '#10b981',
    bg: 'var(--status-success-bg, #f0fdf4)',
    color: 'var(--status-success, #16a34a)',
    border: 'var(--status-success-border, #bbf7d0)',
  },
};

export function ProjectCardStatusButton({
  status,
  onChange,
  loading = false,
  disabled = false,
}: ProjectCardStatusButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const currentCfg = STATUS_CONFIG[status] || STATUS_CONFIG['Not Started'];

  const handleSelect = (val: string, lbl: ProjectStatusLabel) => {
    setIsOpen(false);
    if (lbl !== status) {
      onChange(val, lbl);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        zIndex: isOpen ? 60 : 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title="Click to change project status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          padding: '4px 10px',
          borderRadius: 20,
          letterSpacing: '0.01em',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          border: `1px solid ${currentCfg.border}`,
          background: currentCfg.bg,
          color: currentCfg.color,
          cursor: disabled || loading ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.15s ease',
          boxShadow: isOpen ? '0 0 0 2px var(--brand-muted, rgba(99,102,241,0.25))' : 'none',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: currentCfg.dotColor,
            flexShrink: 0,
          }}
        />
        <span>{status}</span>
        {loading ? (
          <span
            className="kvj-btn__spinner"
            style={{
              width: 10,
              height: 10,
              borderWidth: 1.5,
              borderColor: 'currentColor',
              borderTopColor: 'transparent',
              marginLeft: 2,
            }}
          />
        ) : (
          <span
            style={{
              fontSize: 9,
              opacity: 0.75,
              marginLeft: 2,
              display: 'inline-block',
              transition: 'transform 0.15s ease',
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          >
            ▼
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            minWidth: 160,
            background: 'var(--bg-panel, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.18), 0 8px 10px -6px rgba(0,0,0,0.1)',
            padding: 4,
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: '4px 8px 6px',
              fontSize: 10.5,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted, #94a3b8)',
              borderBottom: '1px solid var(--border, #f1f5f9)',
              marginBottom: 4,
            }}
          >
            Change Status
          </div>
          {(Object.keys(STATUS_CONFIG) as ProjectStatusLabel[]).map((labelKey) => {
            const item = STATUS_CONFIG[labelKey];
            const isSelected = labelKey === status;
            return (
              <button
                key={labelKey}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(item.value, item.label)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: isSelected ? 'var(--bg-sunken, #f8fafc)' : 'transparent',
                  color: isSelected ? item.color : 'var(--text-primary, #1e293b)',
                  fontSize: 12.5,
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isSelected ? 'var(--bg-sunken, #f8fafc)' : '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSelected ? 'var(--bg-sunken, #f8fafc)' : 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: item.dotColor,
                      flexShrink: 0,
                    }}
                  />
                  <span>{item.label}</span>
                </div>
                {isSelected && (
                  <span style={{ color: item.color, fontSize: 13, fontWeight: 800 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
