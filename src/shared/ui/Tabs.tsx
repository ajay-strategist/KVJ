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
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
          overflowX: 'auto',
          scrollbarWidth: 'none',
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
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                borderBottom: isActive ? '2px solid var(--brand)' : '2px solid transparent',
                color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                fontSize: 14,
                whiteSpace: 'nowrap',
                transition: 'all var(--dur-fast) var(--ease-standard)',
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
