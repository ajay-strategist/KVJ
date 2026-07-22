/**
 * KVJ Analytics Enterprise — Reusable UI Kit v2
 * Layer: Shared. Token-driven, dark-mode-automatic primitives.
 * Phase 2 additions: loading states, ProgressBar, Tooltip, SkeletonCard,
 * SkeletonTable, WorkflowStrip, FilterChip, SectionDivider, Spinner.
 */

import {
  type ButtonHTMLAttributes, type ReactNode, useState, useRef, useEffect,
} from 'react';
import './ui.css';

export type StatusTone =
  | 'success' | 'warning' | 'danger' | 'info' | 'progress' | 'neutral' | 'purple' | 'brand';

// ── Button / IconButton ──────────────────────────────────────────────────────
export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  loading = false,
  children,
  className = '',
  ...rest
}: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`kvj-btn kvj-btn--${variant} ${size !== 'md' ? `kvj-btn--${size}` : ''} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? (
        <span className="kvj-btn__spinner" />
      ) : leftIcon ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{rightIcon}</span>
      )}
    </button>
  );
}

export function IconButton({
  label,
  size = 'md',
  children,
  className = '',
  ...rest
}: { label: string; size?: 'sm' | 'md' | 'lg' } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      className={`kvj-btn kvj-btn--ghost kvj-icon-btn ${size !== 'md' ? `kvj-icon-btn--${size}` : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({
  hover,
  interactive,
  variant,
  padding = 'normal',
  loading,
  children,
  style,
  className = '',
  onClick,
}: {
  hover?: boolean;
  interactive?: boolean;
  variant?: 'flat' | 'elevated' | 'bordered';
  padding?: 'compact' | 'normal' | 'spacious';
  loading?: boolean;
  children: ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: () => void;
}) {
  const variantClass = variant ? `kvj-card--${variant}` : '';
  const hoverClass = hover ? 'kvj-card--hover' : '';
  const interactiveClass = interactive ? 'kvj-card--interactive' : '';
  const bodyClass = padding === 'compact' ? 'kvj-card__body--compact' : padding === 'spacious' ? 'kvj-card__body--spacious' : 'kvj-card__body';
  return (
    <div
      className={`kvj-card ${variantClass} ${hoverClass} ${interactiveClass} ${className}`}
      style={style}
      onClick={onClick}
    >
      <div className={bodyClass} style={{ position: 'relative' }}>
        {loading && (
          <div className="kvj-loading-overlay" style={{ borderRadius: 'var(--radius-xl)' }}>
            <span className="kvj-spinner" />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="kvj-card kvj-card--flat" style={style}>
      <div className="kvj-card__body">{children}</div>
    </div>
  );
}

// ── Badge / StatusChip ───────────────────────────────────────────────────────
export function Badge({
  tone = 'neutral',
  dot,
  size,
  children,
}: {
  tone?: StatusTone;
  dot?: boolean;
  size?: 'sm' | 'lg';
  children: ReactNode;
}) {
  return (
    <span className={`kvj-badge kvj-badge--${tone} ${size ? `kvj-badge--${size}` : ''}`}>
      {dot && <span className="kvj-badge__dot" />}
      {children}
    </span>
  );
}

export function StatusChip({ tone = 'neutral', label }: { tone?: StatusTone; label: string }) {
  return (
    <span className={`kvj-badge kvj-badge--${tone}`}>
      <span className="kvj-badge__dot" />
      {label}
    </span>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({
  name,
  src,
  size = 32,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className="kvj-avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {src ? (
        <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        initials
      )}
    </span>
  );
}

// ── Headers ──────────────────────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  actions,
  tabs,
  breadcrumb,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tabs?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumb}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-bold)',
              letterSpacing: 'var(--letter-spacing-tight)',
              color: 'var(--text-primary)',
              lineHeight: 'var(--line-height-tight)',
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 'var(--font-size-base)',
                color: 'var(--text-muted)',
                lineHeight: 'var(--line-height-normal)',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      {tabs && <div style={{ marginTop: 16 }}>{tabs}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  action?: ReactNode;
  subtitle?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 8 }}>
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--text-primary)',
            letterSpacing: 'var(--letter-spacing-tight)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p style={{ margin: '3px 0 0', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({
  label,
  value,
  delta,
  tone = 'progress',
  icon,
  loading,
  sparkline,
}: {
  label: string;
  value: ReactNode;
  delta?: { value: string; up?: boolean };
  tone?: StatusTone;
  icon?: ReactNode;
  loading?: boolean;
  sparkline?: ReactNode;
}) {
  return (
    <Card loading={loading}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {icon && (
          <span
            className={`kvj-badge kvj-badge--${tone}`}
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              justifyContent: 'center',
              padding: 0,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        {delta && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: delta.up ? 'var(--status-success)' : 'var(--status-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {delta.up ? '↑' : '↓'} {delta.value}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-3xl)',
          fontWeight: 'var(--font-weight-bold)',
          marginTop: 14,
          letterSpacing: 'var(--letter-spacing-tight)',
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {loading ? <span className="kvj-skeleton" style={{ width: 80, height: 34, display: 'block' }} /> : value}
      </div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
      {sparkline && <div style={{ marginTop: 12 }}>{sparkline}</div>}
    </Card>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  icon = '✧',
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="kvj-empty-state">
      <div className="kvj-empty-state__icon">{icon}</div>
      <p className="kvj-empty-state__title">{title}</p>
      {message && <p className="kvj-empty-state__message">{message}</p>}
      {action}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({
  width = '100%',
  height = 16,
  radius = 8,
  style,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return <div className="kvj-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <Skeleton width="60%" height={18} radius={8} style={{ marginBottom: 14 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? '75%' : '100%'} height={13} radius={6} style={{ marginBottom: 10 }} />
      ))}
    </Card>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: '8px 16px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} radius={4} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            gap: 12,
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} height={14} radius={6} width={c === 0 ? '70%' : '90%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <svg
        style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
        width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      >
        <circle cx={11} cy={11} r={8} /><path d="m21 21-4.3-4.3" />
      </svg>
      <input
        className="kvj-input"
        style={{ paddingLeft: 36 }}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ── QuickActionCard ──────────────────────────────────────────────────────────
export function QuickActionCard({
  icon,
  label,
  description,
  tone = 'progress',
  onClick,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  tone?: StatusTone;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="kvj-card kvj-card--interactive"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        alignItems: 'flex-start',
        border: '1px solid var(--border)',
        textAlign: 'left',
        color: 'var(--text-primary)',
        width: '100%',
      }}
    >
      <span
        className={`kvj-badge kvj-badge--${tone}`}
        style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', justifyContent: 'center', padding: 0 }}
      >
        {icon}
      </span>
      <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)' }}>{label}</span>
      {description && (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>{description}</span>
      )}
    </button>
  );
}

// ── Timeline / ActivityCard ──────────────────────────────────────────────────
export interface TimelineEntry {
  id: string;
  title: string;
  time: string;
  description?: string;
  tone?: StatusTone;
}
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span
              className={`kvj-badge kvj-badge--${e.tone ?? 'neutral'}`}
              style={{ width: 12, height: 12, padding: 0, borderRadius: '50%', flexShrink: 0 }}
            />
            {i < entries.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border)', margin: '4px 0' }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--text-primary)' }}>{e.title}</div>
            {e.description && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{e.description}</div>}
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{e.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActivityCard({ actor, action, time }: { actor: string; action: string; time: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0' }}>
      <Avatar name={actor} size={30} />
      <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>
        <strong>{actor}</strong> {action}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{time}</div>
    </div>
  );
}

// ── ProgressBar ──────────────────────────────────────────────────────────────
export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  tone = 'progress',
  showLabel,
}: {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  tone?: StatusTone;
  showLabel?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colorMap: Record<string, string> = {
    success: 'var(--status-success)',
    warning: 'var(--status-warning)',
    danger: 'var(--status-danger)',
    info: 'var(--status-info)',
    progress: 'linear-gradient(90deg, var(--brand), var(--accent))',
    neutral: 'var(--text-muted)',
    purple: 'var(--status-purple)',
    brand: 'var(--brand)',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div className={`kvj-progress kvj-progress--${size}`} style={{ flex: 1 }}>
        <div
          className="kvj-progress__bar"
          style={{ width: `${pct}%`, background: colorMap[tone] || colorMap.progress }}
        />
      </div>
      {showLabel && (
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-muted)', minWidth: 36, textAlign: 'right' }}>
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}

// ── Spinner ──────────────────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`kvj-spinner kvj-spinner--${size}`} />;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────
export function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div
      className="kvj-tooltip-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {children}
      {visible && <div className="kvj-tooltip">{content}</div>}
    </div>
  );
}

