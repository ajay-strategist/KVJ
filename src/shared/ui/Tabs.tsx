import { useState, type ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  content: ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTabId?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ items = [], defaultTabId, onChange, className = '' }: TabsProps) {
  const safeItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const [activeTab, setActiveTab] = useState(defaultTabId ?? safeItems[0]?.id ?? '');

  const effectiveActiveTab = safeItems.some((t) => t.id === activeTab)
    ? activeTab
    : (safeItems[0]?.id ?? '');

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <div className={`kvj-tabs-container ${className}`}>
      <div
        className="kvj-tabs-list"
        role="tablist"
        style={{
          display: 'inline-flex',
          gap: 4,
          padding: 4,
          background: 'var(--bg-sunken)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: 20,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          boxShadow: 'var(--e0)',
        }}
      >
        {safeItems.map((tab) => {
          const isActive = effectiveActiveTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                border: '1px solid',
                borderColor: isActive ? 'var(--border)' : 'transparent',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--bg-surface)' : 'transparent',
                color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                fontSize: 13,
                whiteSpace: 'nowrap',
                boxShadow: isActive ? 'var(--e1)' : 'none',
                transition: 'all 0.16s ease',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="kvj-tab-panel" role="tabpanel">
        {safeItems.find((tab) => tab.id === effectiveActiveTab)?.content}
      </div>
    </div>
  );
}

export default Tabs;
