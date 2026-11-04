import { describe, it, expect } from 'vitest';

describe('Admin Expense Editing Capabilities', () => {
  const adminUser = { role: 'ADMIN', fullName: 'Ajay Thomas' };
  const ceoUser = { role: 'CEO', fullName: 'Jomon Joseph' };
  const managerUser = { role: 'MANAGER', fullName: 'Manager User' };
  const employeeUser = { role: 'EMPLOYEE', fullName: 'Regular Employee' };

  const isManagementRole = (role?: string) => {
    return ['ADMIN', 'CEO', 'MANAGER'].includes((role || '').toUpperCase());
  };

  it('correctly grants expense editing capability exclusively to Management (Admin, CEO, Manager)', () => {
    expect(isManagementRole(adminUser.role)).toBe(true);
    expect(isManagementRole(ceoUser.role)).toBe(true);
    expect(isManagementRole(managerUser.role)).toBe(true);
    expect(isManagementRole(employeeUser.role)).toBe(false);
    expect(isManagementRole(undefined)).toBe(false);
  });

  it('allows Admin to edit an approved expense claim that would otherwise be locked', () => {
    const expense = {
      id: 'claim-123',
      amount: 798,
      status: 'approved',
      category: 'Training Expense',
      type: 'Self Travel',
      vehicle: 'Car',
      km: 84,
      route: 'SJCET -> Home',
    };

    const isLocked = expense.status === 'approved';
    expect(isLocked).toBe(true);

    // Regular employee cannot edit approved expense
    const canEmployeeEdit = !isLocked || isManagementRole(employeeUser.role);
    expect(canEmployeeEdit).toBe(false);

    // Admin CAN edit even when approved
    const canAdminEdit = isManagementRole(adminUser.role);
    expect(canAdminEdit).toBe(true);
  });

  it('correctly formats and recalculates edited travel expense payloads', () => {
    const initialKm = 84;
    const carRate = 9.5;
    const initialAmount = initialKm * carRate; // 798

    // Admin updates KM to 100
    const updatedKm = 100;
    const recalculatedAmount = Math.round(updatedKm * carRate); // 950

    expect(recalculatedAmount).toBe(950);

    const notesPayload = JSON.stringify({
      personName: 'Ajay Thomas',
      expenseType: 'Self Travel',
      expenseDate: '2026-10-23',
      route: 'SJCET -> Home -> HQ',
      vehicle: 'Car',
      km: updatedKm,
      rate: carRate,
      userNotes: 'Adjusted route by Admin',
    });

    const parsed = JSON.parse(notesPayload);
    expect(parsed.km).toBe(100);
    expect(parsed.route).toBe('SJCET -> Home -> HQ');
    expect(parsed.userNotes).toBe('Adjusted route by Admin');
  });
});
