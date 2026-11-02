import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 2 Migrations Verification (MIG-000 through MIG-004)', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

  const expectedMigrations = [
    '20261101000000_create_migration_log.sql',
    '20261101010000_add_probation_end_date.sql',
    '20261101020000_consolidate_schedule_sessions.sql',
    '20261101030000_composite_indexes.sql',
    '20261101040000_backfill_project_allocations.sql',
  ];

  it('all 5 Phase 2 migration files exist', () => {
    for (const file of expectedMigrations) {
      const fullPath = path.join(migrationsDir, file);
      expect(fs.existsSync(fullPath), `Migration file ${file} should exist`).toBe(true);
    }
  });

  it('no cancelled drop migrations exist', () => {
    const cancelledDrop = path.join(migrationsDir, '20261029000000_remove_excluded_modules_tables.sql');
    expect(fs.existsSync(cancelledDrop)).toBe(false);
  });

  it('migrations are strictly non-destructive (no DROP TABLE CASCADE on core tables)', () => {
    for (const file of expectedMigrations) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      expect(content).not.toMatch(/DROP\s+TABLE\s+(?!IF\s+EXISTS\s+public\.flwdsk_migration_log)/i);
      expect(content).not.toMatch(/DROP\s+COLUMN/i);
    }
  });

  it('MIG-001 contains only probation_end_date and NO probation_duration or leave_accrual_start_date (EMP-Q01)', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '20261101010000_add_probation_end_date.sql'), 'utf8');
    expect(content).toContain('probation_end_date DATE NULL');
    expect(content).not.toContain('probation_duration');
    expect(content).not.toContain('leave_accrual_start_date');
  });

  it('MIG-004 logs backfill IDs to flwdsk_migration_log', () => {
    const content = fs.readFileSync(path.join(migrationsDir, '20261101040000_backfill_project_allocations.sql'), 'utf8');
    expect(content).toContain('MIG-004_PROJECT_ALLOCATIONS_BACKFILL');
    expect(content).toContain('flwdsk_migration_log');
  });
});

