import React, { useState, useRef, useEffect, useMemo } from 'react';
import type { Client } from '../project.repository';

export interface ProjectClientDropdownProps {
  value: string;
  onChange: (value: string) => void;
  clients: Client[];
  placeholder?: string;
  required?: boolean;
}

export function ProjectClientDropdown({
  value,
  onChange,
  clients = [],
  placeholder = 'Select or search client...',
}: ProjectClientDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal search query with external value when dropdown opens or value changes
  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q === 'independent') return clients;
    return clients.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const contactMatch = c.contactPerson?.toLowerCase().includes(q);
      const codeMatch = (c as any).code?.toLowerCase().includes(q);
      return nameMatch || contactMatch || codeMatch;
    });
  }, [clients, search]);

  const exactMatch = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return clients.find((c) => c.name?.trim().toLowerCase() === q);
  }, [clients, search]);

  const isIndependent = !value || value.trim().toLowerCase() === 'independent';

  const handleSelectClient = (clientName: string) => {
    onChange(clientName);
    setSearch(clientName);
    setOpen(false);
  };

  const handleSelectIndependent = () => {
    onChange('');
    setSearch('');
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    if (!open) setOpen(true);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 4 }}>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
        }}
      >
        Client Organization *
      </label>

      {/* Input / Dropdown Trigger Box */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          borderRadius: 8,
          border: open ? '1.5px solid var(--primary, #4f46e5)' : '1.5px solid var(--border)',
          background: 'var(--bg-input, var(--bg-surface, #ffffff))',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span
          style={{
            paddingLeft: 12,
            fontSize: 14,
            color: isIndependent ? 'var(--text-muted)' : 'var(--text-primary)',
            pointerEvents: 'none',
          }}
        >
          {isIndependent ? '🏢' : '🏛️'}
        </span>

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '10px 8px',
            fontSize: 14,
            fontWeight: 500,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        {search && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectIndependent();
              inputRef.current?.focus();
            }}
            style={{
              padding: '6px 8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Clear / Set Independent"
          >
            ✕
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen(!open);
            if (!open) inputRef.current?.focus();
          }}
          style={{
            padding: '10px 12px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 10,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
          title={open ? 'Close dropdown' : 'Open client list'}
        >
          {open ? '▲' : '▼'}
        </button>
      </div>

      {/* Helper text when a new client will be created */}
      {search && search.trim().toLowerCase() !== 'independent' && !exactMatch && (
        <div style={{ fontSize: 12, color: 'var(--status-warning, #d97706)', marginTop: 4, fontWeight: 500 }}>
          ⚡ New client will be registered: &ldquo;<strong>{search.trim()}</strong>&rdquo;
        </div>
      )}

      {/* Custom Dropdown Menu */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--bg-panel, #ffffff)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.12)',
            zIndex: 9999,
            maxHeight: 280,
            overflowY: 'auto',
            padding: '6px 0',
          }}
        >
          {/* Option: Independent */}
          <div
            onClick={handleSelectIndependent}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isIndependent ? 'var(--primary-subtle, rgba(99, 102, 241, 0.1))' : 'transparent',
              color: isIndependent ? 'var(--primary, #4f46e5)' : 'var(--text-primary)',
              fontWeight: isIndependent ? 600 : 500,
              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
            }}
            onMouseEnter={(e) => {
              if (!isIndependent) e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)';
            }}
            onMouseLeave={(e) => {
              if (!isIndependent) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏢</span>
              <div>
                <div>Independent Project</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>No client organization associated</div>
              </div>
            </div>
            {isIndependent && <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>}
          </div>

          {/* Option: Register New Client (if search is not empty, not independent, and not matched) */}
          {search && search.trim().toLowerCase() !== 'independent' && !exactMatch && (
            <div
              onClick={() => handleSelectClient(search.trim())}
              style={{
                padding: '10px 14px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(245, 158, 11, 0.08)',
                color: 'var(--status-warning, #d97706)',
                fontWeight: 600,
                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
              }}
            >
              <span>➕</span>
              <div>
                <div>Register New Client: &ldquo;{search.trim()}&rdquo;</div>
                <div style={{ fontSize: 11, fontWeight: 400, opacity: 0.9 }}>
                  Will be registered & saved in Client Master Directory
                </div>
              </div>
            </div>
          )}

          {/* Section Header: Registered Clients */}
          {filteredClients.length > 0 && (
            <div
              style={{
                padding: '6px 14px 4px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--text-muted)',
              }}
            >
              Registered Clients ({filteredClients.length})
            </div>
          )}

          {/* List of Registered Clients */}
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => {
              const isSelected = value?.trim().toLowerCase() === client.name.trim().toLowerCase();
              return (
                <div
                  key={client.id}
                  onClick={() => handleSelectClient(client.name)}
                  style={{
                    padding: '8px 14px',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isSelected ? 'var(--primary-subtle, rgba(99, 102, 241, 0.1))' : 'transparent',
                    color: isSelected ? 'var(--primary, #4f46e5)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 600 : 500,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover, #f8fafc)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🏛️</span>
                    <div>
                      <div>{client.name}</div>
                      {client.contactPerson && client.contactPerson !== 'Primary Contact' && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                          Contact: {client.contactPerson}
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && <span style={{ fontSize: 12, fontWeight: 700 }}>✓</span>}
                </div>
              );
            })
          ) : (
            clients.length === 0 && !search && (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                No clients registered yet. Type a client name to register one!
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
export default ProjectClientDropdown;