// ── FilterChip ───────────────────────────────────────────────────────────────
export function FilterChip({
  label,
  active,
  onClick,
  count,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`kvj-chip ${active ? 'kvj-chip--active' : ''}`}
    >
      {label}
      {count !== undefined && (
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '1px 5px',
            borderRadius: 999,
            background: active ? 'rgba(59,130,246,0.20)' : 'var(--bg-sunken)',
            color: active ? 'var(--brand)' : 'var(--text-muted)',
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── SectionDivider ────────────────────────────────────────────────────────────
export function SectionDivider({ label }: { label?: string }) {
  if (!label) return <hr className="kvj-divider" />;
  return <div className="kvj-section-divider">{label}</div>;
}

// ── WorkflowStrip ─────────────────────────────────────────────────────────────
export function WorkflowStrip({
  steps,
  current,
}: {
  steps: string[];
  current: string;
}) {
  const currentIdx = steps.indexOf(current);
  return (
    <div className="kvj-workflow-strip">
      {steps.map((step, i) => (
        <div key={step} className="kvj-workflow-step">
          <span
            className={`kvj-workflow-step__label ${
              i === currentIdx
                ? 'kvj-workflow-step__label--active'
                : i < currentIdx
                ? 'kvj-workflow-step__label--done'
                : ''
            }`}
          >
            {i < currentIdx && '✓ '}
            {step}
          </span>
          {i < steps.length - 1 && <span className="kvj-workflow-step__connector" />}
        </div>
      ))}
    </div>
  );
}

// ── InfoRow (key-value display) ───────────────────────────────────────────────
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', minWidth: 120, flexShrink: 0, paddingTop: 2 }}>
        {label}
      </span>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', flex: 1 }}>{value}</span>
    </div>
  );
}

// ── Kbd (keyboard shortcut) ───────────────────────────────────────────────────
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        background: 'var(--bg-sunken)',
        border: '1px solid var(--border)',
        borderBottom: '2px solid var(--border-strong)',
        borderRadius: 'var(--radius-xs)',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </kbd>
  );
}

// ── Re-export for convenience ─────────────────────────────────────────────────
export { Tooltip as TooltipWrap };
