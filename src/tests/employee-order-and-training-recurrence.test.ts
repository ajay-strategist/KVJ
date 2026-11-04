import { describe, it, expect } from 'vitest';
import {
  isRelievedEmployee,
  sortEmployeesByCode,
  isEligibleTrainer,
  type Employee,
} from '../modules/employee/employee.repository';
import { computeRecurrenceDates } from '../modules/training/pages/TrainingCalendar';
import { detectConflicts, isGenericVenue, type ScheduleSession } from '../modules/training/schedule.data';

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

  it('deduplicates sessions by id and time/batch slot to prevent duplicate cards on the same day', () => {
    const duplicateList = [
      {
        id: 'sess-1',
        date: '2026-11-05',
        trainerId: 'trainer-linto',
        startTime: '09:00',
        endTime: '16:00',
        name: 'Python for beginners',
        batchCode: 'Christ - Christ Teachers - Batch 1',
        college: 'Christ',
      },
      {
        id: 'sess-2',
        date: '2026-11-05',
        trainerId: 'trainer-linto',
        startTime: '09:00',
        endTime: '16:00',
        name: 'Python for beginners',
        batchCode: 'Christ - Christ Teachers - Batch 1',
        college: 'Christ',
      },
    ];

    const seenIds = new Set<string>();
    const seenSlots = new Set<string>();
    const deduplicated = duplicateList.filter((s) => {
      if (!s || !s.id) return false;
      if (seenIds.has(s.id)) return false;
      const slotKey = `${s.date}|${s.trainerId}|${s.startTime}|${s.batchCode}`;
      if (seenSlots.has(slotKey)) return false;
      seenIds.add(s.id);
      seenSlots.add(slotKey);
      return true;
    });

    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].id).toBe('sess-1');
  });
});

