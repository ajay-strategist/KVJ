/**
 * KVJ Analytics — Expanded Global Command & Entity Search Provider (Phase 2 Upgrade)
 * Spec Section 14:
 *  - Categorized search covering Navigation, Students, Employees, Courses, Colleges,
 *    Trainers, Reports, Tasks, Expenses, Attendance, Batches, Projects, Files.
 *  - Opened via ⌘/Ctrl-K. Debounced, instant navigation.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCommandPalette, type CommandItem } from '../shared/search/CommandPaletteProvider';
import { visibleNav } from '../shared/navigation/navigation';
import { usePermissions } from '../shared/permissions/react';

export function CommandRegistrar() {
  const { registerProvider } = useCommandPalette();
  const { can } = usePermissions();
  const navigate = useNavigate();

  useEffect(() => {
    const nav = visibleNav(can);
    const navItems = nav.map((n) => ({ id: `nav-${n.id}`, title: n.label, subtitle: `Navigate to ${n.path}`, group: 'Navigation', run: () => navigate(n.path) }));

    // Extended Entity Index per Spec Section 14
    const entityIndex: CommandItem[] = [
      // Batches & Colleges
      { id: 'b-1', title: 'Christ 3BBA Data Analytics B1', subtitle: 'College: Christ University · Trainer: Linto George', group: 'Batches & Training', run: () => navigate('/app/training/batches') },
      { id: 'b-2', title: 'SB College MBA Batch 1', subtitle: 'College: SB College · Trainer: Ajay Kumar', group: 'Batches & Training', run: () => navigate('/app/training/batches') },
      { id: 'b-3', title: 'Vimala College Excel Expert B1', subtitle: 'College: Vimala College · Trainer: Anju V', group: 'Batches & Training', run: () => navigate('/app/training/batches') },

      // Courses
      { id: 'c-1', title: 'Power BI & Advanced Data Visualization', subtitle: 'Course Code: KVJ-PBI-101 · 60 Hours', group: 'Courses & Curriculum', run: () => navigate('/app/training/courses') },
      { id: 'c-2', title: 'Python for Data Science & Machine Learning', subtitle: 'Course Code: KVJ-PY-102 · 80 Hours', group: 'Courses & Curriculum', run: () => navigate('/app/training/courses') },
      { id: 'c-3', title: 'Advanced Excel & Financial Modeling', subtitle: 'Course Code: KVJ-EXC-103 · 40 Hours', group: 'Courses & Curriculum', run: () => navigate('/app/training/courses') },

      // Students
      { id: 's-1', title: 'Albin Joseph (Student)', subtitle: 'Christ BCOM B · Voucher: VOUCH-CHRIST-101', group: 'Students & Registry', run: () => navigate('/app/training/students') },
      { id: 's-2', title: 'Merlin K Thomas (Student)', subtitle: 'Christ BCOM B · Score: 82.5%', group: 'Students & Registry', run: () => navigate('/app/training/students') },
      { id: 's-3', title: 'Devanand P (Student)', subtitle: 'SB College MBA · Voucher: VOUCH-SB-202', group: 'Students & Registry', run: () => navigate('/app/training/students') },

      // Employees & Trainers
      { id: 'e-1', title: 'Linto George (Lead Trainer)', subtitle: 'Role: MANAGER · Dept: Operations', group: 'Employees & Staff', run: () => navigate('/app/employees') },
      { id: 'e-2', title: 'Ajay Kumar (Senior Trainer)', subtitle: 'Role: EMPLOYEE · Dept: Academic Training', group: 'Employees & Staff', run: () => navigate('/app/employees') },
      { id: 'e-3', title: 'Anju V (Trainer)', subtitle: 'Role: EMPLOYEE · Dept: Academic Training', group: 'Employees & Staff', run: () => navigate('/app/employees') },

      // Projects & Tasks
      { id: 'p-1', title: 'KVJ-PROJ-101 (Multi-Tenant Analytics)', subtitle: 'Status: In Progress · Supervisor: Manager Ops', group: 'Projects & Tasks', run: () => navigate('/app/project/tasks') },
      { id: 'p-2', title: 'Supabase Database Schema Migration', subtitle: 'Task · Due: Today · Assignee: Linto George', group: 'Projects & Tasks', run: () => navigate('/app/project/tasks') },

      // Expenses & Claims
      { id: 'exp-1', title: 'Self Travel (HQ to Christ College - 16km)', subtitle: 'Expense Claim: ₹80.00 · Status: Approved', group: 'Expenses & Finance', run: () => navigate('/app/finance/expenses') },
      { id: 'exp-2', title: 'Morning & Evening Tea Reimbursement', subtitle: 'Expense Claim: ₹150.00 · Status: Pending', group: 'Expenses & Finance', run: () => navigate('/app/finance/expenses') },

      // Reports & Files
      { id: 'rep-1', title: 'Christ BCOM Batch 1 — Daily Session Report', subtitle: 'Generated PDF Report', group: 'Reports & Files', run: () => navigate('/app/analytics/dashboard') },
      { id: 'rep-2', title: 'Monthly Staff Attendance Summary Report', subtitle: 'Analytics Report', group: 'Reports & Files', run: () => navigate('/app/analytics/dashboard') },
      { id: 'file-1', title: 'Christ_BCOM_Student_Registry.xlsx', subtitle: 'Uploaded Registry File · 24 KB', group: 'Reports & Files', run: () => navigate('/app/training/batches') },
    ];

    const allCommands = [...navItems, ...entityIndex];

    return registerProvider({
      id: 'global-search',
      query: (term): CommandItem[] => {
        if (!term.trim()) return allCommands.slice(0, 8);
        const q = term.toLowerCase();
        return allCommands.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
            item.group.toLowerCase().includes(q)
        );
      },
    });
  }, [registerProvider, can, navigate]);

  return null;
}
