/**
 * KVJ Analytics — Registration Database Auto-Lookup (Phase 2 Upgrade)
 * Spec Section 11:
 *  - Auto-match students by phone number search against Registration DB
 *  - Auto-populates: Student Name, Photo, Email, Qualification, Gender
 *  - Supports manual override if no record matches
 */

import { useState } from 'react';
import { Button, Badge } from '../../../shared/ui/components';
import { useNotifications } from '../../../shared/notifications/NotificationProvider';

export interface RegistrationRecord {
  phone: string;
  fullName: string;
  email: string;
  photoUrl?: string;
  qualification: string;
  gender: 'Male' | 'Female' | 'Other';
  college: string;
  registrationDate: string;
}

const REGISTRATION_DATABASE: Record<string, RegistrationRecord> = {};

export function RegistrationLookup({
  onSelectRecord,
}: {
  onSelectRecord: (rec: Partial<RegistrationRecord>) => void;
}) {
  const { toast } = useNotifications();
  const [phoneQuery, setPhoneQuery] = useState('');
  const [match, setMatch] = useState<RegistrationRecord | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneQuery.replace(/\D/g, '');
    setSearched(true);

    if (REGISTRATION_DATABASE[cleanPhone]) {
      const rec = REGISTRATION_DATABASE[cleanPhone];
      setMatch(rec);
      toast({ variant: 'success', title: 'Registration Match Found', message: `Found registered profile for ${rec.fullName}` });
    } else {
      setMatch(null);
      toast({ variant: 'info', title: 'No Registration Match', message: 'Enter details manually below.' });
    }
  };

  const handleApply = () => {
    if (match) {
      onSelectRecord(match);
      toast({ variant: 'success', title: 'Student Data Auto-Populated' });
    }
  };

  return (
    <div style={{
      background: 'var(--bg-sunken)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
        🔍 Registration DB Auto-Lookup (Search by Phone Number)
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="kvj-input"
          placeholder="Enter 10-digit phone number (e.g. 9876543210)"
          value={phoneQuery}
          onChange={(e) => { setPhoneQuery(e.target.value); setSearched(false); }}
          style={{ flex: 1, padding: '6px 12px', fontSize: 12 }}
        />
        <Button type="submit" size="sm">Search DB</Button>
      </form>

      {searched && match && (
        <div style={{
          padding: 10, background: 'var(--status-success-bg)',
          borderRadius: 'var(--radius-xs)', border: '1px solid var(--status-success-border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              ✓ {match.fullName} ({match.gender})
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {match.qualification} · {match.email} · {match.college}
            </div>
          </div>
          <Button size="xs" variant="success" onClick={handleApply}>Auto-Fill</Button>
        </div>
      )}

      {searched && !match && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>ℹ No registration record found for phone. You can enter details manually.</span>
        </div>
      )}
    </div>
  );
}

export default RegistrationLookup;
