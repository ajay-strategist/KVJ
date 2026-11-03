import React, { useState } from 'react';
import { useTutorial, UserRoleFilter } from './TutorialContext';
import { TUTORIAL_MODULES, TutorialItem, TutorialWorkflow } from './tutorial-data';
import { TutorialSimulatorModal } from './TutorialSimulators';

export function TutorialModal() {
  const {
    isOpen,
    closeTutorial,
    activeModuleId,
    setActiveModuleId,
    selectedRole,
    setSelectedRole,
    searchQuery,
    setSearchQuery,
    filteredModules,
    activeSimulation,
    startSimulation,
    closeSimulation,
  } = useTutorial();

  const [expandedWorkflowId, setExpandedWorkflowId] = useState<string | null>(null);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  // Selected module
  const currentModule =
    filteredModules.find((m) => m.id === activeModuleId) ||
    filteredModules[0] ||
    TUTORIAL_MODULES[0];

  const handleSelectModule = (id: string) => {
    setActiveModuleId(id);
    setExpandedWorkflowId(null);
    setExpandedFaqIndex(null);
  };

  const roles: { key: UserRoleFilter; label: string }[] = [
    { key: 'ALL', label: 'All Roles' },
    { key: 'EMPLOYEE', label: 'Employee' },
    { key: 'SUPERVISOR', label: 'Supervisor' },
    { key: 'MANAGER', label: 'Manager' },
    { key: 'ADMIN', label: 'Admin' },
    { key: 'CEO', label: 'CEO' },
  ];

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99990,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          animation: 'fadeIn 150ms ease-out',
        }}
        onClick={closeTutorial}
      >
        <div
          style={{
            background: 'var(--bg-surface, #ffffff)',
            color: 'var(--text-primary, #0f172a)',
            borderRadius: 16,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
            width: '100%',
            maxWidth: 1100,
            height: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid var(--border, #cbd5e1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-panel, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 800,
                  boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)',
                }}
              >
                ?
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                    FlowDesk Help Center & Interactive Tutorial
                  </h2>
                  <span
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#ecfdf5',
                      color: '#065f46',
                      fontWeight: 600,
                      border: '1px solid #a7f3d0',
                    }}
                  >
                    🔒 Practice Sandbox (Safe / No DB Writes)
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                  Step-by-step role guides, workflow validations, and interactive feature simulators.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'var(--bg-sunken, #f1f5f9)',
                  color: 'var(--text-muted, #64748b)',
                  border: '1px solid var(--border, #e2e8f0)',
                  fontFamily: 'monospace',
                }}
              >
                Shortcut: ? or Shift + /
              </span>
              <button
                type="button"
                onClick={closeTutorial}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: 8,
                  borderRadius: 8,
                  color: 'var(--text-muted, #64748b)',
                  fontSize: 20,
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="Close Tutorial (Esc)"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search & Role Filter Bar */}
          <div
            style={{
              padding: '12px 24px',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              background: 'var(--bg-surface, #ffffff)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            {/* Search Box */}
            <div style={{ position: 'relative', flex: '1 1 300px', maxWidth: 450 }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #94a3b8)',
                  fontSize: 14,
                }}
              >
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workflows, forms, rules, errors (e.g. 'Clock In', 'Leave', 'KM')..."
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--bg-surface, #ffffff)',
                  color: 'var(--text-primary, #0f172a)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--text-muted, #94a3b8)',
                    fontSize: 12,
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Role Filter Chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                Role:
              </span>
              {roles.map((r) => {
                const isSelected = selectedRole === r.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setSelectedRole(r.key)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 16,
                      fontSize: 12,
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected
                        ? '1px solid #4f46e5'
                        : '1px solid var(--border, #e2e8f0)',
                      background: isSelected ? '#4f46e5' : 'var(--bg-panel, #f8fafc)',
                      color: isSelected ? '#ffffff' : 'var(--text-primary, #334155)',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Body (Sidebar + Content) */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* Sidebar Module List */}
            <div
              style={{
                width: 280,
                borderRight: '1px solid var(--border, #e2e8f0)',
                background: 'var(--bg-panel, #f8fafc)',
                overflowY: 'auto',
                padding: '12px 8px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--text-muted, #64748b)',
                  padding: '4px 12px 8px',
                }}
              >
                Modules & Tabs ({filteredModules.length})
              </div>

              {filteredModules.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                  No matching tutorials found. Try a different search term or role filter.
                </div>
              ) : (
                filteredModules.map((item) => {
                  const isActive = item.id === (currentModule ? currentModule.id : '');
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectModule(item.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 8,
                        marginBottom: 4,
                        border: 'none',
                        background: isActive ? '#e0e7ff' : 'transparent',
                        color: isActive ? '#3730a3' : 'var(--text-primary, #1e293b)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        transition: 'background 120ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 600 }}>
                          {item.title.split('—')[0].trim()}
                        </span>
                        {item.workflows.some((w) => w.simulationKey) && (
                          <span
                            style={{
                              fontSize: 10,
                              background: '#dcfce7',
                              color: '#15803d',
                              padding: '1px 5px',
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            🧪 Sandbox
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: isActive ? '#4338ca' : 'var(--text-muted, #64748b)' }}>
                        {item.module}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Content Area */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px 32px',
                background: 'var(--bg-surface, #ffffff)',
              }}
            >
              {currentModule ? (
                <div>
                  {/* Module Header Banner */}
                  <div
                    style={{
                      padding: 16,
                      borderRadius: 12,
                      background: 'var(--bg-panel, #f8fafc)',
                      border: '1px solid var(--border, #e2e8f0)',
                      marginBottom: 24,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: '#e0e7ff',
                          color: '#4338ca',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                        }}
                      >
                        {currentModule.module}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                        📍 <strong>Where:</strong> {currentModule.whereToFind}
                      </span>
                    </div>

                    <h1 style={{ margin: '8px 0 6px', fontSize: 20, fontWeight: 800 }}>
                      {currentModule.title}
                    </h1>

                    <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted, #475569)', lineHeight: 1.5 }}>
                      {currentModule.summary}
                    </p>

                    {/* Roles Allowed */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #64748b)' }}>
                        Target Roles:
                      </span>
                      {currentModule.rolesAllowed.map((role) => (
                        <span
                          key={role}
                          style={{
                            fontSize: 11,
                            padding: '1px 7px',
                            borderRadius: 10,
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            fontWeight: 600,
                          }}
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Workflows Section */}
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🚀</span> Step-by-Step Operating Procedures ({currentModule.workflows.length})
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {currentModule.workflows.map((wf) => {
                        const isExpanded = expandedWorkflowId === wf.id || currentModule.workflows.length === 1;

                        return (
                          <div
                            key={wf.id}
                            style={{
                              border: '1px solid var(--border, #e2e8f0)',
                              borderRadius: 12,
                              overflow: 'hidden',
                              background: 'var(--bg-surface, #ffffff)',
                              boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            {/* Workflow Header / Accordion trigger */}
                            <div
                              onClick={() => setExpandedWorkflowId(isExpanded ? null : wf.id)}
                              style={{
                                padding: '14px 18px',
                                background: isExpanded ? 'var(--bg-panel, #f8fafc)' : 'var(--bg-surface, #ffffff)',
                                borderBottom: isExpanded ? '1px solid var(--border, #e2e8f0)' : 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                userSelect: 'none',
                              }}
                            >
                              <div style={{ flex: 1, paddingRight: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                                    {wf.title}
                                  </h4>
                                  {wf.simulationKey && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        padding: '2px 6px',
                                        borderRadius: 4,
                                        background: '#dbeafe',
                                        color: '#1d4ed8',
                                        fontWeight: 700,
                                      }}
                                    >
                                      🧪 Interactive Practice Available
                                    </span>
                                  )}
                                </div>
                                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted, #64748b)' }}>
                                  {wf.summary}
                                </p>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {wf.simulationKey && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startSimulation(wf.simulationKey!);
                                    }}
                                    style={{
                                      padding: '6px 12px',
                                      borderRadius: 6,
                                      background: '#059669',
                                      color: '#ffffff',
                                      border: 'none',
                                      fontWeight: 600,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                      boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                  >
                                    <span>🧪</span> Try Sandbox
                                  </button>
                                )}
                                <span style={{ fontSize: 14, color: 'var(--text-muted, #94a3b8)' }}>
                                  {isExpanded ? '▲' : '▼'}
                                </span>
                              </div>
                            </div>

                            {/* Workflow Body */}
                            {isExpanded && (
                              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {/* Who can use & Prerequisites */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                    gap: 12,
                                    background: 'var(--bg-panel, #f8fafc)',
                                    padding: 12,
                                    borderRadius: 8,
                                    fontSize: 12,
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginBottom: 4 }}>
                                      👥 Authorized Roles:
                                    </div>
                                    <div style={{ color: 'var(--text-muted, #475569)' }}>
                                      {wf.whoCanUse.join(' • ')}
                                    </div>
                                  </div>

                                  {wf.prerequisites && wf.prerequisites.length > 0 && (
                                    <div>
                                      <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 4 }}>
                                        ⚠️ Prerequisites:
                                      </div>
                                      <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--text-muted, #475569)' }}>
                                        {wf.prerequisites.map((p, idx) => (
                                          <li key={idx} style={{ marginBottom: 2 }}>{p}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>

                                {/* Step by step instructions */}
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #0f172a)' }}>
                                    📋 Action Steps:
                                  </div>
                                  <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {wf.steps.map((step, sIdx) => (
                                      <li key={sIdx} style={{ fontSize: 13, color: 'var(--text-primary, #334155)', lineHeight: 1.5 }}>
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                </div>

                                {/* Form Fields Table (if applicable) */}
                                {wf.fields && wf.fields.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary, #0f172a)' }}>
                                      📝 Form Fields & Requirements:
                                    </div>
                                    <div style={{ overflowX: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                                        <thead style={{ background: 'var(--bg-panel, #f1f5f9)', color: 'var(--text-primary, #334155)' }}>
                                          <tr>
                                            <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #cbd5e1)' }}>Field Label</th>
                                            <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #cbd5e1)' }}>Type</th>
                                            <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #cbd5e1)' }}>Required?</th>
                                            <th style={{ padding: '8px 12px', borderBottom: '1px solid var(--border, #cbd5e1)' }}>Purpose & Rules</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {wf.fields.map((f, fIdx) => (
                                            <tr key={fIdx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                                              <td style={{ padding: '8px 12px', fontWeight: 600 }}>{f.label}</td>
                                              <td style={{ padding: '8px 12px', color: 'var(--text-muted, #64748b)' }}>{f.type}</td>
                                              <td style={{ padding: '8px 12px' }}>
                                                {f.required ? (
                                                  <span style={{ color: '#dc2626', fontWeight: 700 }}>Yes *</span>
                                                ) : (
                                                  <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Optional</span>
                                                )}
                                              </td>
                                              <td style={{ padding: '8px 12px', color: 'var(--text-primary, #334155)' }}>
                                                {f.description}
                                                {f.example && (
                                                  <div style={{ marginTop: 2, color: 'var(--text-muted, #64748b)', fontStyle: 'italic' }}>
                                                    e.g. {f.example}
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Validation Rules */}
                                {wf.validationRules && wf.validationRules.length > 0 && (
                                  <div
                                    style={{
                                      padding: 12,
                                      borderRadius: 8,
                                      background: '#fffbeb',
                                      border: '1px solid #fde68a',
                                      fontSize: 12,
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                                      🛡️ Core System Validation Rules:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, color: '#78350f' }}>
                                      {wf.validationRules.map((v, vIdx) => (
                                        <li key={vIdx} style={{ marginBottom: 2 }}>{v}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}

                                {/* Common Errors & Troubleshooting */}
                                {wf.commonErrors && wf.commonErrors.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#991b1b' }}>
                                      ⚠️ Common Errors & Instant Fixes:
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {wf.commonErrors.map((err, eIdx) => (
                                        <div
                                          key={eIdx}
                                          style={{
                                            padding: '10px 14px',
                                            borderRadius: 8,
                                            background: '#fef2f2',
                                            border: '1px solid #fecaca',
                                            fontSize: 12,
                                          }}
                                        >
                                          <div style={{ fontWeight: 700, color: '#b91c1c' }}>
                                            ❌ Error: "{err.error}"
                                          </div>
                                          <div style={{ margin: '4px 0', color: '#7f1d1d' }}>
                                            <strong>Why it occurs:</strong> {err.cause}
                                          </div>
                                          <div style={{ color: '#15803d', fontWeight: 600 }}>
                                            <strong>Solution:</strong> {err.solution}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Pro Tips */}
                                {wf.proTips && wf.proTips.length > 0 && (
                                  <div
                                    style={{
                                      padding: 12,
                                      borderRadius: 8,
                                      background: '#f0fdf4',
                                      border: '1px solid #bbf7d0',
                                      fontSize: 12,
                                    }}
                                  >
                                    <div style={{ fontWeight: 700, color: '#166534', marginBottom: 4 }}>
                                      💡 FlowDesk Pro Tips:
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: 18, color: '#14532d' }}>
                                      {wf.proTips.map((tip, tIdx) => (
                                        <li key={tIdx} style={{ marginBottom: 2 }}>{tip}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* FAQ Section */}
                  {currentModule.faq && currentModule.faq.length > 0 && (
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>❓</span> Frequently Asked Questions & Troubleshooting ({currentModule.faq.length})
                      </h3>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {currentModule.faq.map((item, fIdx) => {
                          const isFaqOpen = expandedFaqIndex === fIdx;
                          return (
                            <div
                              key={fIdx}
                              style={{
                                border: '1px solid var(--border, #e2e8f0)',
                                borderRadius: 8,
                                overflow: 'hidden',
                                background: 'var(--bg-surface, #ffffff)',
                              }}
                            >
                              <div
                                onClick={() => setExpandedFaqIndex(isFaqOpen ? null : fIdx)}
                                style={{
                                  padding: '12px 16px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  background: isFaqOpen ? 'var(--bg-panel, #f8fafc)' : 'var(--bg-surface, #ffffff)',
                                  userSelect: 'none',
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #1e293b)' }}>
                                  {item.q}
                                </span>
                                <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginLeft: 8 }}>
                                  {isFaqOpen ? '▲' : '▼'}
                                </span>
                              </div>
                              {isFaqOpen && (
                                <div
                                  style={{
                                    padding: '12px 16px',
                                    borderTop: '1px solid var(--border, #e2e8f0)',
                                    fontSize: 13,
                                    color: 'var(--text-muted, #475569)',
                                    lineHeight: 1.5,
                                    background: 'var(--bg-surface, #ffffff)',
                                  }}
                                >
                                  {item.a}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted, #64748b)' }}>
                  Select a module from the left menu to view its user guide and interactive workflows.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Simulator Modal */}
      {activeSimulation && (
        <TutorialSimulatorModal
          simulationKey={activeSimulation}
          onClose={closeSimulation}
          onNavigateToRealPage={() => {
            closeSimulation();
            closeTutorial();
          }}
        />
      )}
    </>
  );
}