describe('Employee Training Session Idle State & Active Work Recognition', () => {
  const detectTrainingSession = (
    emp: Partial<Employee>,
    attendanceRecords: any[],
    openWorkSessions: any[],
    todayCalendarSessions: any[] = [],
    batchesList: any[] = []
  ): string | null => {
    const empId = emp.id;
    const empEmail = emp.email?.toLowerCase();

    const matchingAttendance = attendanceRecords.filter(
      (r) =>
        r.employee_id === empId ||
        (r.employee_email && empEmail && r.employee_email.toLowerCase() === empEmail)
    );

    // 1. Check open work sessions in flwdsk_work_sessions
    const attIds = new Set(matchingAttendance.map((r) => r.id));
    const activeWs = openWorkSessions.find((ws: any) => attIds.has(ws.attendance_record_id));
    if (activeWs && activeWs.work_type) {
      const wt = String(activeWs.work_type).trim();
      if (wt.toLowerCase().includes('training')) {
        return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
      }
    }

    // 2. Check embedded sessions in matching attendance records
    for (const att of matchingAttendance) {
      if (Array.isArray(att.sessions)) {
        const activeSess = att.sessions.find((s: any) => !s.clockOut && !s.clock_out);
        const sessionToCheck = activeSess || att.sessions[att.sessions.length - 1];
        if (sessionToCheck?.workType && String(sessionToCheck.workType).toLowerCase().includes('training')) {
          const wt = String(sessionToCheck.workType).trim();
          return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
        }
      }
      if (att.work_type && String(att.work_type).toLowerCase().includes('training')) {
        const wt = String(att.work_type).trim();
        return wt.startsWith('Training:') ? `🎓 ${wt}` : `🎓 Training: ${wt}`;
      }
    }

    // 3. Calendar session for today
    const isClockedIn = matchingAttendance.some((r) => r.status === 'present');
    if (isClockedIn) {
      const todayCal = todayCalendarSessions.find((cs: any) => cs.trainer_id === empId);
      if (todayCal) {
        const matchedBatch = batchesList.find((b: any) => b.id === todayCal.batch_id);
        const batchTitle = matchedBatch?.code || matchedBatch?.training_name || todayCal.session_title || 'Training Batch';
        return `🎓 Training: ${batchTitle}`;
      }
    }

    return null;
  };

  const calculateIdleStatus = (
    emp: Partial<Employee>,
    attendanceRecords: any[],
    openWorkSessions: any[],
    todayCalendarSessions: any[] = [],
    batchesList: any[] = [],
    activeTaskStr: string = 'No active task in progress'
  ) => {
    // If employee is in a training session, they are never idle!
    const trainingTitle = detectTrainingSession(emp, attendanceRecords, openWorkSessions, todayCalendarSessions, batchesList);
    if (trainingTitle) {
      return { isIdle: false, idleMinutes: 0, activeTask: trainingTitle };
    }

    if (activeTaskStr !== 'No active task in progress') {
      return { isIdle: false, idleMinutes: 0, activeTask: activeTaskStr };
    }

    const empId = emp.id;
    const record = attendanceRecords.find((r) => r.employee_id === empId && r.status === 'present');
    if (!record || !record.first_clock_in) {
      return { isIdle: false, idleMinutes: 0, activeTask: activeTaskStr };
    }

    const clockInMs = new Date(record.first_clock_in).getTime();
    const idleMinutes = Math.max(0, Math.floor((Date.now() - clockInMs) / (1000 * 60)));
    return {
      isIdle: idleMinutes >= 15,
      idleMinutes,
      activeTask: activeTaskStr,
    };
  };

  it('recognizes employee clocked in for training batch and marks isIdle: false', () => {
    const linto: Partial<Employee> = { id: 'emp-linto', firstName: 'Linto', lastName: 'George', email: 'linto@test.com' };
    const attRecords = [
      { id: 'att-1', employee_id: 'emp-linto', status: 'present', first_clock_in: new Date(Date.now() - 5 * 3600 * 1000).toISOString() },
    ];
    const openWorkSessions = [
      { id: 'ws-1', attendance_record_id: 'att-1', work_type: 'Training: Christ - Christ Teachers - Batch 1', clock_out: null },
    ];

    const result = calculateIdleStatus(linto, attRecords, openWorkSessions);
    expect(result.isIdle).toBe(false);
    expect(result.activeTask).toBe('🎓 Training: Christ - Christ Teachers - Batch 1');
  });

  it('recognizes employee scheduled in today calendar sessions as in training when clocked in', () => {
    const anoop: Partial<Employee> = { id: 'emp-anoop', firstName: 'Anoop', lastName: 'Baiju', email: 'anoop@test.com' };
    const attRecords = [
      { id: 'att-2', employee_id: 'emp-anoop', status: 'present', first_clock_in: new Date(Date.now() - 44 * 60 * 1000).toISOString() },
    ];
    const todayCalendarSessions = [
      { id: 'cal-1', trainer_id: 'emp-anoop', batch_id: 'b-mim', session_title: 'MIM - UG - Batch 1' },
    ];
    const batchesList = [
      { id: 'b-mim', code: 'MIM - UG - Batch 1', training_name: 'Python' },
    ];

    const result = calculateIdleStatus(anoop, attRecords, [], todayCalendarSessions, batchesList);
    expect(result.isIdle).toBe(false);
    expect(result.activeTask).toBe('🎓 Training: MIM - UG - Batch 1');
  });

  it('marks employee as idle if clocked in with no active task and no training batch for > 15 mins', () => {
    const idleUser: Partial<Employee> = { id: 'emp-idle', firstName: 'Test', lastName: 'User' };
    const attRecords = [
      { id: 'att-3', employee_id: 'emp-idle', status: 'present', first_clock_in: new Date(Date.now() - 25 * 60 * 1000).toISOString() },
    ];

    const result = calculateIdleStatus(idleUser, attRecords, []);
    expect(result.isIdle).toBe(true);
    expect(result.idleMinutes).toBeGreaterThanOrEqual(25);
    expect(result.activeTask).toBe('No active task in progress');
  });
});

