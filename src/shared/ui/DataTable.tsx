/**
 * KVJ Analytics — Generic DataTable (Prompt 5 §10, design system §10)
 * Layer: Shared. Sticky header, sortable columns, pagination, row selection,
 * loading skeleton, empty state, and a responsive card fallback on mobile.
 * Generic over row type; no business coupling.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { EmptyState, Skeleton } from './components';
import { useDevice } from '../hooks/responsive';
import './ui.css';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  numeric?: boolean;
  accessor?: (row: T) => string | number;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (ids: string[]) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns, rows, rowKey, loading, pageSize = 10, selectable, onSelectionChange,
  emptyTitle = 'Nothing here yet', emptyMessage, onRowClick,
}: DataTableProps<T>) {
  const device = useDevice();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.accessor) return rows;
    return [...rows].sort((a, b) => {
      const av = col.accessor!(a); const bv = col.accessor!(b);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.dir === 'desc' ? -cmp : cmp;
    });
  }, [rows, sort, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    setSort((s) => (s?.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: 'asc' }));
  };
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      onSelectionChange?.([...next]);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="kvj-card"><div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} height={40} />)}
      </div></div>
    );
  }
  if (rows.length === 0) {
    return <div className="kvj-card"><EmptyState title={emptyTitle} message={emptyMessage} /></div>;
  }

  // Mobile: stacked cards (label:value) — critical for approvals/expenses on phones.
  if (device === 'mobile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pageRows.map((row) => (
          <div key={rowKey(row)} className="kvj-card kvj-card--hover" onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
            <div className="kvj-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {columns.map((c) => (
                <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{c.header}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{c.render ? c.render(row) : String(c.accessor?.(row) ?? '')}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    );
  }

  return (
    <div className="kvj-card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', maxHeight: 520 }}>
        <table className="kvj-table">
          <thead>
            <tr>
              {selectable && <th style={{ width: 40 }} />}
              {columns.map((c) => (
                <th key={c.key} onClick={() => toggleSort(c)} style={{ cursor: c.sortable ? 'pointer' : 'default', textAlign: c.numeric ? 'right' : 'left' }}>
                  {c.header}{sort?.key === c.key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = rowKey(row);
              return (
                <tr key={id} onClick={() => onRowClick?.(row)} style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                  {selectable && (
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className={c.numeric ? 'kvj-num' : ''}>{c.render ? c.render(row) : String(c.accessor?.(row) ?? '')}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' }}>
      <span>Page {page} of {totalPages}</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="kvj-btn kvj-btn--secondary kvj-btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>Prev</button>
        <button className="kvj-btn kvj-btn--secondary kvj-btn--sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  );
}
