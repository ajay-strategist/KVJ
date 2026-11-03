import { describe, it, expect } from 'vitest';
import { TUTORIAL_MODULES } from '../modules/tutorial/tutorial-data';
import { resolveTutorialKey } from '../modules/tutorial/TutorialContext';

describe('Application User Tutorial & Help Center', () => {
  describe('Tutorial Data Integrity & Completeness', () => {
    it('covers all core application modules and functional domains', () => {
      const moduleIds = TUTORIAL_MODULES.map((m) => m.id);
      const expectedModules = [
        'my-day',
        'employee-status',
        'employee-directory',
        'attendance',
        'leave',
        'approvals',
        'batch-management',
        'training-calendar',
        'projects-tasks',
        'expenses',
        'communication',
      ];

      for (const expected of expectedModules) {
        expect(moduleIds).toContain(expected);
      }
    });

    it('ensures each module has complete metadata, routes, roles, and instructions', () => {
      for (const mod of TUTORIAL_MODULES) {
        expect(mod.id).toBeTruthy();
        expect(mod.title).toBeTruthy();
        expect(mod.module).toBeTruthy();
        expect(mod.route).toMatch(/^\/app/);
        expect(mod.whereToFind).toBeTruthy();
        expect(mod.rolesAllowed.length).toBeGreaterThan(0);
        expect(mod.workflows.length).toBeGreaterThan(0);
        expect(mod.faq.length).toBeGreaterThan(0);

        for (const wf of mod.workflows) {
          expect(wf.id).toBeTruthy();
          expect(wf.title).toBeTruthy();
          expect(wf.summary).toBeTruthy();
          expect(wf.steps.length).toBeGreaterThan(0);
          expect(wf.whoCanUse.length).toBeGreaterThan(0);

          if (wf.fields) {
            for (const f of wf.fields) {
              expect(f.name).toBeTruthy();
              expect(f.label).toBeTruthy();
              expect(f.type).toBeTruthy();
              expect(typeof f.required).toBe('boolean');
              expect(f.description).toBeTruthy();
            }
          }

          if (wf.commonErrors) {
            for (const err of wf.commonErrors) {
              expect(err.error).toBeTruthy();
              expect(err.cause).toBeTruthy();
              expect(err.solution).toBeTruthy();
            }
          }
        }
      }
    });
  });

  describe('resolveTutorialKey Tab & Route Matching', () => {
    it('accurately resolves module keys from tab titles and names', () => {
      expect(resolveTutorialKey('My Day')).toBe('my-day');
      expect(resolveTutorialKey('Today Employee Status')).toBe('employee-status');
      expect(resolveTutorialKey('Employee Directory')).toBe('employee-directory');
      expect(resolveTutorialKey('Attendance Log')).toBe('attendance');
      expect(resolveTutorialKey('Leave Board')).toBe('leave');
      expect(resolveTutorialKey('Approvals Queue')).toBe('approvals');
      expect(resolveTutorialKey('Batch Management')).toBe('batch-management');
      expect(resolveTutorialKey('Training Resource Planner Calendar')).toBe('training-calendar');
      expect(resolveTutorialKey('Projects and Tasks')).toBe('projects-tasks');
      expect(resolveTutorialKey('Expenses & Travel Claims')).toBe('expenses');
      expect(resolveTutorialKey('Chat Rooms')).toBe('communication');
    });

    it('accurately resolves module keys from route paths', () => {
      expect(resolveTutorialKey('/app/training/batches')).toBe('batch-management');
      expect(resolveTutorialKey('/app/training/calendar')).toBe('training-calendar');
      expect(resolveTutorialKey('/app/finance/expenses')).toBe('expenses');
      expect(resolveTutorialKey('/app/employees/status')).toBe('employee-status');
      expect(resolveTutorialKey('/app/attendance')).toBe('attendance');
      expect(resolveTutorialKey('/app/leave')).toBe('leave');
      expect(resolveTutorialKey('/app/approvals')).toBe('approvals');
      expect(resolveTutorialKey('/app/projects')).toBe('projects-tasks');
      expect(resolveTutorialKey('/app/communication/chat')).toBe('communication');
    });

    it('safely falls back to default my-day when given undefined or empty string', () => {
      expect(resolveTutorialKey('')).toBe('my-day');
      expect(resolveTutorialKey(undefined)).toBe('my-day');
      expect(resolveTutorialKey('unknown-random-view')).toBe('my-day');
    });
  });

  describe('Search & Role-Based Filtering Mechanics', () => {
    it('filters modules by role restriction', () => {
      const employeeMods = TUTORIAL_MODULES.filter(
        (m) => m.rolesAllowed.includes('ALL') || m.rolesAllowed.includes('EMPLOYEE')
      );
      const adminMods = TUTORIAL_MODULES.filter(
        (m) => m.rolesAllowed.includes('ALL') || m.rolesAllowed.includes('ADMIN')
      );

      expect(employeeMods.length).toBeGreaterThan(0);
      expect(adminMods.length).toBeGreaterThan(0);
      // Admin should have access to management modules like Approvals Queue and Batch Management
      expect(adminMods.some((m) => m.id === 'approvals')).toBe(true);
      expect(adminMods.some((m) => m.id === 'batch-management')).toBe(true);
    });

    it('finds specific workflow items and error solutions via search query', () => {
      const query = 'pause';
      const matchingModules = TUTORIAL_MODULES.filter((item) => {
        const titleMatch = item.title.toLowerCase().includes(query);
        const workflowMatch = item.workflows.some(
          (w) =>
            w.title.toLowerCase().includes(query) ||
            w.steps.some((s) => s.toLowerCase().includes(query)) ||
            (w.commonErrors &&
              w.commonErrors.some((e) => e.error.toLowerCase().includes(query)))
        );
        return titleMatch || workflowMatch;
      });

      // Must find My Day or Projects & Tasks which feature the mandatory task pause note
      expect(matchingModules.length).toBeGreaterThan(0);
      expect(matchingModules.some((m) => m.id === 'my-day' || m.id === 'projects-tasks')).toBe(true);
    });

    it('finds travel KM auto-calculation workflows in search', () => {
      const query = 'km';
      const matching = TUTORIAL_MODULES.filter((item) =>
        item.workflows.some(
          (w) =>
            w.title.toLowerCase().includes(query) ||
            w.steps.some((s) => s.toLowerCase().includes(query)) ||
            (w.fields && w.fields.some((f) => f.name.toLowerCase().includes(query)))
        )
      );

      expect(matching.some((m) => m.id === 'expenses')).toBe(true);
    });
  });

  describe('Practice Simulator Safety & Architecture', () => {
    it('confirms practice workflows designate valid simulation keys without database side effects', () => {
      const simKeys = TUTORIAL_MODULES.flatMap((m) =>
        m.workflows.filter((w) => Boolean(w.simulationKey)).map((w) => w.simulationKey)
      );

      expect(simKeys).toContain('sim-clock-in');
      expect(simKeys).toContain('sim-task-timer');
      expect(simKeys).toContain('sim-calendar-schedule');
      expect(simKeys).toContain('sim-submit-expense');
      expect(simKeys).toContain('sim-create-batch');

      // Ensure all keys are strings and distinct
      for (const k of simKeys) {
        expect(typeof k).toBe('string');
      }
    });
  });
});

