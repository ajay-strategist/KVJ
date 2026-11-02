import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import type { Batch, TrainingPhase, ApprovedBatchStatus } from '../../modules/training/training.repository';
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
  'Not Started': { bg: 'rgba(148, 163, 184, 0.14)', fg: '#64748b', border: 'rgba(148, 163, 184, 0.3)' },
  'In Progress': { bg: 'rgba(59, 130, 246, 0.14)', fg: '#2563eb', border: 'rgba(59, 130, 246, 0.3)' },
  'Completed':   { bg: 'rgba(16, 185, 129, 0.14)', fg: '#059669', border: 'rgba(16, 185, 129, 0.3)' },
  'Closed':      { bg: 'rgba(100, 116, 139, 0.18)', fg: '#475569', border: 'rgba(100, 116, 139, 0.4)' },
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
    return batches.find((b) => b.id === value || b.code === value);
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
    : '';

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
      style={{ minWidth: 200 }}
    >
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[var(--text-secondary,#475569)] mb-1.5"
        >
          {label} {required && <span className="text-red-500">*</span>}
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
        className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm rounded-lg border transition-all duration-150 ${
          disabled
            ? 'opacity-60 bg-[var(--bg-sunken,#f1f5f9)] cursor-not-allowed border-[var(--border,#e2e8f0)]'
            : isOpen
            ? 'border-[var(--primary,#2563eb)] ring-2 ring-[var(--primary,#2563eb)]/20 bg-[var(--bg-surface,#ffffff)]'
            : 'border-[var(--border,#cbd5e1)] hover:border-[var(--text-muted,#94a3b8)] bg-[var(--bg-surface,#ffffff)]'
        } ${error ? 'border-red-500 ring-1 ring-red-500/20' : ''}`}
      >
        <div className="flex items-center gap-2 truncate flex-1 mr-2">
          {selectedBatch ? (
            <>
              <span className="font-medium text-[var(--text-primary,#0f172a)] truncate">
                {displayTitle}
              </span>
              {showStatus && (
                <span
                  style={{
                    backgroundColor: STATUS_BADGE_STYLE[normalizeBatchPhase(selectedBatch.phase)].bg,
                    color: STATUS_BADGE_STYLE[normalizeBatchPhase(selectedBatch.phase)].fg,
                    borderColor: STATUS_BADGE_STYLE[normalizeBatchPhase(selectedBatch.phase)].border,
                  }}
                  className="px-2 py-0.5 text-[11px] font-semibold rounded-full border shrink-0"
                >
                  {normalizeBatchPhase(selectedBatch.phase)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[var(--text-muted,#94a3b8)] truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-[var(--text-muted,#94a3b8)]">
          {selectedBatch && !disabled && !required && (
            <span
              onClick={handleClear}
              className="p-1 hover:text-[var(--text-primary,#0f172a)] hover:bg-[var(--bg-sunken,#f1f5f9)] rounded transition-colors"
              title="Clear selection"
            >
              ✕
            </span>
          )}
          <span className={`transform transition-transform text-xs ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-[var(--bg-surface,#ffffff)] border border-[var(--border,#cbd5e1)] rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="p-2 border-b border-[var(--border,#f1f5f9)] bg-[var(--bg-sunken,#f8fafc)]">
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder="Search by code, college, program..."
              className="w-full px-2.5 py-1.5 text-xs bg-[var(--bg-surface,#ffffff)] border border-[var(--border,#cbd5e1)] rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--primary,#2563eb)] text-[var(--text-primary,#0f172a)]"
            />
          </div>

          <ul
            ref={listboxRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-60 overflow-y-auto py-1 divide-y divide-[var(--border,#f8fafc)]"
          >
            {filteredBatches.length === 0 ? (
              <li className="px-3 py-4 text-xs text-center text-[var(--text-muted,#94a3b8)]">
                No matching batches found
              </li>
            ) : (
              filteredBatches.map((b, idx) => {
                const isSelected = selectedBatch?.id === b.id;
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
                    className={`px-3 py-2 cursor-pointer text-xs flex items-center justify-between gap-2 transition-colors ${
                      isHighlighted
                        ? 'bg-[var(--bg-sunken,#f1f5f9)] text-[var(--text-primary,#0f172a)]'
                        : isSelected
                        ? 'bg-[var(--primary,#2563eb)]/10 font-medium'
                        : 'text-[var(--text-primary,#0f172a)] hover:bg-[var(--bg-sunken,#f8fafc)]'
                    }`}
                  >
                    <div className="truncate flex-1">
                      <div className="font-semibold truncate">
                        {b.code || b.trainingName || 'Unnamed Batch'}
                      </div>
                      {(b.college || b.program) && (
                        <div className="text-[11px] text-[var(--text-muted,#64748b)] truncate">
                          {[b.college, b.program, b.batchNo].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {showStatus && (
                      <span
                        style={{
                          backgroundColor: badgeStyle.bg,
                          color: badgeStyle.fg,
                          borderColor: badgeStyle.border,
                        }}
                        className="px-2 py-0.5 text-[10px] font-semibold rounded-full border shrink-0"
                      >
                        {phase}
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default SearchableBatchSelect;
