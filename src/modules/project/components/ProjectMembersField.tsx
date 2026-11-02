import React, { useState } from 'react';
import { useForm } from '../../../shared/forms/form';

export function ProjectMembersField({
  employees,
}: {
  employees: Array<{ id: string; firstName?: string; lastName?: string; designation?: string }>;
}) {
  const { values, setValue } = useForm();
  const selected: string[] = Array.isArray((values as any).memberIds) ? (values as any).memberIds : [];
  const [q, setQ] = useState('');

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setValue('memberIds', next);
  };

  const list = employees.filter((e) => {
    const name = `${e.firstName || ''} ${e.lastName || ''}`.toLowerCase();
    return !q.trim() || name.includes(q.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
      <label
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Project Members {selected.length > 0 ? `(${selected.length} selected)` : ''}
      </label>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search employees to add as members…"
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1.5px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 13,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div
        style={{
          maxHeight: 180,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {list.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
            No matching employees.
          </div>
        ) : (
          list.map((e) => {
            const on = selected.includes(e.id);
            return (
              <label
                key={e.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: on ? 'var(--bg-sunken)' : 'transparent',
                }}
              >
                <input type="checkbox" checked={on} onChange={() => toggle(e.id)} />
                <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  {e.firstName} {e.lastName}
                  {e.designation ? (
                    <span style={{ color: 'var(--text-muted)' }}> · {e.designation}</span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ProjectMembersField;

