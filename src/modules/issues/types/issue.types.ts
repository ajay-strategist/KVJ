/**
 * KVJ Analytics — Issue / Helpdesk Types
 */

export type IssueCategory =
  | 'Software & System Bug'
  | 'Attendance & Biometrics'
  | 'Leave & Holidays'
  | 'Expenses & Travel'
  | 'Training & Batches'
  | 'Projects & Tasks'
  | 'Hardware & Facility'
  | 'General Support';

export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';

export type IssueStatus = 'open' | 'in_progress' | 'under_review' | 'resolved' | 'closed';

export interface IssueComment {
  id: string;
  authorName: string;
  authorRole: string;
  authorAvatar?: string;
  text: string;
  createdAt: string;
}

export interface IssueTicket {
  id: string; // e.g. "ISS-1001"
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  module?: string;
  description: string;
  reportedBy: {
    id: string;
    name: string;
    email: string;
    role: string;
    avatarUrl?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    role: string;
  };
  resolutionNotes?: string;
  resolvedAt?: string;
  comments?: IssueComment[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateIssueInput {
  title: string;
  category: IssueCategory;
  priority: IssuePriority;
  module?: string;
  description: string;
}
