/**
 * KVJ Analytics — Command Palette / Global Search infrastructure (Prompt 9 §8)
 * Layer: Shared. INFRASTRUCTURE ONLY — no business search logic. Modules register
 * command/search providers; the palette aggregates and displays results.
 * Opened via ⌘/Ctrl-K. Recent commands persisted.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  group: string;             // e.g. 'Navigation', 'Actions', 'Training'
  keywords?: string[];
  run: () => void;
}

/** A provider contributes commands/search results for a query. */
export interface SearchProvider {
  id: string;
  /** Return commands matching the query (empty query => default/quick items). */
  query: (term: string) => CommandItem[] | Promise<CommandItem[]>;
}

interface CommandPaletteContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  registerProvider: (p: SearchProvider) => () => void;
  recent: string[];
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);
const RECENT_KEY = 'kvj.cmd.recent';

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<SearchProvider[]>([]);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<CommandItem[]>([]);
  const [recent, setRecent] = useState<string[]>(() => JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'));

  const registerProvider = useCallback((p: SearchProvider) => {
    setProviders((prev) => [...prev.filter((x) => x.id !== p.id), p]);
    return () => setProviders((prev) => prev.filter((x) => x.id !== p.id));
  }, []);

  // Global keyboard shortcut.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((v) => !v); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Aggregate provider results whenever the term changes.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    Promise.all(providers.map((p) => p.query(term))).then((lists) => {
      if (alive) setResults(lists.flat());
    });
    return () => { alive = false; };
  }, [term, providers, open]);

  const runItem = useCallback((item: CommandItem) => {
    const next = [item.title, ...recent.filter((r) => r !== item.title)].slice(0, 6);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    setOpen(false);
    item.run();
  }, [recent]);

  const value = useMemo(() => ({ open, setOpen, registerProvider, recent }), [open, registerProvider, recent]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1250, background: 'rgba(2,6,23,.45)', display: 'grid', placeItems: 'start center', paddingTop: '12vh' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(560px,92%)', background: 'var(--bg-panel)', color: 'var(--text-primary)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--e4)', overflow: 'hidden' }}>
            <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search in Nexus...  (⌘K)"
              style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', padding: '16px 18px', fontSize: 15, outline: 'none' }} />
            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
              {results.length === 0 && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {term ? 'No matches.' : 'Type to search. Modules will contribute results here.'}
                </div>
              )}
              {results.map((item) => (
                <button key={item.id} onClick={() => runItem(item)} style={{
                  width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'inherit',
                  padding: '10px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'flex', flexDirection: 'column',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{item.title}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.group}{item.subtitle ? ` · ${item.subtitle}` : ''}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used within <CommandPaletteProvider>');
  return ctx;
}
