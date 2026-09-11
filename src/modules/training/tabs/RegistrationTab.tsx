import React from 'react';
import { Card, SectionHeader } from '../../../shared/ui/components';
import type { StudentRecord, RegistrationRecord } from '../types/batch-management.types';

export interface RegistrationTabProps {
  students: StudentRecord[];
  registrationRecords: RegistrationRecord[];
  registrationSearchQuery: string;
  onSearchChange: (query: string) => void;
}

export const RegistrationTab: React.FC<RegistrationTabProps> = ({
  students,
  registrationRecords,
  registrationSearchQuery,
  onSearchChange,
}) => {
  // Filter registration records to show ONLY latest registration for students matched in the master student dataset
  const matchedRegistrations = React.useMemo(() => {
    const map = new Map<string, RegistrationRecord>();

    registrationRecords.forEach((r) => {
      const regPhoneDigits = r.phone.replace(/\D/g, '');
      const regNameNorm = r.name.toLowerCase().trim();

      const isMatched = students.some((st) => {
        const stPhoneDigits = st.phone.replace(/\D/g, '');
        const stNameNorm = st.name.toLowerCase().trim();
        if (regPhoneDigits && stPhoneDigits && regPhoneDigits.length >= 10 && stPhoneDigits.length >= 10) {
          return regPhoneDigits.slice(-10) === stPhoneDigits.slice(-10);
        }
        return regNameNorm && stNameNorm && regNameNorm === stNameNorm;
      });

      if (isMatched) {
        const key = regPhoneDigits && regPhoneDigits.length >= 10 ? regPhoneDigits.slice(-10) : regNameNorm;
        map.set(key, r);
      }
    });

    return Array.from(map.values());
  }, [registrationRecords, students]);

  const q = registrationSearchQuery.toLowerCase().trim();
  const filtered = matchedRegistrations.filter((r) =>
    !q ||
    r.name.toLowerCase().includes(q) ||
    r.phone.includes(q) ||
    r.email.toLowerCase().includes(q) ||
    r.registerNo.toLowerCase().includes(q) ||
    r.college.toLowerCase().includes(q)
  );

  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <SectionHeader title="📋 Matched Student Registration Records (Google Sheet)" />
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Showing only registrations matched with current students data using Phone Number as Primary Key.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="kvj-input"
            value={registrationSearchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="🔍 Search Name, Phone, Email, Reg No..."
            style={{ fontSize: 12, padding: '5px 10px', width: 220, borderRadius: 6 }}
          />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Total Matched: {matchedRegistrations.length}
          </span>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }} className="kvj-table">
          <thead>
            <tr style={{ background: 'var(--bg-sunken)', textAlign: 'left', borderBottom: '1.5px solid var(--border)' }}>
              <th style={{ padding: 10 }}>Photo</th>
              <th style={{ padding: 10 }}>Student Name</th>
              <th style={{ padding: 10 }}>Phone</th>
              <th style={{ padding: 10 }}>Email Address</th>
              <th style={{ padding: 10 }}>Register No</th>
              <th style={{ padding: 10 }}>Gender</th>
              <th style={{ padding: 10 }}>Qualification</th>
              <th style={{ padding: 10 }}>Has Computer</th>
              <th style={{ padding: 10 }}>Learned Before</th>
              <th style={{ padding: 10 }}>Certiport User</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: 10 }}>
                  {r.photoUrl ? (
                    <img
                      src={r.photoUrl}
                      alt={r.name}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  ) : (
                    <span style={{ fontSize: 20 }}>👤</span>
                  )}
                </td>
                <td style={{ padding: 10, fontWeight: 700 }}>{r.name}</td>
                <td style={{ padding: 10, color: 'var(--text-muted)' }}>{r.phone}</td>
                <td style={{ padding: 10 }}>{r.email}</td>
                <td style={{ padding: 10 }}>{r.registerNo}</td>
                <td style={{ padding: 10 }}>{r.gender}</td>
                <td style={{ padding: 10 }}>{r.qualification}</td>
                <td style={{ padding: 10 }}>{r.hasComputer}</td>
                <td style={{ padding: 10 }}>{r.learnedBefore}</td>
                <td style={{ padding: 10 }}>{r.certiportUser}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                  No matched registration records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
