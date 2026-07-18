/**
 * KVJ Analytics — Workspace framework (Prompt 5/3 §14)
 * Layer: Shared. A reusable workspace layout used by all four role workspaces
 * (Employee / Supervisor / Manager / CEO). It only lays out regions — the actual
 * widgets are injected by later modules (none here, per Phase-1 scope).
 */

import { type ReactNode } from 'react';

export type WorkspaceRole = 'employee' | 'supervisor' | 'manager' | 'ceo';

export interface WorkspaceRegions {
  greeting?: ReactNode;      // header line ("Good morning, Sara")
  stats?: ReactNode;         // top StatCard row
  primary?: ReactNode;       // main column (tasks / project board / analytics)
  side?: ReactNode;          // right column (notifications / announcements / calendar)
  quickActions?: ReactNode;  // quick action row
}

/** Generic responsive workspace layout. Widgets are passed in; framework owns layout. */
export function WorkspaceShell({ role, regions }: { role: WorkspaceRole; regions: WorkspaceRegions }) {
  return (
    <div data-workspace={role} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {regions.greeting}
      {regions.quickActions && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>{regions.quickActions}</div>
      )}
      {regions.stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>{regions.stats}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }} className="kvj-workspace-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>{regions.primary}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>{regions.side}</div>
      </div>
      {/* Single-column collapse on smaller screens */}
      <style>{`@media (max-width: 1024px){ .kvj-workspace-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
