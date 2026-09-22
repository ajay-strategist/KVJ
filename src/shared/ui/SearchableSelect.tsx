import { useState, useRef, useEffect, useMemo } from 'react';

export interface SearchableOption {
  value: string;
  label: string;
  subLabel?: string;
}

export interface SearchableSelectProps {
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allOptionLabel?: string;
  style?: React.CSSProperties;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select Project',
  searchPlaceholder = 'Search projects...',
  allOptionLabel = 'All Projects',
  style,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch('');
    }
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.subLabel && opt.subLabel.toLowerCase().includes(q))
    );
  }, [options, search]);

  const selectedOption = useMemo(() => {
    return options.find((o) => o.value === value);
  }, [options, value]);

  const displayLabel = value === 'all' || !value
    ? allOptionLabel
    : (selectedOption ? selectedOption.label : value);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          fontSize: 12.5,
          fontWeight: 600,
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          boxSizing: 'border-box',
          outline: 'none',
          gap: 6,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left', flex: 1 }}>
          {displayLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {value !== 'all' && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0 2px',
                borderRadius: 4,
              }}
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Dropdown Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: 'max(100%, 280px)',
            maxHeight: 320,
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Search Box */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-sunken, #f8fafc)' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 8, fontSize: 12, color: 'var(--text-muted)', pointerEvents: 'none' }}>🔍</span>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 26px',
                  fontSize: 12,
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-panel, #ffffff)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 6,
                    background: 'transparent',
                    border: 'none',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', maxHeight: 250, padding: '4px 0' }}>
            {/* All Projects Option */}
            <div
              onClick={() => {
                onChange('all');
                setOpen(false);
              }}
              style={{
                padding: '7px 12px',
                fontSize: 12.5,
                fontWeight: value === 'all' ? 700 : 500,
                color: value === 'all' ? 'var(--brand)' : 'var(--text-primary)',
                background: value === 'all' ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
              onMouseEnter={(e) => {
                if (value !== 'all') e.currentTarget.style.background = 'var(--bg-sunken, #f1f5f9)';
              }}
              onMouseLeave={(e) => {
                if (value !== 'all') e.currentTarget.style.background = 'transparent';
              }}
            >
              <span>{allOptionLabel}</span>
              {value === 'all' && <span style={{ fontSize: 12 }}>✓</span>}
            </div>

            {filteredOptions.map((opt) => {
              const isSelected = value === opt.value;
              return (
                <div
                  key={opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: '7px 12px',
                    fontSize: 12.5,
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--brand)' : 'var(--text-primary)',
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '1px solid var(--border-subtle, rgba(0,0,0,0.03))',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-sunken, #f1f5f9)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </span>
                    {opt.subLabel && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{opt.subLabel}</span>
                    )}
                  </div>
                  {isSelected && <span style={{ fontSize: 12, marginLeft: 8 }}>✓</span>}
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No matching projects found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
