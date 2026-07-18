/**
 * KVJ Analytics — Dashboard infrastructure (Prompt 5/10 §4,15)
 * Layer: Shared. Widget registry + grid + layout persistence. INFRASTRUCTURE
 * ONLY — no Attendance/business widgets (those come in later phases). Modules
 * register widgets; role-based default layouts select which appear.
 */

import { useMemo, useState, type ComponentType } from 'react';

export interface WidgetDef {
  id: string;
  title: string;
  component: ComponentType;
  defaultSize?: { w: number; h: number }; // grid units
  roles?: string[];                        // which roles see it by default
  permission?: string;                     // optional 'resource:action'
}

/** Global widget registry — modules call registerWidget() at load time. */
class WidgetRegistry {
  private widgets = new Map<string, WidgetDef>();
  register(def: WidgetDef) { this.widgets.set(def.id, def); }
  get(id: string) { return this.widgets.get(id); }
  all() { return [...this.widgets.values()]; }
  forRole(role: string) { return this.all().filter((w) => !w.roles || w.roles.includes(role)); }
}
export const widgetRegistry = new WidgetRegistry();

export interface WidgetLayout { id: string; w: number; h: number }
const LAYOUT_KEY = (role: string) => `kvj.dashboard.layout.${role}`;

/** Persisted, role-aware dashboard grid. Drag/resize is an enhancement flag; the
 *  registry + layout persistence are ready now (Prompt: "infrastructure only"). */
export function DashboardGrid({ role }: { role: string }) {
  const [layout, setLayout] = useState<WidgetLayout[]>(() => {
    const saved = localStorage.getItem(LAYOUT_KEY(role));
    if (saved) return JSON.parse(saved);
    return widgetRegistry.forRole(role).map((w) => ({ id: w.id, w: w.defaultSize?.w ?? 4, h: w.defaultSize?.h ?? 1 }));
  });

  const persist = (next: WidgetLayout[]) => { setLayout(next); localStorage.setItem(LAYOUT_KEY(role), JSON.stringify(next)); };
  const widgets = useMemo(() => layout.map((l) => ({ layout: l, def: widgetRegistry.get(l.id) })).filter((x) => x.def), [layout]);

  if (widgets.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-lg)' }}>
        No widgets registered yet. Modules will contribute dashboard widgets in later phases.
      </div>
    );
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 16 }}>
      {widgets.map(({ layout: l, def }) => {
        const W = def!.component;
        return (
          <div key={l.id} style={{ gridColumn: `span ${Math.min(12, l.w)}` }}>
            <W />
          </div>
        );
      })}
      {/* persist() is exposed for the future drag/resize editor (dashboardBuilder flag). */}
      <span hidden data-persist={typeof persist} />
    </div>
  );
}
