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
    glassOpacity: 0.45,
    glassBlur: 30,
    accentColor: '#3B82F6',
    cornerRadius: 24,
    shadowSoftness: 0.35,
    animationSpeed: 0.3,
  },
  'Aurora Dream': {
    name: 'Aurora Dream',
    wallpaper: 'radial-gradient(circle at 20% 30%, #0d9488 0%, #4338ca 60%, #581c87 100%)',
    glassOpacity: 0.35,
    glassBlur: 25,
    accentColor: '#14B8A6',
    cornerRadius: 24,
    shadowSoftness: 0.40,
    animationSpeed: 0.35,
  },
  'Cyber Blue': {
    name: 'Cyber Blue',
    wallpaper: 'linear-gradient(180deg, #090d16 0%, #0b1a30 50%, #020617 100%)',
    glassOpacity: 0.55,
    glassBlur: 20,
    accentColor: '#0EA5E9',
    cornerRadius: 16,
    shadowSoftness: 0.25,
    animationSpeed: 0.24,
  },
  'Ocean Deep': {
    name: 'Ocean Deep',
    wallpaper: 'radial-gradient(circle at 50% 50%, #075985 0%, #0c4a6e 50%, #030712 100%)',
    glassOpacity: 0.40,
    glassBlur: 35,
    accentColor: '#0284C7',
    cornerRadius: 28,
    shadowSoftness: 0.45,
    animationSpeed: 0.4,
  },
  'Glass White (VisionOS)': {
    name: 'Glass White (VisionOS)',
    wallpaper: 'radial-gradient(circle at 10% 10%, #e0f2fe 0%, #f3e8ff 50%, #faf5ff 100%)',
    glassOpacity: 0.65,
    glassBlur: 25,
    accentColor: '#4F46E5',
    cornerRadius: 24,
    shadowSoftness: 0.15,
    animationSpeed: 0.3,
  },
  'Minimal Luxe': {
    name: 'Minimal Luxe',
    wallpaper: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
    glassOpacity: 0.25,
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

interface WorkspaceContextValue {
  wallpaper: string;
  glassOpacity: number;
  glassBlur: number;
  accentColor: string;
  cornerRadius: number;
  shadowSoftness: number;
  animationSpeed: number;
  activePreset: string;
  setWallpaper: (val: string) => void;
  setGlassOpacity: (val: number) => void;
  setGlassBlur: (val: number) => void;
  setAccentColor: (val: string) => void;
  setCornerRadius: (val: number) => void;
  setShadowSoftness: (val: number) => void;
  setAnimationSpeed: (val: number) => void;
  loadPreset: (name: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activePreset, setActivePreset] = useState('Executive Glass');
  const [wallpaper, setWallpaper] = useState(WORKSPACE_PRESETS['Executive Glass'].wallpaper);
  const [glassOpacity, setGlassOpacity] = useState(WORKSPACE_PRESETS['Executive Glass'].glassOpacity);
  const [glassBlur, setGlassBlur] = useState(WORKSPACE_PRESETS['Executive Glass'].glassBlur);
  const [accentColor, setAccentColor] = useState(WORKSPACE_PRESETS['Executive Glass'].accentColor);
  const [cornerRadius, setCornerRadius] = useState(WORKSPACE_PRESETS['Executive Glass'].cornerRadius);
  const [shadowSoftness, setShadowSoftness] = useState(WORKSPACE_PRESETS['Executive Glass'].shadowSoftness);
  const [animationSpeed, setAnimationSpeed] = useState(WORKSPACE_PRESETS['Executive Glass'].animationSpeed);

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
    root.style.setProperty('--app-canvas', wallpaper);
    root.style.setProperty('--glass-blur', `${glassBlur}px`);
    root.style.setProperty('--brand', accentColor);
    root.style.setProperty('--radius-xl', `${cornerRadius}px`);
    root.style.setProperty('--radius-md', `${Math.max(10, cornerRadius - 8)}px`);
    root.style.setProperty('--radius-lg', `${Math.max(12, cornerRadius - 6)}px`);
    root.style.setProperty('--dur-base', `${animationSpeed}s`);
    root.style.setProperty('--dur-fast', `${animationSpeed * 0.6}s`);

    // Dynamic shadow softness calculation based on wallpaper and sliders
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' ||
                    document.documentElement.getAttribute('data-theme') === 'hud-light';
    const shadowColor = isLight ? `rgba(0, 0, 0, ${shadowSoftness * 0.25})` : `rgba(0, 0, 0, ${shadowSoftness * 0.95})`;
    root.style.setProperty('--e1', `0 4px 15px ${shadowColor}`);
    root.style.setProperty('--e2', `0 12px 35px ${shadowColor}`);
    root.style.setProperty('--e3', `0 24px 65px ${shadowColor}`);
    root.style.setProperty('--e4', `0 40px 95px ${shadowColor}`);

    // Glass opacity variables
    const surfaceOpacity = glassOpacity;
    const panelOpacity = Math.min(0.95, glassOpacity + 0.15);
    const sunkenOpacity = Math.min(0.90, glassOpacity + 0.10);
    const hoverOpacity = Math.min(0.20, glassOpacity * 0.3);

    if (isLight) {
      root.style.setProperty('--bg-surface', `rgba(255, 255, 255, ${surfaceOpacity})`);
      root.style.setProperty('--bg-panel', `rgba(255, 255, 255, ${panelOpacity})`);
      root.style.setProperty('--bg-sunken', `rgba(240, 244, 255, ${sunkenOpacity})`);
      root.style.setProperty('--bg-hover', `rgba(59, 130, 246, ${hoverOpacity})`);
      root.style.setProperty('--glass-border', `1px solid rgba(255, 255, 255, ${1 - glassOpacity + 0.25})`);
    } else {
      root.style.setProperty('--bg-surface', `rgba(20, 28, 45, ${surfaceOpacity})`);
      root.style.setProperty('--bg-panel', `rgba(30, 41, 59, ${panelOpacity})`);
      root.style.setProperty('--bg-sunken', `rgba(11, 16, 28, ${sunkenOpacity})`);
      root.style.setProperty('--bg-hover', `rgba(59, 130, 246, ${hoverOpacity})`);
      root.style.setProperty('--glass-border', `1px solid rgba(255, 255, 255, ${Math.min(0.25, (1 - glassOpacity) * 0.2)})`);
    }
  }, [wallpaper, glassOpacity, glassBlur, accentColor, cornerRadius, shadowSoftness, animationSpeed]);

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
        setWallpaper,
        setGlassOpacity,
        setGlassBlur,
        setAccentColor,
        setCornerRadius,
        setShadowSoftness,
        setAnimationSpeed,
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
