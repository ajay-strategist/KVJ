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

export function Tabs({ items, defaultTabId, onChange, className = '' }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTabId ?? items[0]?.id);

  const handleTabClick = (id: string) => {
    setActiveTab(id);
    onChange?.(id);
  };

  return (
    <div className={`kvj-tabs-container ${className}`}>
      <div
        className="kvj-tabs-list"
        role="tablist"
        style={{
          display: 'inline-flex',
          gap: 6,
          padding: 6,
          background: 'var(--bg-sunken)',
          border: 'var(--glass-border, 1px solid var(--border))',
          borderRadius: 'var(--radius-lg)', /* 18px */
          marginBottom: 20,
          overflowX: 'auto',
          scrollbarWidth: 'none',
          backdropFilter: 'blur(16px)',
          boxShadow: 'var(--e1)',
        }}
      >
        {items.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              style={{
                padding: '9px 18px',
                border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                borderRadius: 'var(--radius-md)', /* 16px */
                background: isActive
                  ? 'linear-gradient(135deg, var(--bg-surface), rgba(59, 130, 246, 0.12))'
                  : 'transparent',
                color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                fontSize: 13.5,
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 4px 14px rgba(59, 130, 246, 0.15)' : 'none',
                transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="kvj-tab-panel" role="tabpanel">
        {items.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}

export default Tabs;
