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
  employees: (_n?: number): MockEmployee[] => [],

  projects: (_n?: number): MockProject[] => [],

  students: (_n?: number): MockStudent[] => [],

  tasks: (_n?: number): MockTask[] => [],

  activity: (_n?: number): MockActivity[] => [],

  calendar: (_n?: number): MockCalendarEvent[] => [],

  series: (labels: string[]): MockChartPoint[] => labels.map((label) => ({ label, value: 0 })),
};
