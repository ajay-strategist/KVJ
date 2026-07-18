/**
 * KVJ Analytics — Configuration provider (Prompt 4 §16, Phase-1 §14)
 * Layer: Application. Exposes app/branding/locale/feature config to the tree.
 * Phase 1: static from config files. Phase 2: hydrated from Organization Settings.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { appConfig, type AppConfig } from '../../config/app-config';
import { featureFlags, type FeatureFlags } from '../../config/feature-flags';

interface ConfigContextValue {
  config: AppConfig;
  features: FeatureFlags;
  isFeature: (path: string) => boolean; // e.g. 'modules.attendance'
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const value = useMemo<ConfigContextValue>(() => ({
    config: appConfig,
    features: featureFlags,
    isFeature: (path) => {
      const parts = path.split('.');
      let cur: unknown = featureFlags;
      for (const p of parts) cur = (cur as Record<string, unknown>)?.[p];
      return cur === true;
    },
  }), []);
  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig(): ConfigContextValue {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('useConfig must be used within <ConfigProvider>');
  return ctx;
}
