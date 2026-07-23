/**
 * KVJ Analytics — Mock data engine (Phase-1 §9)
 * Layer: Shared. Reusable factories generate dummy datasets so the whole UI is
 * demonstrable with NO backend. Components read from here — never hardcode data.
 * In Phase 2 these are replaced by real services behind the same shapes.
 *
 * NOTE: purely presentational sample data. No business logic or real records.
 */

let seed = 42;
/** Deterministic pseudo-random so demos are stable across reloads. */
function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const id = (p: string, i: number) => `${p}-${String(i).padStart(3, '0')}`;

const FIRST = ['Aarav', 'Meera', 'Sara', 'Karthik', 'Anita', 'Rahul', 'Priya', 'Vikram', 'Divya', 'Arjun', 'Nisha', 'Rohan'];
const LAST = ['Nair', 'Menon', 'Pillai', 'Iyer', 'Rao', 'Sharma', 'Kapoor', 'Reddy', 'Bose', 'Gupta'];
const name = () => `${pick(FIRST)} ${pick(LAST)}`;

export interface MockEmployee { id: string; name: string; role: string; department: string; status: string; attendancePct: number }
export interface MockProject { id: string; name: string; client: string; status: string; progress: number; health: 'On Track' | 'Needs Attention' | 'At Risk' }
export interface MockStudent { id: string; name: string; college: string; batch: string; attendancePct: number; eligibility: 'Eligible' | 'Pending' | 'Not Eligible' }
export interface MockTask { id: string; title: string; project: string; priority: 'Critical' | 'High' | 'Medium' | 'Low'; status: string; due: string }
export interface MockActivity { id: string; actor: string; action: string; time: string }
export interface MockCalendarEvent { id: string; title: string; date: string; type: 'training' | 'meeting' | 'leave' | 'holiday' }
export interface MockChartPoint { label: string; value: number }

export const mock = {
  employees: (): MockEmployee[] => [
    {
      id: 'u-admin',
      name: 'System Admin',
      role: 'Super Administrator',
      department: 'Management',
      status: 'Present',
      attendancePct: 100,
    },
  ],

  projects: (n = 6): MockProject[] => Array.from({ length: n }, (_, i) => ({
    id: id('prj', i + 1), name: `${pick(['Corporate', 'College', 'Internal', 'Marketing'])} ${pick(['Power BI', 'Python', 'SQL', 'Excel'])} Program`,
    client: pick(['Acme Corp', 'NIT Calicut', 'TCS', 'Infosys', 'Internal']),
    status: pick(['In Progress', 'Planning', 'On Hold', 'Completed']),
    progress: int(10, 100), health: pick(['On Track', 'Needs Attention', 'At Risk']),
  })),

  students: (n = 10): MockStudent[] => Array.from({ length: n }, (_, i) => ({
    id: id('std', i + 1), name: name(), college: pick(['NIT Calicut', 'CUSAT', 'Amrita', 'MEC']),
    batch: `B-${int(1, 6)}`, attendancePct: int(55, 100), eligibility: pick(['Eligible', 'Pending', 'Not Eligible']),
  })),

  tasks: (n = 6): MockTask[] => Array.from({ length: n }, (_, i) => ({
    id: id('tsk', i + 1), title: pick(['Prepare session deck', 'Review assessments', 'Client follow-up', 'Update tracker', 'Draft report', 'Mark attendance']),
    project: pick(['Power BI Program', 'Python Batch', 'SQL Corporate']),
    priority: pick(['Critical', 'High', 'Medium', 'Low']), status: pick(['To Do', 'In Progress', 'In Review', 'Done']),
    due: `${int(18, 30)} Jul`,
  })),

  activity: (n = 6): MockActivity[] => Array.from({ length: n }, (_, i) => ({
    id: id('act', i + 1), actor: name(),
    action: pick(['completed a task', 'submitted an expense', 'marked attendance', 'created a project', 'approved a leave', 'started a session']),
    time: `${int(1, 59)}m ago`,
  })),

  calendar: (n = 5): MockCalendarEvent[] => Array.from({ length: n }, (_, i) => ({
    id: id('cal', i + 1), title: pick(['Power BI Session', 'Team Standup', 'Client Review', 'Public Holiday', 'Assessment Day']),
    date: `${int(18, 31)} Jul`, type: pick(['training', 'meeting', 'leave', 'holiday'] as const),
  })),

  series: (labels: string[]): MockChartPoint[] => labels.map((label) => ({ label, value: int(20, 100) })),
};
