-- ============================================================================
-- MIGRATION: Update Ebin Louis Remote Attendance Logs for August 2026
-- Target Tables: flwdsk_attendance_records & flwdsk_work_sessions
-- ============================================================================

DO $$
DECLARE
    v_ebin_id UUID;
BEGIN
    -- Fetch Ebin Louis Employee ID dynamically
    SELECT id INTO v_ebin_id FROM flwdsk_employees 
    WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%ebin%' 
       OR LOWER(first_name) LIKE '%ebin%' LIMIT 1;

    IF v_ebin_id IS NULL THEN
        RAISE NOTICE 'Warning: Employee Ebin Louis not found in flwdsk_employees.';
    ELSE
        -- Update work_type in flwdsk_work_sessions for Ebin Louis in August 2026
        UPDATE flwdsk_work_sessions 
        SET work_type = 'Work From Home'
        WHERE attendance_record_id IN (
            SELECT id FROM flwdsk_attendance_records 
            WHERE employee_id = v_ebin_id 
              AND work_date >= '2026-08-01' 
              AND work_date <= '2026-08-31'
        );

        RAISE NOTICE 'Successfully updated Ebin Louis August 2026 work_sessions to Work From Home.';
    END IF;
END $$;
