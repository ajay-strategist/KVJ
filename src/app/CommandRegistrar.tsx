/**
 * KVJ Analytics — Command palette navigation provider (Phase-1 §6,8)
 * Registers navigation commands into the command palette so ⌘K can jump
 * between pages. Permission-filtered via the nav engine. Renders nothing.
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
    const staticExtra = [
      { id: 'showcase', label: 'Design System Showcase', path: '/app/showcase' },
      { id: 'ceo', label: 'CEO Workspace', path: '/app/workspace/ceo' },
      { id: 'manager', label: 'Manager Workspace', path: '/app/workspace/manager' },
      { id: 'supervisor', label: 'Supervisor Workspace', path: '/app/workspace/supervisor' },
    ];
    const all = [...nav.map((n) => ({ id: n.id, label: n.label, path: n.path })), ...staticExtra];
    return registerProvider({
      id: 'navigation',
      query: (term): CommandItem[] =>
        all
          .filter((n) => n.label.toLowerCase().includes(term.toLowerCase()))
          .map((n) => ({ id: `nav-${n.id}`, title: n.label, group: 'Navigation', run: () => navigate(n.path) })),
    });
  }, [registerProvider, can, navigate]);

  return null;
}
