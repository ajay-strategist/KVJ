import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import type { Batch, ApprovedBatchStatus } from '../../modules/training/training.repository';
import { normalizeBatchPhase } from '../../modules/training/training.repository';

export interface SearchableBatchSelectProps {
  value?: string;
  onChange: (batchId: string, batch?: Batch) => void;
  batches: Batch[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  error?: string;
  className?: string;
  showStatus?: boolean;
  id?: string;
  name?: string;
}

const STATUS_BADGE_STYLE: Record<ApprovedBatchStatus, { bg: string; fg: string; border: string }> = {
  'Not Started': { bg: 'rgba(148, 163, 184, 0.12)', fg: '#475569', border: 'rgba(148, 163, 184, 0.35)' },
  'In Progress': { bg: 'rgba(59, 130, 246, 0.12)', fg: '#1d4ed8', border: 'rgba(59, 130, 246, 0.35)' },
  'Completed':   { bg: 'rgba(16, 185, 129, 0.12)', fg: '#047857', border: 'rgba(16, 185, 129, 0.35)' },
  'Closed':      { bg: 'rgba(100, 116, 139, 0.14)', fg: '#64748b', border: 'rgba(100, 116, 139, 0.3)' },
};

export const SearchableBatchSelect: React.FC<SearchableBatchSelectProps> = ({
  value = '',
  onChange,
  batches = [],
  placeholder = 'Select training batch...',
  disabled = false,
  required = false,
  label,
  error,
  className = '',
  showStatus = true,
  id: customId,
  name,
}) => {
  const generatedId = useId();
  const inputId = customId || generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // Find currently selected batch
  const selectedBatch = useMemo(() => {
    if (!value) return undefined;
    return batches.find(
      (b) =>
        b.id === value ||
        b.code === value ||
        b.trainingName === value ||
        (b.code && value.startsWith(b.code)) ||
        (b.trainingName && value.includes(b.trainingName))
    );
  }, [batches, value]);

  // Filter batches based on search query
  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((b) => {
      const code = (b.code || '').toLowerCase();
      const name = (b.trainingName || '').toLowerCase();
      const college = (b.college || '').toLowerCase();
      const program = (b.program || '').toLowerCase();
      const phase = (b.phase || '').toLowerCase();
      return (
        code.includes(q) ||
        name.includes(q) ||
        college.includes(q) ||
        program.includes(q) ||
        phase.includes(q)
      );
    });
  }, [batches, search]);

  // Handle outside clicks to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opening
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setHighlightedIndex(-1);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredBatches.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredBatches.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredBatches.length) {
          const selected = filteredBatches[highlightedIndex];
          onChange(selected.id, selected);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        setIsOpen(false);
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const items = listboxRef.current.children;
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex]);

  const handleSelect = (batch: Batch) => {
    onChange(batch.id, batch);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
  };

  const displayTitle = selectedBatch
    ? selectedBatch.code || selectedBatch.trainingName || 'Selected Batch'
    : value || '';

  const selectedPhase = selectedBatch ? normalizeBatchPhase(selectedBatch.phase) : null;
  const selectedBadgeStyle = selectedPhase ? STATUS_BADGE_STYLE[selectedPhase] : null;

  return (
    <div
      ref={containerRef}
      className={className}
      onKeyDown={handleKeyDown}
      style={{
        position: 'relative',
        width: '100%',
        minWidth: 200,
        boxSizing: 'border-box',
      }}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="kvj-label"
          style={{
            display: 'block',
            marginBottom: 6,
          }}
        >
          {label} {required && <span style={{ color: 'var(--status-danger, #ef4444)' }}>*</span>}
        </label>
      )}

      {/* Main trigger button */}
      <button
        id={inputId}
        name={name}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          width: '100%',
          minHeight: 42,
          padding: '9px 14px',
          borderRadius: 'var(--radius-lg, 10px)',
          border: error
            ? '1.5px solid var(--status-danger, #ef4444)'
            : isOpen
            ? '1.5px solid var(--brand, #4f46e5)'
            : '1px solid var(--border, #cbd5e1)',
          boxShadow: isOpen ? '0 0 0 3px var(--focus-ring, rgba(79, 70, 229, 0.15))' : 'none',
          background: disabled
            ? 'var(--bg-sunken, #f1f5f9)'
            : 'var(--bg-form, var(--bg-sunken, #ffffff))',
          color: 'var(--text-primary, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          textAlign: 'left',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxSizing: 'border-box',
          transition: 'border-color 140ms ease, box-shadow 140ms ease, background 140ms ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayTitle ? (
            <>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: 'var(--text-primary, #0f172a)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayTitle}
              </span>
              {showStatus && selectedBadgeStyle && selectedPhase && (
                <span
                  style={{
                    backgroundColor: selectedBadgeStyle.bg,
                    color: selectedBadgeStyle.fg,
                    borderColor: selectedBadgeStyle.border,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderStyle: 'solid',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {selectedPhase}
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 13,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {placeholder}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          {displayTitle && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e as any);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--border, #cbd5e1)',
                color: 'var(--text-secondary, #475569)',
                fontSize: 10,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 180ms ease',
              color: 'var(--text-muted, #64748b)',
              flexShrink: 0,
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      {/* Floating Dropdown popover panel */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 1050,
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border, #cbd5e1)',
            borderRadius: 'var(--radius-lg, 10px)',
            boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.2), 0 4px 12px -2px rgba(0, 0, 0, 0.08)',
            overflow: 'hidden',
            boxSizing: 'border-box',
            animation: 'fadeIn 120ms ease-out',
          }}
        >
          {/* Search box inside dropdown */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border, #f1f5f9)',
              background: 'var(--bg-sunken, #f8fafc)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 18,
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 13,
                pointerEvents: 'none',
              }}
            >
              🔍
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search by code, college, program..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 32px',
                fontSize: 13,
                background: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 'var(--radius-md, 6px)',
                outline: 'none',
                color: 'var(--text-primary, #0f172a)',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  searchInputRef.current?.focus();
                }}
                style={{
                  position: 'absolute',
                  right: 18,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  cursor: 'pointer',
                  fontSize: 12,
                  padding: 2,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Batches count info */}
          <div
            style={{
              padding: '6px 14px',
              background: 'var(--bg-surface, #ffffff)',
              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text-muted, #64748b)',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Available Training Batches</span>
            <span>{filteredBatches.length} found</span>
          </div>

          {/* Options list — strictly reset list style and margins */}
          <ul
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            style={{
              listStyle: 'none',
              margin: 0,
              padding: '4px 0',
              maxHeight: 250,
              overflowY: 'auto',
            }}
          >
            {filteredBatches.length === 0 ? (
              <li
                style={{
                  listStyle: 'none',
                  padding: '24px 16px',
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--text-muted, #94a3b8)',
                }}
              >
                No matching batches found for "{search}"
              </li>
            ) : (
              filteredBatches.map((b, idx) => {
                const isSelected = Boolean(selectedBatch?.id === b.id || (b.code && value === b.code));
                const isHighlighted = highlightedIndex === idx;
                const phase = normalizeBatchPhase(b.phase);
                const badgeStyle = STATUS_BADGE_STYLE[phase];

                return (
                  <li
                    key={b.id}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(b)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      borderBottom: '1px solid var(--border-subtle, #f8fafc)',
                      background: isHighlighted
                        ? 'var(--bg-sunken, #f1f5f9)'
                        : isSelected
                        ? 'rgba(79, 70, 229, 0.08)'
                        : 'transparent',
                      transition: 'background 100ms ease',
                    }}
                  >
                    <div
                      style={{
                        overflow: 'hidden',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: isSelected ? 700 : 600,
                          fontSize: 13,
                          color: isSelected ? 'var(--brand, #4f46e5)' : 'var(--text-primary, #0f172a)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.code || b.trainingName || 'Unnamed Batch'}
                      </div>
                      {(b.college || b.program) && (
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--text-muted, #64748b)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 2,
                          }}
                        >
                          {[b.college, b.program, b.batchNo ? `Batch ${b.batchNo}` : ''].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {showStatus && (
                        <span
                          style={{
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.fg,
                            borderColor: badgeStyle.border,
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderStyle: 'solid',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {phase}
                        </span>
                      )}
                      {isSelected && (
                        <span style={{ color: 'var(--brand, #4f46e5)', fontSize: 13, fontWeight: 800 }}>
                          ✓
                        </span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 11,
            color: 'var(--status-danger, #ef4444)',
            fontWeight: 600,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
};

export default SearchableBatchSelect;
