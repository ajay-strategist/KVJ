import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface WorkspacePreset {
  name: string;
  wallpaper: string;
  glassOpacity: number;
  glassBlur: number;
  accentColor: string;
  cornerRadius: number;
  shadowSoftness: number;
  animationSpeed: number;
}

export const WORKSPACE_PRESETS: Record<string, WorkspacePreset> = {
  'Executive Glass': {
    name: 'Executive Glass',
    wallpaper: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
    glassOpacity: 0.88, // Apple standard: Dark theme min 88%
    glassBlur: 30,
    accentColor: '#3B82F6',
    cornerRadius: 24,
    shadowSoftness: 0.35,
    animationSpeed: 0.3,
  },
  'Aurora Dream': {
    name: 'Aurora Dream',
    wallpaper: 'radial-gradient(circle at 20% 30%, #0d9488 0%, #4338ca 60%, #581c87 100%)',
    glassOpacity: 0.90,
    glassBlur: 25,
    accentColor: '#14B8A6',
    cornerRadius: 24,
    shadowSoftness: 0.40,
    animationSpeed: 0.35,
  },
  'Cyber Blue': {
    name: 'Cyber Blue',
    wallpaper: 'linear-gradient(180deg, #090d16 0%, #0b1a30 50%, #020617 100%)',
    glassOpacity: 0.92,
    glassBlur: 20,
    accentColor: '#0EA5E9',
    cornerRadius: 16,
    shadowSoftness: 0.25,
    animationSpeed: 0.24,
  },
  'Ocean Deep': {
    name: 'Ocean Deep',
    wallpaper: 'radial-gradient(circle at 50% 50%, #075985 0%, #0c4a6e 50%, #030712 100%)',
    glassOpacity: 0.89,
    glassBlur: 35,
    accentColor: '#0284C7',
    cornerRadius: 28,
    shadowSoftness: 0.45,
    animationSpeed: 0.4,
  },
  'Glass White (VisionOS)': {
    name: 'Glass White (VisionOS)',
    wallpaper: 'radial-gradient(circle at 10% 10%, #e0f2fe 0%, #f3e8ff 50%, #faf5ff 100%)',
    glassOpacity: 0.94, // Light theme min 92%
    glassBlur: 25,
    accentColor: '#4F46E5',
    cornerRadius: 24,
    shadowSoftness: 0.15,
    animationSpeed: 0.3,
  },
  'Minimal Luxe': {
    name: 'Minimal Luxe',
    wallpaper: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    glassOpacity: 0.90,
    glassBlur: 40,
    accentColor: '#f4f4f5',
    cornerRadius: 12,
    shadowSoftness: 0.5,
    animationSpeed: 0.2,
  },
};

export const WALLPAPER_GALLERY = [
  { id: 'ex-glass', name: 'Executive Dark Space', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)' },
  { id: 'aurora', name: 'Aurora Borealis', value: 'radial-gradient(circle at 20% 30%, #0d9488 0%, #4338ca 60%, #581c87 100%)' },
  { id: 'cyber', name: 'Cyberpunk Grid Accent', value: 'linear-gradient(180deg, #090d16 0%, #0b1a30 50%, #020617 100%)' },
  { id: 'ocean', name: 'Ocean Abyssal', value: 'radial-gradient(circle at 50% 50%, #075985 0%, #0c4a6e 50%, #030712 100%)' },
  { id: 'glass-white', name: 'VisionOS Soft Warm', value: 'radial-gradient(circle at 10% 10%, #e0f2fe 0%, #f3e8ff 50%, #faf5ff 100%)' },
  { id: 'minimal-dark', name: 'Charcoal Minimal', value: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)' },
  { id: 'mountain', name: 'Sunset Ridge Glow', value: 'linear-gradient(135deg, #fda4af 0%, #6366f1 50%, #0f172a 100%)' },
  { id: 'glass-bubbles', name: 'Glass Ambient Mesh', value: 'radial-gradient(circle at 80% 20%, #ffedd5 0%, #c084fc 50%, #312e81 100%)' },
];

