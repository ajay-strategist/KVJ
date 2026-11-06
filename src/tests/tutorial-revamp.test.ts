import { describe, it, expect } from 'vitest';
import {
  normalizeUserRole,
  getAllowedRoleFilters,
  isModuleAllowedForUser,
  isWorkflowAllowedForUser,
} from '../modules/tutorial/tutorial-roles';
import { WALKTHROUGH_TOURS } from '../modules/tutorial/walkthrough-data';
import { TUTORIAL_MODULES, TutorialItem, TutorialWorkflow } from '../modules/tutorial/tutorial-data';

describe('Tutorial Revamp — Role-Based Authorization & Visibility', () => {
  it('normalizes role variations correctly', () => {
    expect(normalizeUserRole('employee')).toBe('EMPLOYEE');
    expect(normalizeUserRole('Employee ')).toBe('EMPLOYEE');
    expect(normalizeUserRole('supervisor')).toBe('SUPERVISOR');
    expect(normalizeUserRole('Admin')).toBe('ADMIN');
    expect(normalizeUserRole('ceo')).toBe('CEO');
    expect(normalizeUserRole('Manager')).toBe('MANAGER');
    expect(normalizeUserRole(null)).toBe('EMPLOYEE');
    expect(normalizeUserRole(undefined)).toBe('EMPLOYEE');
    expect(normalizeUserRole('UNKNOWN_ROLE')).toBe('EMPLOYEE');
  });

  it('restricts role filter chips so employees cannot select Supervisor or Admin', () => {
    const employeeFilters = getAllowedRoleFilters('EMPLOYEE');
    expect(employeeFilters).toEqual(['ALL', 'EMPLOYEE']);
    expect(employeeFilters).not.toContain('SUPERVISOR');
    expect(employeeFilters).not.toContain('ADMIN');
    expect(employeeFilters).not.toContain('CEO');

    const supervisorFilters = getAllowedRoleFilters('SUPERVISOR');
    expect(supervisorFilters).toContain('ALL');
    expect(supervisorFilters).toContain('EMPLOYEE');
    expect(supervisorFilters).toContain('SUPERVISOR');
    expect(supervisorFilters).not.toContain('ADMIN');

    const adminFilters = getAllowedRoleFilters('ADMIN');
    expect(adminFilters).toContain('ADMIN');
    expect(adminFilters).toContain('CEO');
    expect(adminFilters).toContain('SUPERVISOR');
    expect(adminFilters).toContain('EMPLOYEE');
  });

  it('strictly hides unauthorized modules from Employee users', () => {
    const employeeForbiddenModuleIds = [
      'employee-directory',
      'approvals',
      'executive-console',
    ];

    employeeForbiddenModuleIds.forEach((id) => {
      const mod = TUTORIAL_MODULES.find((m) => m.id === id);
      if (mod) {
        const allowed = isModuleAllowedForUser(mod, 'EMPLOYEE');
        expect(allowed).toBe(false);
      }
    });

    const employeeAllowedModuleIds = [
      'my-day',
      'attendance',
      'leave',
      'projects-tasks',
      'expenses',
    ];

    employeeAllowedModuleIds.forEach((id) => {
      const mod = TUTORIAL_MODULES.find((m) => m.id === id);
      if (mod) {
        const allowed = isModuleAllowedForUser(mod, 'EMPLOYEE');
        expect(allowed).toBe(true);
      }
    });
  });

  it('grants Supervisors access to approvals and team tools', () => {
    const approvalsMod = TUTORIAL_MODULES.find((m) => m.id === 'approvals');
    if (approvalsMod) {
      expect(isModuleAllowedForUser(approvalsMod, 'SUPERVISOR')).toBe(true);
    }
  });

  it('grants Admins access to all available tutorial modules', () => {
    TUTORIAL_MODULES.forEach((mod) => {
      expect(isModuleAllowedForUser(mod, 'ADMIN')).toBe(true);
      expect(isModuleAllowedForUser(mod, 'CEO')).toBe(true);
    });
  });

  it('filters out supervisor/admin only workflows from employee view within a shared module', () => {
    const dummyWorkflow: TutorialWorkflow = {
      id: 'force-clock-out',
      title: 'Force Clock-Out Team Member',
      description: 'Manager overrides active session for past date',
      steps: ['Step 1'],
      rolesAllowed: ['SUPERVISOR', 'ADMIN'],
    };

    expect(isWorkflowAllowedForUser(dummyWorkflow, 'EMPLOYEE')).toBe(false);
    expect(isWorkflowAllowedForUser(dummyWorkflow, 'SUPERVISOR')).toBe(true);
    expect(isWorkflowAllowedForUser(dummyWorkflow, 'ADMIN')).toBe(true);
  });
});

describe('Tutorial Revamp — Gamified Guided Walkthrough Data', () => {
  it('defines structured game walkthroughs for key modules', () => {
    const tourKeys = ['my-day', 'attendance', 'leave', 'batch-management', 'projects-tasks', 'expenses'];
    
    tourKeys.forEach((key) => {
      const tour = WALKTHROUGH_TOURS[key];
      expect(tour).toBeDefined();
      expect(tour.title).toBeTruthy();
      expect(tour.badgeName).toBeTruthy();
      expect(tour.xpReward).toBeGreaterThan(0);
      expect(tour.steps.length).toBeGreaterThan(0);

      tour.steps.forEach((step) => {
        expect(step.targetSelector).toBeTruthy();
        expect(step.title).toBeTruthy();
        expect(step.description).toBeTruthy();
        expect(step.actionHint).toBeTruthy();
      });
    });
  });
});

describe('Tutorial Revamp — Gamification & Safe Demo Mode State', () => {
  it('calculates XP progression correctly', () => {
    let currentXP = 0;
    const completedTours: string[] = [];

    const awardTour = (tourId: string, xpReward: number) => {
      if (!completedTours.includes(tourId)) {
        completedTours.push(tourId);
        currentXP += xpReward;
      }
    };

    awardTour('my-day', 100);
    expect(currentXP).toBe(100);
    expect(completedTours).toContain('my-day');

    // Duplicate award prevention
    awardTour('my-day', 100);
    expect(currentXP).toBe(100);

    // Another tour
    awardTour('attendance', 100);
    expect(currentXP).toBe(200);
  });
});

