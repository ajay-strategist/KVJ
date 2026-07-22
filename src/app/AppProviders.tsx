/**
 * KVJ Analytics — Composed application providers (Prompt 9 §14)
 * Layer: Application. Single provider hierarchy every screen sits inside.
 * Order matters: Theme → Config → Auth → (permissions read auth) →
 * Notifications → Dialogs → CommandPalette.
 */

import { type ReactNode } from 'react';
import { ThemeProvider } from '../shared/theme/ThemeProvider';
import { WorkspaceProvider } from '../shared/theme/WorkspaceProvider';
import { ConfigProvider } from '../shared/config/ConfigProvider';
import { AuthProvider } from '../modules/auth/AuthProvider';
import { NotificationProvider } from '../shared/notifications/NotificationProvider';
import { DialogProvider } from '../shared/feedback/DialogProvider';
import { CommandPaletteProvider } from '../shared/search/CommandPaletteProvider';
import '../shared/design-system/tokens.css';
import '../shared/ui/ui.css';

/**
 * Wrap the router/app with this once. Auth defaults to the Phase-1 mock service;
 * pass a different IAuthService (e.g. Supabase) in Phase 2 without touching UI.
 * Order: Theme → Config → Auth → Notifications → Dialogs → CommandPalette.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <ConfigProvider>
          <AuthProvider>
            <NotificationProvider>
              <DialogProvider>
                <CommandPaletteProvider>{children}</CommandPaletteProvider>
              </DialogProvider>
            </NotificationProvider>
          </AuthProvider>
        </ConfigProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
