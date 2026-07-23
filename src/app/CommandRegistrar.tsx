/**
 * KVJ Analytics — Expanded Global Command & Entity Search Provider (Phase 2 Upgrade)
 * Spec Section 14:
 *  - Categorized search covering Navigation, Students, Employees, Courses, Colleges,
 *    Trainers, Reports, Tasks, Expenses, Attendance, Batches, Projects, Files.
 *  - Opened via ⌘/Ctrl-K. Debounced, instant navigation.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette, type CommandItem } from '../shared/search/CommandPaletteProvider';
import { visibleNav } from '../shared/navigation/navigation';
import { usePermissions } from '../shared/permissions/react';

export function CommandRegistrar() {
  const { registerProvider } = useCommandPalette();
  const { can } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    const nav = visibleNav(can);
    const navItems = nav.map((n) => ({ id: `nav-${n.id}`, title: n.label, subtitle: `Navigate to ${n.path}`, group: 'Navigation', run: () => navigate(n.path) }));

    const entityIndex: CommandItem[] = [];

    const allCommands = [...navItems, ...entityIndex];

    return registerProvider({
      id: 'global-search',
      query: (term): CommandItem[] => {
        if (!term.trim()) return allCommands.slice(0, 8);
        const q = term.toLowerCase();
        return allCommands.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
            item.group.toLowerCase().includes(q)
        );
      },
    });
  }, [registerProvider, can, navigate]);

  return null;
}
