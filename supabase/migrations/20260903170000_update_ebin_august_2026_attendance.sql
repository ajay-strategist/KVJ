-- ============================================================================
-- MIGRATION: Update Ebin Louis August 2026 Attendance & Work Sessions Location
-- Target Days for Office: 2026-08-12, 2026-08-22, 2026-08-24
-- Target Days for Remote: All other work days in August 2026
-- ============================================================================

DO $$
DECLARE
    v_ebin_id UUID;
BEGIN
    -- 1. Fetch Employee ID dynamically for Ebin Louis
    SELECT id INTO v_ebin_id 
    FROM flwdsk_employees 
    WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%ebin%' 
       OR LOWER(first_name) LIKE '%ebin%' 
    LIMIT 1;

    IF v_ebin_id IS NULL THEN
        RAISE NOTICE 'Warning: Employee Ebin Louis not found in flwdsk_employees.';
    ELSE
        -- 2. Update work_sessions to 'Office' for Aug 12, Aug 22, and Aug 24, 2026
        UPDATE flwdsk_work_sessions
        SET work_type = 'Office',
            updated_at = NOW()
        WHERE attendance_record_id IN (
            SELECT id FROM flwdsk_attendance_records
            WHERE employee_id = v_ebin_id
              AND work_date IN ('2026-08-12', '2026-08-22', '2026-08-24')
        );

        -- 3. Update work_sessions to 'Remote' for all remaining August 2026 work days
        UPDATE flwdsk_work_sessions
        SET work_type = 'Remote',
            updated_at = NOW()
        WHERE attendance_record_id IN (
            SELECT id FROM flwdsk_attendance_records
            WHERE employee_id = v_ebin_id
              AND work_date >= '2026-08-01'
              AND work_date <= '2026-08-31'
              AND work_date NOT IN ('2026-08-12', '2026-08-22', '2026-08-24')
        );

        RAISE NOTICE 'Successfully updated August 2026 work sessions for Ebin Louis (Office on 12, 22, 24 August 2026; Remote for remaining days).';
    END IF;
END $$;
