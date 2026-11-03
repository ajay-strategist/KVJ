import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { TUTORIAL_MODULES, TutorialItem } from './tutorial-data';

export type UserRoleFilter = 'ALL' | 'EMPLOYEE' | 'SUPERVISOR' | 'MANAGER' | 'ADMIN' | 'CEO';

interface TutorialContextValue {
  isOpen: boolean;
  activeModuleId: string;
  selectedRole: UserRoleFilter;
  searchQuery: string;
  activeSimulation: string | null;
  openTutorial: (tabOrModuleKey?: string, simulationKey?: string) => void;
  closeTutorial: () => void;
  setActiveModuleId: (id: string) => void;
  setSelectedRole: (role: UserRoleFilter) => void;
  setSearchQuery: (query: string) => void;
  startSimulation: (key: string) => void;
  closeSimulation: () => void;
  filteredModules: TutorialItem[];
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

// Helper to map route or tab name to the best tutorial module
export function resolveTutorialKey(input?: string): string {
  if (!input) return 'my-day';
  const clean = input.toLowerCase().trim();

  if (clean.includes('status')) return 'employee-status';
  if (clean.includes('directory') || clean.includes('employee')) return 'employee-directory';
  if (clean.includes('attendance') || clean.includes('shift')) return 'attendance';
  if (clean.includes('leave')) return 'leave';
  if (clean.includes('approval')) return 'approvals';
  if (clean.includes('batch') || clean.includes('course') || clean.includes('college') || clean.includes('student') || clean.includes('assessment')) return 'batch-management';
  if (clean.includes('calendar') || clean.includes('schedule')) return 'training-calendar';
  if (clean.includes('project') || clean.includes('task') || clean.includes('timesheet') || clean.includes('client')) return 'projects-tasks';
  if (clean.includes('expense') || clean.includes('finance') || clean.includes('claim')) return 'expenses';
  if (clean.includes('chat') || clean.includes('announcement') || clean.includes('email') || clean.includes('communication') || clean.includes('issue')) return 'communication';

  // Default to my-day
  return 'my-day';
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('my-day');
  const [selectedRole, setSelectedRole] = useState<UserRoleFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);

  const openTutorial = useCallback((tabOrModuleKey?: string, simulationKey?: string) => {
    if (tabOrModuleKey) {
      const resolved = resolveTutorialKey(tabOrModuleKey);
      const match = TUTORIAL_MODULES.find(m => m.id === resolved || m.tabKey === resolved);
      if (match) {
        setActiveModuleId(match.id);
      }
    }
    if (simulationKey) {
      setActiveSimulation(simulationKey);
    }
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
  }, []);

  const startSimulation = useCallback((key: string) => {
    setActiveSimulation(key);
  }, []);

  const closeSimulation = useCallback(() => {
    setActiveSimulation(null);
  }, []);

  // Global keyboard shortcut: '?' or 'Shift + /'
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea or contentEditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape') {
        if (activeSimulation) {
          setActiveSimulation(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeSimulation]);

  // Role & Search filtered modules
  const filteredModules = React.useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return TUTORIAL_MODULES.filter(item => {
      // Role filter
      if (selectedRole !== 'ALL') {
        if (!item.rolesAllowed.includes('ALL') && !item.rolesAllowed.includes(selectedRole)) {
          return false;
        }
      }

      // Search filter
      if (!q) return true;

      const titleMatch = item.title.toLowerCase().includes(q);
      const summaryMatch = item.summary.toLowerCase().includes(q);
      const moduleMatch = item.module.toLowerCase().includes(q);
      const workflowMatch = item.workflows.some(w =>
        w.title.toLowerCase().includes(q) ||
        w.summary.toLowerCase().includes(q) ||
        w.steps.some(s => s.toLowerCase().includes(q)) ||
        (w.fields && w.fields.some(f => f.label.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))) ||
        (w.commonErrors && w.commonErrors.some(err => err.error.toLowerCase().includes(q) || err.solution.toLowerCase().includes(q)))
      );
      const faqMatch = item.faq.some(f => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q));

      return titleMatch || summaryMatch || moduleMatch || workflowMatch || faqMatch;
    });
  }, [selectedRole, searchQuery]);

  return (
    <TutorialContext.Provider
      value={{
        isOpen,
        activeModuleId,
        selectedRole,
        searchQuery,
        activeSimulation,
        openTutorial,
        closeTutorial,
        setActiveModuleId,
        setSelectedRole,
        setSearchQuery,
        startSimulation,
        closeSimulation,
        filteredModules,
      }}
    >
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return ctx;
}

