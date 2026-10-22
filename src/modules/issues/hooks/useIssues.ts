/**
 * KVJ Analytics — useIssues Hook
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { issueService } from '../services/issue.service';
import type { IssueTicket, CreateIssueInput, IssueStatus } from '../types/issue.types';
import { useAuth } from '../../auth/AuthProvider';

export function useIssues() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<IssueTicket[]>(() => issueService.getIssues());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Initial fetch
    setIssues(issueService.getIssues());

    // Subscribe to reactive updates
    const unsubscribe = issueService.subscribe(() => {
      setIssues(issueService.getIssues());
    });

    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const total = issues.length;
    const open = issues.filter((i) => i.status === 'open').length;
    const inProgress = issues.filter((i) => i.status === 'in_progress' || i.status === 'under_review').length;
    const resolved = issues.filter((i) => i.status === 'resolved' || i.status === 'closed').length;
    const urgent = issues.filter((i) => i.priority === 'urgent' && i.status !== 'resolved' && i.status !== 'closed').length;

    return { total, open, inProgress, resolved, urgent };
  }, [issues]);

  const createIssue = useCallback(
    (input: CreateIssueInput) => {
      if (!user) {
        throw new Error('You must be logged in to report an issue.');
      }
      return issueService.createIssue(input, {
        id: user.id || 'usr-default',
        fullName: user.fullName || 'User',
        email: user.email || '',
        role: user.role || 'EMPLOYEE',
        avatarUrl: user.avatarUrl,
      });
    },
    [user]
  );

  const updateStatus = useCallback(
    (id: string, status: IssueStatus, resolutionNotes?: string) => {
      return issueService.updateIssueStatus(id, status, resolutionNotes, user?.fullName);
    },
    [user]
  );

  const deleteIssue = useCallback((id: string) => {
    return issueService.deleteIssue(id);
  }, []);

  return {
    issues,
    stats,
    loading,
    createIssue,
    updateStatus,
    deleteIssue,
  };
}
