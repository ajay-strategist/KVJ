/**
 * KVJ Analytics — Reusable UI kit (Prompt 5/9 §9,10)
 * Layer: Shared. Token-driven, dark-mode-automatic primitives used by every
 * module. Import from '@shared/ui' (relative). No business logic here.
 */

import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import './ui.css';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'progress' | 'neutral';

// ── Button / IconButton ──────────────────────────────────────────────────────
export function Button({ variant = 'primary', size = 'md', leftIcon, children, className = '', ...rest }: {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' | 'lg'; leftIcon?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`kvj-btn kvj-btn--${variant} ${size !== 'md' ? `kvj-btn--${size}` : ''} ${className}`} {...rest}>
      {leftIcon}{children}
    </button>
  );
}
export function IconButton({ label, children, className = '', ...rest }: { label: string } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button aria-label={label} className={`kvj-btn kvj-btn--ghost kvj-icon-btn ${className}`} {...rest}>{children}</button>;
}

// ── Card ─────────────────────────────────────────────────────────────────────
export function Card({ hover, children, style }: { hover?: boolean; children: ReactNode; style?: React.CSSProperties }) {
  return <div className={`kvj-card ${hover ? 'kvj-card--hover' : ''}`} style={style}><div className="kvj-card__body">{children}</div></div>;
}
export function Panel({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return <div className="kvj-card" style={{ boxShadow: 'none', ...style }}><div className="kvj-card__body">{children}</div></div>;
}

// ── Badge / StatusChip ───────────────────────────────────────────────────────
export function Badge({ tone = 'neutral', children }: { tone?: StatusTone; children: ReactNode }) {
  return <span className={`kvj-badge kvj-badge--${tone}`}>{children}</span>;
}
export function StatusChip({ tone = 'neutral', label }: { tone?: StatusTone; label: string }) {
  return <span className={`kvj-badge kvj-badge--${tone}`}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />{label}</span>;
}

// ── Avatar ───────────────────────────────────────────────────────────────────
export function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span className="kvj-avatar" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {src ? <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
    </span>
  );
}

// ── Headers ──────────────────────────────────────────────────────────────────
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{title}</h1>
        {subtitle && <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--text-secondary)' }}>{subtitle}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8 }}>{actions}</div>}
    </div>
  );
}
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</h2>
      {action}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
export function StatCard({ label, value, delta, tone = 'progress', icon }: {
  label: string; value: ReactNode; delta?: { value: string; up?: boolean }; tone?: StatusTone; icon?: ReactNode;
}) {
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {icon && <span className={`kvj-badge kvj-badge--${tone}`} style={{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', padding: 0 }}>{icon}</span>}
        {delta && <span style={{ fontSize: 12, fontWeight: 600, color: delta.up ? 'var(--status-success)' : 'var(--status-danger)' }}>{delta.up ? '▲' : '▼'} {delta.value}</span>}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 12, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
    </Card>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '✧', title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px', display: 'grid', placeItems: 'center', fontSize: 24, color: '#fff', background: 'linear-gradient(135deg, var(--brand), var(--accent))' }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
      {message && <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '4px auto 16px', maxWidth: 340 }}>{message}</div>}
      {action}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
export function Skeleton({ width = '100%', height = 16, radius = 8, style }: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return <div className="kvj-skeleton" style={{ width, height, borderRadius: radius, ...style }} />;
}

// ── SearchInput ──────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 14 }}>⌕</span>
      <input className="kvj-input" style={{ paddingLeft: 34 }} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ── QuickActionCard ──────────────────────────────────────────────────────────
export function QuickActionCard({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="kvj-card kvj-card--hover" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', cursor: 'pointer', border: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-primary)' }}>
      <span className="kvj-badge kvj-badge--progress" style={{ width: 34, height: 34, borderRadius: 10, justifyContent: 'center', padding: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ── Timeline / ActivityCard ──────────────────────────────────────────────────
export interface TimelineEntry { id: string; title: string; time: string; description?: string; tone?: StatusTone }
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {entries.map((e, i) => (
        <div key={e.id} style={{ display: 'flex', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className={`kvj-badge kvj-badge--${e.tone ?? 'neutral'}`} style={{ width: 12, height: 12, padding: 0, borderRadius: '50%' }} />
            {i < entries.length - 1 && <span style={{ flex: 1, width: 2, background: 'var(--border)' }} />}
          </div>
          <div style={{ paddingBottom: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{e.title}</div>
            {e.description && <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{e.description}</div>}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{e.time}</div>
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
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)' }}><strong>{actor}</strong> {action}</div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{time}</div>
    </div>
  );
}
