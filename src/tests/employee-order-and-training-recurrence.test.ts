import { describe, it, expect } from 'vitest';
import {
  isRelievedEmployee,
  sortEmployeesByCode,
  isEligibleTrainer,
  type Employee,
} from '../modules/employee/employee.repository';
import { computeRecurrenceDates } from '../modules/training/pages/TrainingCalendar';

describe('Employee Ordering and Relieved Employee Exclusion', () => {
  const mockEmployees: Partial<Employee>[] = [
    { id: '1', employeeId: 'EMP-631', firstName: 'Ebin', lastName: 'Louis', designation: 'Developer', status: 'active' },
    { id: '2', employeeId: 'EMP-708', firstName: 'Anjitha', lastName: 'P V', designation: 'Data Analyst Intern', status: 'relieved' },
    { id: '3', employeeId: 'EMP-001', firstName: 'Jomon', lastName: 'Joseph', designation: 'CEO', status: 'active' },
    { id: '4', employeeId: 'EMP-004', firstName: 'Anoop', lastName: 'Baiju', designation: 'Data Analyst', status: 'active' },
    { id: '5', employeeId: 'EMP-002', firstName: 'Ajay', lastName: 'Thomas', designation: 'Admin', status: 'active' },
    { id: '6', employeeId: 'EMP-524', firstName: 'Geetha', lastName: '.', designation: 'Cleaning Staff', status: 'active' },
    { id: '7', employeeId: 'EMP-401', firstName: 'Freddy', lastName: 'Thomas', designation: 'Data Analyst', status: 'active' },
    { id: '8', employeeId: 'EMP-003', firstName: 'Linto', lastName: 'George', designation: 'Data Analyst', status: 'active' },
  ];

  it('correctly identifies relieved / terminated / resigned employees', () => {
    expect(isRelievedEmployee('relieved')).toBe(true);
    expect(isRelievedEmployee('terminated')).toBe(true);
    expect(isRelievedEmployee('resigned')).toBe(true);
    expect(isRelievedEmployee('active')).toBe(false);
    expect(isRelievedEmployee('on_notice')).toBe(false);
    expect(isRelievedEmployee(undefined)).toBe(false);
  });

  it('sorts employees naturally by numeric EMP code', () => {
    const sorted = sortEmployeesByCode(mockEmployees as Employee[]);
    const codes = sorted.map((e) => e.employeeId);
    expect(codes).toEqual([
      'EMP-001',
      'EMP-002',
      'EMP-003',
      'EMP-004',
      'EMP-401',
      'EMP-524',
      'EMP-631',
      'EMP-708',
    ]);
  });

  it('filters out relieved employees and cleaning staff for eligible trainers', () => {
    const eligible = (mockEmployees as Employee[]).filter(isEligibleTrainer);
    const sortedEligible = sortEmployeesByCode(eligible);
    const names = sortedEligible.map((e) => `${e.firstName} ${e.lastName}`);
    expect(names).toEqual([
      'Jomon Joseph',
      'Ajay Thomas',
      'Linto George',
      'Anoop Baiju',
      'Freddy Thomas',
      'Ebin Louis',
    ]);
    expect(names).not.toContain('Anjitha P V');
    expect(names).not.toContain('Geetha .');
  });
});

describe('Training Recurrence and Multi-Day Calculations', () => {
  it('returns single date for non-repeating sessions', () => {
    const dates = computeRecurrenceDates({
      mode: 'none',
      startDate: '2026-11-03',
    });
    expect(dates).toEqual(['2026-11-03']);
  });

  it('generates consecutive days skipping Sundays', () => {
    // 2026-11-06 is Friday, Nov 7 is Sat, Nov 8 is Sun, Nov 9 is Mon
    const dates = computeRecurrenceDates({
      mode: 'consecutive',
      startDate: '2026-11-06',
      consecutiveDays: 3,
      skipSundays: true,
      skipSaturdays: false,
    });
    expect(dates).toEqual(['2026-11-06', '2026-11-07', '2026-11-09']);
  });

  it('generates dates within date range skipping Sundays and configured holidays', () => {
    const holidays = new Set(['2026-11-04']); // Wednesday is holiday
    const dates = computeRecurrenceDates({
      mode: 'range',
      startDate: '2026-11-03', // Tue
      endDate: '2026-11-06',   // Fri
      skipSundays: true,
      skipHolidays: true,
      holidayDates: holidays,
    });
    // 2026-11-03 (Tue), 2026-11-04 (Holiday skipped), 2026-11-05 (Thu), 2026-11-06 (Fri)
    expect(dates).toEqual(['2026-11-03', '2026-11-05', '2026-11-06']);
  });
});
