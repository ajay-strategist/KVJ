import { useState, useRef, useEffect } from 'react';

export interface ChecklistOption {
  value: string;
  label: string;
}

export interface ChecklistMultiSelectProps {
  options: ChecklistOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function ChecklistMultiSelect({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select Statuses',
  style,
}: ChecklistMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const allSelected = selectedValues.length === 0 || selectedValues.length === options.length;

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      const next = selectedValues.filter((v) => v !== val);
      onChange(next);
    } else {
      const next = [...selectedValues, val];
      onChange(next.length === options.length ? [] : next);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleClearAll = () => {
    // Select none (or first)
    onChange(['__none__']);
  };

  const getButtonText = () => {
    if (allSelected || selectedValues.includes('all')) return 'All Statuses';
    if (selectedValues.length === 0 || selectedValues.includes('__none__')) return 'None Selected';
    if (selectedValues.length === 1) {
      const found = options.find((o) => o.value === selectedValues[0]);
      return found ? found.label : selectedValues[0];
    }
    const firstFound = options.find((o) => o.value === selectedValues[0]);
    const firstLabel = firstFound ? firstFound.label : selectedValues[0];
    return `${firstLabel} (+${selectedValues.length - 1} more)`;
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block', width: '100%', ...style }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel, var(--bg-surface))',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          boxSizing: 'border-box',
          outline: 'none',
          gap: 6,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getButtonText()}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Checklist Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 999,
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.15))',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 200,
          }}
        >
          {/* Action Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            <button
              type="button"
              onClick={handleSelectAll}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--brand, #2563eb)',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              ✓ Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              ✕ Clear All
            </button>
          </div>

          {/* Checklist Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
            {options.map((opt) => {
              const isChecked = allSelected || selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12.5,
                    fontWeight: isChecked ? 700 : 500,
                    color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: isChecked ? 'var(--bg-sunken)' : 'transparent',
                    userSelect: 'none',
                    transition: 'background 0.1s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOption(opt.value)}
                    style={{ cursor: 'pointer', width: 15, height: 15, accentColor: 'var(--brand, #2563eb)' }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
