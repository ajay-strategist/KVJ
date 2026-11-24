import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDevice } from '../hooks/responsive';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  maxWidth?: string | number;
  maxHeight?: string | number;
  closeOnBackdrop?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  maxWidth,
  maxHeight = '90dvh',
  closeOnBackdrop = true,
}: ModalProps) {
  const device = useDevice();
  const isMobile = device === 'mobile';

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthMap: Record<string, string> = {
    sm: 'min(440px, 94vw)',
    md: 'min(580px, 94vw)',
    lg: 'min(760px, 94vw)',
    xl: 'min(940px, 96vw)',
    '2xl': 'min(1140px, 96vw)',
    full: '96vw',
  };

  const computedWidth = maxWidth ? (typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth) : widthMap[size] || widthMap.md;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={closeOnBackdrop ? onClose : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-overlay, rgba(15, 23, 42, 0.55))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? 8 : 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? '100%' : computedWidth,
          maxHeight: isMobile ? '96dvh' : maxHeight,
          backgroundColor: 'var(--bg-panel, #FFFFFF)',
          color: 'var(--text-primary)',
          borderRadius: isMobile ? 12 : 16,
          boxShadow: 'var(--e4, 0 20px 45px -8px rgba(15, 23, 42, 0.28))',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          animation: 'flowdeskModalSpring 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          willChange: 'transform, opacity',
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 10,
            padding: isMobile ? '12px 16px' : '16px 22px',
            backgroundColor: 'var(--bg-panel, #FFFFFF)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            {typeof title === 'string' ? (
              <h3 style={{ margin: 0, fontSize: isMobile ? 15 : 16.5, fontWeight: 700, color: 'var(--text-primary)' }}>
                {title}
              </h3>
            ) : (
              title
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            title="Close dialog"
            style={{
              background: 'var(--bg-sunken)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 16,
              fontWeight: 500,
              width: 32,
              height: 32,
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              padding: 0,
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? 16 : 22,
            minHeight: 0,
            backgroundColor: 'var(--bg-panel, #FFFFFF)',
          }}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              flexShrink: 0,
              position: 'sticky',
              bottom: 0,
              zIndex: 10,
              padding: isMobile ? '12px 16px' : '14px 22px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
              backgroundColor: 'var(--bg-panel, #FFFFFF)',
            }}
          >
            {footer}
          </div>
        )}
      </div>

      <style>{`
        @keyframes flowdeskModalSpring {
          0% {
            opacity: 0;
            transform: scale(0.95) translateY(4px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>,
    document.body
  );
}

export default Modal;
