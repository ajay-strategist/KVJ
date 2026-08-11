import { type ReactNode, useEffect } from 'react';
import { useDevice } from '../hooks/responsive';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Drawer({ open, onClose, title, children, footer, size = 'md' }: DrawerProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthMap = {
    sm: 'min(380px, 100vw)',
    md: 'min(520px, 100vw)',
    lg: 'min(680px, 100vw)',
    xl: 'min(860px, 100vw)',
  };

  return (
    <div
      className="kvj-drawer-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay)',
        backdropFilter: 'blur(var(--overlay-blur, 3px))',
        WebkitBackdropFilter: 'blur(var(--overlay-blur, 3px))',
        zIndex: 1250,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        className="kvj-drawer-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100vw' : widthMap[size],
          height: '100dvh',
          maxHeight: '100dvh',
          backgroundColor: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          boxShadow: 'var(--e4)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          animation: 'slideIn var(--dur-base) var(--ease-emphasized)',
        }}
      >
        {/* Header (Sticky, solid panel background, never scrolls away) */}
        <div
          style={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 20,
            padding: '16px 20px',
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            title="Close drawer"
            className="kvj-drawer-close"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '6px',
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              flexShrink: 0,
              position: 'sticky',
              bottom: 0,
              zIndex: 20,
              padding: '14px 20px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              background: 'var(--bg-panel)',
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
export default Drawer;
