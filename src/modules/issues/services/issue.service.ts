/**
 * KVJ Analytics — Issue Service & Repository
 * Layer: Application Service. Manages tickets with local persistence,
 * reactive subscription listeners, and Supabase backup.
 */

import type { IssueTicket, CreateIssueInput, IssueStatus, IssuePriority, IssueCategory } from '../types/issue.types';
import { supabase } from '../../../shared/integration/supabase';

const STORAGE_KEY = 'kvj.issues.records';

const SEED_ISSUES: IssueTicket[] = [
  {
    id: 'ISS-1001',
    title: 'Biometric punch sync delay on morning shift',
    category: 'Attendance & Biometrics',
    priority: 'high',
    status: 'in_progress',
    module: 'Attendance',
    description: 'The front biometric gate 2 is recording check-in punches with a 25-minute delay in the Attendance Log tab.',
    reportedBy: {
      id: 'emp-1',
      name: 'Priya Nair',
      email: 'priya.nair@kvjanalytics.com',
      role: 'TRAINER',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    assignedTo: {
      id: 'u-admin',
      name: 'System Admin',
      role: 'ADMIN',
    },
    resolutionNotes: 'Hardware team has reset the LAN relay for gate 2; running test sync cycles now.',
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ISS-1002',
    title: 'HDMI projector flickering in Training Lab 2',
    category: 'Hardware & Facility',
    priority: 'urgent',
    status: 'open',
    module: 'Training',
    description: 'During batch B-03 data engineering sessions, the display cable drops signal every 10 minutes. A replacement cable or port inspection is requested.',
    reportedBy: {
      id: 'emp-2',
      name: 'Rahul Menon',
      email: 'rahul.menon@kvjanalytics.com',
      role: 'TRAINER',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    },
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ISS-1003',
    title: 'Expense receipt PDF upload size limit error',
    category: 'Expenses & Travel',
    priority: 'medium',
    status: 'resolved',
    module: 'Finance',
    description: 'Unable to upload hotel invoices above 2MB in Expenses & Travel module. Received generic network error.',
    reportedBy: {
      id: 'emp-1',
      name: 'Priya Nair',
      email: 'priya.nair@kvjanalytics.com',
      role: 'TRAINER',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    },
    assignedTo: {
      id: 'u-admin',
      name: 'System Admin',
      role: 'ADMIN',
    },
    resolutionNotes: 'Client-side compression added and payload ceiling raised to 10MB in expense attachments handler.',
    resolvedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ISS-1004',
    title: 'Missing assessment vouchers in Batch Management',
    category: 'Training & Batches',
    priority: 'medium',
    status: 'open',
    module: 'Training',
    description: 'The final certification voucher IDs for 12 students in Data Analyst Batch 04 are displaying as "Unassigned".',
    reportedBy: {
      id: 'u-coord-thomas',
      name: 'Thomas Kurian',
      email: 'thomas.kurian@kvjanalytics.com',
      role: 'MANAGER',
    },
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'ISS-1005',
    title: 'Update designation in employee profile card',
    category: 'General Support',
    priority: 'low',
    status: 'resolved',
    description: 'Please reflect recent promotion from Junior Trainer to Senior Data Trainer on my public directory profile.',
    reportedBy: {
      id: 'emp-2',
      name: 'Rahul Menon',
      email: 'rahul.menon@kvjanalytics.com',
      role: 'TRAINER',
    },
    assignedTo: {
      id: 'u-admin',
      name: 'System Admin',
      role: 'ADMIN',
    },
    resolutionNotes: 'HR records and system designation updated to Senior Data Trainer.',
    resolvedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 96 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 72 * 3600 * 1000).toISOString(),
  },
];

class IssueService {
  private issues: IssueTicket[] = [];
  private listeners: Set<() => void> = new Set();
  private initialized = false;

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.issues = parsed;
          this.initialized = true;
          return;
        }
      }
    } catch {
      // Fallback to seed
    }
    this.issues = [...SEED_ISSUES];
    this.save();
    this.initialized = true;
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.issues));
    } catch {
      // Storage error safeguard
    }
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getIssues(): IssueTicket[] {
    if (!this.initialized) this.load();
    return [...this.issues];
  }

  public getIssueById(id: string): IssueTicket | undefined {
    return this.issues.find((i) => i.id === id);
  }

  public createIssue(
    input: CreateIssueInput,
    user: { id: string; fullName: string; email: string; role: string; avatarUrl?: string }
  ): IssueTicket {
    const nextNumber = 1000 + this.issues.length + 1;
    const newTicket: IssueTicket = {
      id: `ISS-${nextNumber}`,
      title: input.title.trim(),
      category: input.category,
      priority: input.priority,
      status: 'open',
      module: input.module || undefined,
      description: input.description.trim(),
      reportedBy: {
        id: user.id || 'usr-current',
        name: user.fullName || 'Anonymous User',
        email: user.email || '',
        role: user.role || 'EMPLOYEE',
        avatarUrl: user.avatarUrl,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.issues.unshift(newTicket);
    this.save();

    // Async attempt to record in Supabase (if table exists)
    try {
      supabase.from('flwdsk_issues').insert({
        ticket_code: newTicket.id,
        title: newTicket.title,
        category: newTicket.category,
        priority: newTicket.priority,
        status: newTicket.status,
        description: newTicket.description,
        module: newTicket.module,
        user_id: user.id,
        created_at: newTicket.createdAt,
      }).then(() => {}).catch(() => {});
    } catch {
      // Ignore background persistence errors
    }

    return newTicket;
  }

  public updateIssueStatus(
    id: string,
    status: IssueStatus,
    resolutionNotes?: string,
    resolverName?: string
  ): IssueTicket | null {
    const index = this.issues.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const existing = this.issues[index];
    const isNowResolved = status === 'resolved' || status === 'closed';

    const updated: IssueTicket = {
      ...existing,
      status,
      resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing.resolutionNotes,
      resolvedAt: isNowResolved ? (existing.resolvedAt || new Date().toISOString()) : undefined,
      updatedAt: new Date().toISOString(),
      assignedTo: resolverName ? {
        id: 'u-resolver',
        name: resolverName,
        role: 'ADMIN',
      } : existing.assignedTo,
    };

    this.issues[index] = updated;
    this.save();
    return updated;
  }

  public deleteIssue(id: string): boolean {
    const index = this.issues.findIndex((i) => i.id === id);
    if (index === -1) return false;
    this.issues.splice(index, 1);
    this.save();
    return true;
  }
}

export const issueService = new IssueService();