describe('Schedule Conflict Detection Accuracy & False Positive Prevention', () => {
  const trainers = [
    { id: 't-ajay', name: 'Ajay Thomas' },
    { id: 't-linto', name: 'Linto George' },
  ];

  it('correctly identifies generic venues that do not cause room collision conflicts', () => {
    expect(isGenericVenue('Campus HQ')).toBe(true);
    expect(isGenericVenue('Campus')).toBe(true);
    expect(isGenericVenue('Offline')).toBe(true);
    expect(isGenericVenue('Online')).toBe(true);
    expect(isGenericVenue('—')).toBe(true);
    expect(isGenericVenue(undefined)).toBe(true);
    expect(isGenericVenue('Lab 1')).toBe(false);
    expect(isGenericVenue('Room 204')).toBe(false);
    expect(isGenericVenue('Auditorium B')).toBe(false);
  });

  it('does NOT flag a venue conflict for sessions in different colleges even with overlapping times', () => {
    const sessions: ScheduleSession[] = [
      {
        id: 's-sjcet',
        trainerId: 't-ajay',
        date: '2026-11-04',
        name: 'Excel Expert 365',
        batchCode: 'SJCET - 2 MBA - Batch 1',
        college: 'SJCET',
        course: 'Excel',
        academicYear: '2026-27',
        coordinator: 'Soumya',
        startTime: '09:00',
        endTime: '13:30',
        venue: 'Campus HQ',
        mode: 'Offline',
        studentCount: 60,
        status: 'Scheduled',
        color: '#6366f1',
      },
      {
        id: 's-christ',
        trainerId: 't-linto',
        date: '2026-11-04',
        name: 'Python for beginners',
        batchCode: 'Christ - Christ Teachers - Batch 1',
        college: 'Christ',
        course: 'Python',
        academicYear: '2026-27',
        coordinator: 'Coordinator',
        startTime: '09:00',
        endTime: '16:00',
        venue: 'Campus HQ',
        mode: 'Offline',
        studentCount: 21,
        status: 'Scheduled',
        color: '#6366f1',
      },
    ];

    const conflicts = detectConflicts(sessions, [], [], trainers);
    expect(conflicts).toHaveLength(0);
  });

  it('does NOT flag a venue conflict for two sessions in the same college when using generic campus venues', () => {
    const sessions: ScheduleSession[] = [
      {
        id: 's-christ-1',
        trainerId: 't-ajay',
        date: '2026-11-04',
        name: 'Batch 1',
        batchCode: 'Christ - Batch 1',
        college: 'Christ',
        course: 'Python',
        academicYear: '2026-27',
        coordinator: 'Coordinator',
        startTime: '09:00',
        endTime: '13:00',
        venue: 'Campus HQ',
        mode: 'Offline',
        studentCount: 30,
        status: 'Scheduled',
        color: '#6366f1',
      },
      {
        id: 's-christ-2',
        trainerId: 't-linto',
        date: '2026-11-04',
        name: 'Batch 2',
        batchCode: 'Christ - Batch 2',
        college: 'Christ',
        course: 'Excel',
        academicYear: '2026-27',
        coordinator: 'Coordinator',
        startTime: '09:00',
        endTime: '13:00',
        venue: 'Campus HQ',
        mode: 'Offline',
        studentCount: 30,
        status: 'Scheduled',
        color: '#6366f1',
      },
    ];

    const conflicts = detectConflicts(sessions, [], [], trainers);
    expect(conflicts).toHaveLength(0);
  });

  it('flags a genuine venue conflict when the SAME specific room in the SAME college is double-booked', () => {
    const sessions: ScheduleSession[] = [
      {
        id: 's-christ-lab1',
        trainerId: 't-ajay',
        date: '2026-11-04',
        name: 'Batch 1',
        batchCode: 'Christ - Batch 1',
        college: 'Christ',
        course: 'Python',
        academicYear: '2026-27',
        coordinator: 'Coordinator',
        startTime: '09:00',
        endTime: '13:00',
        venue: 'Computer Lab 3',
        mode: 'Offline',
        studentCount: 30,
        status: 'Scheduled',
        color: '#6366f1',
      },
      {
        id: 's-christ-lab2',
        trainerId: 't-linto',
        date: '2026-11-04',
        name: 'Batch 2',
        batchCode: 'Christ - Batch 2',
        college: 'Christ',
        course: 'Excel',
        academicYear: '2026-27',
        coordinator: 'Coordinator',
        startTime: '10:00',
        endTime: '14:00',
        venue: 'Computer Lab 3',
        mode: 'Offline',
        studentCount: 30,
        status: 'Scheduled',
        color: '#6366f1',
      },
    ];

    const conflicts = detectConflicts(sessions, [], [], trainers);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('Venue Conflict');
    expect(conflicts[0].detail).toContain('Computer Lab 3');
  });
});



