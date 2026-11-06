import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from './TutorialContext';
import { WALKTHROUGH_TOURS, WalkthroughStep } from './walkthrough-data';

export function TutorialWalkthroughOverlay() {
  const { activeTourId, closeTour, completeTour, isTourActive } = useTutorial();
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const tour = useMemo(() => {
    return activeTourId ? WALKTHROUGH_TOURS[activeTourId] : null;
  }, [activeTourId]);

  const currentStep: WalkthroughStep | null = useMemo(() => {
    if (!tour || !tour.steps || tour.steps.length === 0) return null;
    return tour.steps[currentStepIdx] || null;
  }, [tour, currentStepIdx]);

  // Locate targeted element on DOM and compute bounding rectangle
  const updateTargetPosition = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }

    const selectors = currentStep.targetSelector.split(',').map((s) => s.trim());
    let element: HTMLElement | null = null;
    for (const sel of selectors) {
      try {
        const found = document.querySelector(sel);
        if (found instanceof HTMLElement && found.offsetParent !== null) {
          element = found;
          break;
        }
      } catch {
        /* noop */
      }
    }

    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null); // Fallback to centered dialog
    }
  }, [currentStep]);

  // Update position on step change and handle window resize
  useEffect(() => {
    if (!isTourActive) return;
    updateTargetPosition();

    const timer = setTimeout(updateTargetPosition, 250);
    window.addEventListener('resize', updateTargetPosition);
    window.addEventListener('scroll', updateTargetPosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateTargetPosition);
      window.removeEventListener('scroll', updateTargetPosition, true);
    };
  }, [isTourActive, currentStepIdx, updateTargetPosition]);

  // Reset step index when tour opens
  useEffect(() => {
    if (activeTourId) {
      setCurrentStepIdx(0);
      setShowCelebration(false);
    }
  }, [activeTourId]);

  // Global keydown: Escape to exit
  useEffect(() => {
    if (!isTourActive) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTour();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isTourActive, closeTour]);

  if (!isTourActive || !tour || !currentStep) return null;

  const totalSteps = tour.steps.length;
  const progressPct = Math.round(((currentStepIdx + 1) / totalSteps) * 100);

  const handleNext = () => {
    if (currentStepIdx < totalSteps - 1) {
      setCurrentStepIdx((i) => i + 1);
    } else {
      setShowCelebration(true);
      completeTour(tour.id, tour.xpReward);
    }
  };

  const handlePrev = () => {
    if (currentStepIdx > 0) {
      setCurrentStepIdx((i) => i - 1);
    }
  };

  // Compute tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 100002,
        maxWidth: 440,
        width: '90vw',
      };
    }

    const margin = 16;
    const width = 380;
    let top = targetRect.bottom + margin;
    let left = targetRect.left;

    // Boundary checks
    if (top + 240 > window.innerHeight) {
      top = Math.max(margin, targetRect.top - 240 - margin);
    }
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 100002,
      width: `${width}px`,
      maxWidth: '90vw',
      animation: 'fadeIn 180ms ease-out',
    };
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100000, pointerEvents: 'auto' }}>
      {/* Semi-transparent dark mask */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          transition: 'all 200ms ease',
        }}
        onClick={closeTour}
      />

      {/* Spotlight cutout around the target element */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: 12,
            border: '2px solid #6366f1',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 24px rgba(99, 102, 241, 0.6)',
            pointerEvents: 'none',
            zIndex: 100001,
            transition: 'all 250ms ease-out',
          }}
        />
      )}

      {/* Gamified Celebration Dialog */}
      {showCelebration ? (
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100003,
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: 20,
            border: '2px solid #6366f1',
            boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
            padding: '32px 28px',
            textAlign: 'center',
            maxWidth: 420,
            width: '90vw',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            animation: 'scaleIn 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div style={{ fontSize: 52 }}>🏆</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Tour Completed!
          </h2>
          <div
            style={{
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              color: '#ffffff',
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⭐ Badge Unlocked:</span>
            <span>{tour.badgeName}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
            Congratulations! You have completed the <strong>{tour.title}</strong> and earned{' '}
            <strong>+{tour.xpReward} XP</strong> in system proficiency.
          </p>
          <button
            type="button"
            onClick={closeTour}
            style={{
              marginTop: 8,
              padding: '10px 24px',
              borderRadius: 10,
              background: '#4f46e5',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            }}
          >
            Claim & Return to App
          </button>
        </div>
      ) : (
        /* Floating Contextual Tooltip Card */
        <div
          style={{
            ...getTooltipStyle(),
            background: 'var(--bg-surface, #ffffff)',
            borderRadius: 16,
            border: '1px solid var(--border, #cbd5e1)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* Header & Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  background: 'rgba(79, 70, 229, 0.1)',
                  color: '#4f46e5',
                  padding: '3px 8px',
                  borderRadius: 6,
                }}
              >
                🎮 Guided Walkthrough
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>
                {currentStepIdx + 1}/{totalSteps}
              </span>
            </div>
            <button
              type="button"
              onClick={closeTour}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 16,
                padding: '2px 6px',
                borderRadius: 4,
              }}
              title="Exit Tour (Esc)"
            >
              ✕
            </button>
          </div>

          {/* Gamified Animated Progress Bar */}
          <div
            style={{
              height: 5,
              borderRadius: 3,
              background: 'var(--bg-sunken, #f1f5f9)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #4f46e5, #06b6d4)',
                borderRadius: 3,
                transition: 'width 250ms ease',
              }}
            />
          </div>

          {/* Title and Content */}
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentStep.title}
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {currentStep.description}
            </p>
          </div>

          {/* Action Hint */}
          <div
            style={{
              background: 'var(--bg-sunken, #f8fafc)',
              border: '1px dashed var(--border, #cbd5e1)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--brand, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💡</span>
            <span>{currentStep.actionHint}</span>
          </div>

          {/* Bottom Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentStepIdx === 0}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
                color: currentStepIdx === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: currentStepIdx === 0 ? 'not-allowed' : 'pointer',
                opacity: currentStepIdx === 0 ? 0.5 : 1,
              }}
            >
              ◀ Back
            </button>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={closeTour}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Skip Tour
              </button>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                }}
              >
                {currentStepIdx === totalSteps - 1 ? 'Finish & Claim XP 🏆' : 'Next Step ▶'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

