import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useMemo } from 'react';
import { TUTORIAL_MODULES, TutorialItem } from './tutorial-data';
import {
  UserRoleFilter,
  normalizeUserRole,
  getAllowedRoleFilters,
  isModuleAllowedForUser,
  isWorkflowAllowedForUser,
} from './tutorial-roles';
import { useAuth } from '../auth/AuthProvider';

export type { UserRoleFilter };

interface TutorialContextValue {
  isOpen: boolean;
  activeModuleId: string;
  selectedRole: UserRoleFilter;
  currentUserRole: UserRoleFilter;
  allowedRoleFilters: UserRoleFilter[];
  searchQuery: string;
  activeSimulation: string | null;
  activeTourId: string | null;
  isTourActive: boolean;
  isDemoMode: boolean;
  userXP: number;
  completedTours: string[];

  // Modal actions
  openTutorial: (tabOrModuleKey?: string, simulationKey?: string) => void;
  closeTutorial: () => void;
  setActiveModuleId: (id: string) => void;
  setSelectedRole: (role: UserRoleFilter) => void;
  setSearchQuery: (query: string) => void;

  // Practice Simulator actions
  startSimulation: (key: string) => void;
  closeSimulation: () => void;

  // Guided Walkthrough Tour actions
  startTour: (tourId?: string) => void;
  closeTour: () => void;
  completeTour: (tourId: string, xpEarned: number) => void;

  // Safe Demo Mode actions
  setDemoMode: (active: boolean) => void;
  resetDemoState: () => void;

  // Filtered dataset
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
  // Gracefully obtain current authenticated user's role
  let rawRole: string | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const auth = useAuth();
    rawRole = auth.user?.role;
  } catch {
    // Graceful fallback for test runners or environments outside AuthProvider
    rawRole = undefined;
  }

  const currentUserRole = useMemo(() => normalizeUserRole(rawRole), [rawRole]);
  const allowedRoleFilters = useMemo(() => getAllowedRoleFilters(rawRole), [rawRole]);

  const [isOpen, setIsOpen] = useState(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('my-day');
  const [selectedRole, setSelectedRole] = useState<UserRoleFilter>(currentUserRole);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSimulation, setActiveSimulation] = useState<string | null>(null);
  const [activeTourId, setActiveTourId] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [userXP, setUserXP] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('flwdsk_tutorial_xp') || 0);
    } catch {
      return 0;
    }
  });
  const [completedTours, setCompletedTours] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('flwdsk_completed_tours') || '[]');
    } catch {
      return [];
    }
  });

  // Synchronize selectedRole when user changes
  useEffect(() => {
    if (!allowedRoleFilters.includes(selectedRole)) {
      setSelectedRole(currentUserRole);
    }
  }, [currentUserRole, allowedRoleFilters, selectedRole]);

  // Modal triggers
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

  // Practice Simulation triggers
  const startSimulation = useCallback((key: string) => {
    setActiveSimulation(key);
  }, []);

  const closeSimulation = useCallback(() => {
    setActiveSimulation(null);
  }, []);

  // Guided Walkthrough Tour triggers
  const startTour = useCallback((tourId?: string) => {
    const tId = tourId || activeModuleId || 'my-day';
    setActiveTourId(tId);
    setIsOpen(false); // Close modal so user can view the actual page spotlight
  }, [activeModuleId]);

  const closeTour = useCallback(() => {
    setActiveTourId(null);
  }, []);

  const completeTour = useCallback((tourId: string, xpEarned: number) => {
    setCompletedTours(prev => {
      if (prev.includes(tourId)) return prev;
      const next = [...prev, tourId];
      try {
        localStorage.setItem('flwdsk_completed_tours', JSON.stringify(next));
      } catch { /* noop */ }
      return next;
    });

    setUserXP(prev => {
      const next = prev + xpEarned;
      try {
        localStorage.setItem('flwdsk_tutorial_xp', String(next));
      } catch { /* noop */ }
      return next;
    });
  }, []);

  // Safe Demo Mode triggers
  const setDemoMode = useCallback((active: boolean) => {
    setIsDemoMode(active);
    try {
      if (active) {
        localStorage.setItem('flwdsk_safe_demo_mode', 'true');
      } else {
        localStorage.removeItem('flwdsk_safe_demo_mode');
      }
    } catch { /* noop */ }
  }, []);

  const resetDemoState = useCallback(() => {
    try {
      localStorage.removeItem('flwdsk_demo_data');
    } catch { /* noop */ }
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
        if (activeTourId) {
          setActiveTourId(null);
        } else if (activeSimulation) {
          setActiveSimulation(null);
        } else if (isOpen) {
          setIsOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeSimulation, activeTourId]);

  // Strict Role-Based & Search filtered modules
  const filteredModules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return TUTORIAL_MODULES.filter(item => {
      // 1. Mandatory Security Rule: Enforce user's actual authorized role
      if (!isModuleAllowedForUser(item.rolesAllowed, currentUserRole)) {
        return false;
      }

      // 2. Secondary preview filter (for Admin / Executive inspecting specific role view)
      if (selectedRole !== 'ALL') {
        if (!isModuleAllowedForUser(item.rolesAllowed, selectedRole)) {
          return false;
        }
      }

      // 3. Search query filter
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
    }).map(item => {
      // Also filter individual workflows within each module based on role
      return {
        ...item,
        workflows: item.workflows.filter(w => isWorkflowAllowedForUser(w.whoCanUse, currentUserRole)),
      };
    });
  }, [currentUserRole, selectedRole, searchQuery]);

  return (
    <TutorialContext.Provider
      value={{
        isOpen,
        activeModuleId,
        selectedRole,
        currentUserRole,
        allowedRoleFilters,
        searchQuery,
        activeSimulation,
        activeTourId,
        isTourActive: Boolean(activeTourId),
        isDemoMode,
        userXP,
        completedTours,
        openTutorial,
        closeTutorial,
        setActiveModuleId,
        setSelectedRole,
        setSearchQuery,
        startSimulation,
        closeSimulation,
        startTour,
        closeTour,
        completeTour,
        setDemoMode,
        resetDemoState,
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