export type WorkspaceViewMode = 'Standard' | 'Focus' | 'Presentation' | 'Executive';

interface WorkspaceContextValue {
  wallpaper: string;
  glassOpacity: number;
  glassBlur: number;
  accentColor: string;
  cornerRadius: number;
  shadowSoftness: number;
  animationSpeed: number;
  activePreset: string;
  viewMode: WorkspaceViewMode;
  setWallpaper: (val: string) => void;
  setGlassOpacity: (val: number) => void;
  setGlassBlur: (val: number) => void;
  setAccentColor: (val: string) => void;
  setCornerRadius: (val: number) => void;
  setShadowSoftness: (val: number) => void;
  setAnimationSpeed: (val: number) => void;
  setViewMode: (mode: WorkspaceViewMode) => void;
  loadPreset: (name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activePreset, setActivePreset] = useState('Glass White (VisionOS)');
  const [wallpaper, setWallpaper] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].wallpaper);
  const [glassOpacity, setGlassOpacity] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].glassOpacity);
  const [glassBlur, setGlassBlur] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].glassBlur);
  const [accentColor, setAccentColor] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].accentColor);
  const [cornerRadius, setCornerRadius] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].cornerRadius);
  const [shadowSoftness, setShadowSoftness] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].shadowSoftness);
  const [animationSpeed, setAnimationSpeed] = useState(WORKSPACE_PRESETS['Glass White (VisionOS)'].animationSpeed);
  const [viewMode, setViewMode] = useState<WorkspaceViewMode>('Standard');

  const loadPreset = (name: string) => {
    const preset = WORKSPACE_PRESETS[name];
    if (!preset) return;
    setActivePreset(name);
    setWallpaper(preset.wallpaper);
    setGlassOpacity(preset.glassOpacity);
    setGlassBlur(preset.glassBlur);
    setAccentColor(preset.accentColor);
    setCornerRadius(preset.cornerRadius);
    setShadowSoftness(preset.shadowSoftness);
    setAnimationSpeed(preset.animationSpeed);
  };

  // Sync state values with global CSS custom properties in real-time
  useEffect(() => {
    const root = document.documentElement;
    const isLight = root.getAttribute('data-theme') === 'light' || root.getAttribute('data-theme') === 'hud-light';

    // 1. Enforce strict minimum glass opacity safeguards for readability priority
    let baseOpacity = glassOpacity;
    const minOpacityLimit = isLight ? 0.92 : 0.88;
    if (baseOpacity < minOpacityLimit) {
      baseOpacity = minOpacityLimit;
    }

    // 2. View Mode Modifiers
    let finalOpacity = baseOpacity;
    let finalBlur = glassBlur;
    let finalSpeed = animationSpeed;
    const finalRadius = cornerRadius;

    if (viewMode === 'Focus') {
      // Focus mode: maximize content opacity (98%) and dim backgrounds
      finalOpacity = 0.98;
      finalBlur = Math.min(50, glassBlur + 15);
      finalSpeed = animationSpeed * 0.7; // Snappier animations
      root.style.setProperty('--focus-glow-dim', '0.1');
    } else if (viewMode === 'Presentation') {
      // Presentation Mode: enlarge fonts and increase visual scale
      root.style.setProperty('--font-scale-modifier', '1.15');
      root.style.setProperty('--spacing-scale-modifier', '1.2');
    } else if (viewMode === 'Executive') {
      // Executive Mode: Minimal effects, maximum clean readability
      finalOpacity = 0.96;
      root.style.setProperty('--focus-glow-dim', '0.05');
    } else {
      // Standard Reset
      root.style.setProperty('--font-scale-modifier', '1');
      root.style.setProperty('--spacing-scale-modifier', '1');
      root.style.setProperty('--focus-glow-dim', '1');
    }

    // Apply values to CSS custom properties
    root.style.setProperty('--app-canvas', wallpaper);
    root.style.setProperty('--glass-blur', `${finalBlur}px`);
    root.style.setProperty('--brand', accentColor);
    root.style.setProperty('--radius-xl', `${finalRadius}px`);
    root.style.setProperty('--radius-md', `${Math.max(10, finalRadius - 8)}px`);
    root.style.setProperty('--radius-lg', `${Math.max(12, finalRadius - 6)}px`);
    root.style.setProperty('--dur-base', `${finalSpeed}s`);
    root.style.setProperty('--dur-fast', `${finalSpeed * 0.6}s`);

    // Enforce high-readability surfaces for special elements (KPIs, Tables, Forms, Dialogs)
    const kpiOpacity = Math.max(0.96, finalOpacity);
    const tableOpacity = Math.max(0.95, finalOpacity);
    const formOpacity = Math.max(0.94, finalOpacity);
    const dialogOpacity = Math.max(0.97, finalOpacity);

    if (isLight) {
      root.style.setProperty('--bg-surface', `rgba(255, 255, 255, ${finalOpacity})`);
      root.style.setProperty('--bg-panel', `rgba(255, 255, 255, ${Math.min(0.98, finalOpacity + 0.05)})`);
      root.style.setProperty('--bg-sunken', `rgba(240, 244, 255, 0.90)`);
      root.style.setProperty('--bg-hover', `rgba(59, 130, 246, 0.06)`);
      root.style.setProperty('--glass-border', `1px solid rgba(255, 255, 255, 0.8)`);
      
      // Specialized Protected Glass Opacity
      root.style.setProperty('--bg-kpi', `rgba(255, 255, 255, ${kpiOpacity})`);
      root.style.setProperty('--bg-table', `rgba(255, 255, 255, ${tableOpacity})`);
      root.style.setProperty('--bg-form', `rgba(255, 255, 255, ${formOpacity})`);
      root.style.setProperty('--bg-dialog', `rgba(255, 255, 255, ${dialogOpacity})`);
    } else {
      root.style.setProperty('--bg-surface', `rgba(20, 28, 45, ${finalOpacity})`);
      root.style.setProperty('--bg-panel', `rgba(30, 41, 59, ${Math.min(0.98, finalOpacity + 0.05)})`);
      root.style.setProperty('--bg-sunken', `rgba(11, 16, 28, 0.90)`);
      root.style.setProperty('--bg-hover', `rgba(59, 130, 246, 0.12)`);
      root.style.setProperty('--glass-border', `1px solid rgba(255, 255, 255, 0.12)`);

      // Specialized Protected Glass Opacity
      root.style.setProperty('--bg-kpi', `rgba(20, 28, 45, ${kpiOpacity})`);
      root.style.setProperty('--bg-table', `rgba(20, 28, 45, ${tableOpacity})`);
      root.style.setProperty('--bg-form', `rgba(20, 28, 45, ${formOpacity})`);
      root.style.setProperty('--bg-dialog', `rgba(20, 28, 45, ${dialogOpacity})`);
    }

    const shadowColor = isLight ? `rgba(0, 0, 0, ${shadowSoftness * 0.25})` : `rgba(0, 0, 0, ${shadowSoftness * 0.95})`;
    root.style.setProperty('--e1', `0 4px 15px ${shadowColor}`);
    root.style.setProperty('--e2', `0 12px 35px ${shadowColor}`);
    root.style.setProperty('--e3', `0 24px 65px ${shadowColor}`);
    root.style.setProperty('--e4', `0 40px 95px ${shadowColor}`);

  }, [wallpaper, glassOpacity, glassBlur, accentColor, cornerRadius, shadowSoftness, animationSpeed, viewMode]);

  return (
    <WorkspaceContext.Provider
      value={{
        wallpaper,
        glassOpacity,
        glassBlur,
        accentColor,
        cornerRadius,
        shadowSoftness,
        animationSpeed,
        activePreset,
        viewMode,
        setWallpaper,
        setGlassOpacity,
        setGlassBlur,
        setAccentColor,
        setCornerRadius,
        setShadowSoftness,
        setAnimationSpeed,
        setViewMode,
        loadPreset,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within <WorkspaceProvider>');
  return ctx;
}
