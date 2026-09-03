-- ============================================================================
-- MIGRATION: August 2026 Attendance Records for Freddy Thomas & Anjitha P V
-- Date Range: 2026-08-01 to 2026-08-31
-- Target Tables: flwdsk_attendance_records & flwdsk_work_sessions
-- ============================================================================

DO $$
DECLARE
    v_freddy_id UUID;
    v_anjitha_id UUID;
    v_rec_id UUID;
BEGIN
    -- 1. Fetch Employee IDs dynamically
    SELECT id INTO v_freddy_id FROM flwdsk_employees 
    WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%freddy%thomas%' 
       OR LOWER(first_name) LIKE '%freddy%' LIMIT 1;

    SELECT id INTO v_anjitha_id FROM flwdsk_employees 
    WHERE LOWER(CONCAT(first_name, ' ', last_name)) LIKE '%anjitha%' 
       OR LOWER(first_name) LIKE '%anjitha%' LIMIT 1;

    IF v_freddy_id IS NULL THEN
        RAISE NOTICE 'Warning: Employee Freddy Thomas not found in flwdsk_employees.';
    END IF;

    IF v_anjitha_id IS NULL THEN
        RAISE NOTICE 'Warning: Employee Anjitha P V not found in flwdsk_employees.';
    END IF;

    -- ========================================================================
    -- SECTION 1: FREDDY THOMAS ATTENDANCE LOGS
    -- ========================================================================
    IF v_freddy_id IS NOT NULL THEN
        -- Clean existing sessions for Freddy in Aug 2026
        DELETE FROM flwdsk_work_sessions 
        WHERE attendance_record_id IN (
            SELECT id FROM flwdsk_attendance_records 
            WHERE employee_id = v_freddy_id AND work_date >= '2026-08-01' AND work_date <= '2026-08-31'
        );

        -- 2026-08-03
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-03', '2026-08-03 09:30:00+05:30', '2026-08-03 18:32:00+05:30', 542, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-03 09:30:00+05:30', '2026-08-03 18:32:00+05:30', 'Office');

        -- 2026-08-04
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-04', '2026-08-04 09:28:00+05:30', '2026-08-04 17:30:00+05:30', 403, 79, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-04 09:28:00+05:30', '2026-08-04 17:30:00+05:30', 'Office');

        -- 2026-08-05
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-05', '2026-08-05 09:32:00+05:30', '2026-08-05 17:30:00+05:30', 478, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-05 09:32:00+05:30', '2026-08-05 17:30:00+05:30', 'Office');

        -- 2026-08-06
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-06', '2026-08-06 09:28:00+05:30', '2026-08-06 17:45:00+05:30', 439, 58, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-06 09:28:00+05:30', '2026-08-06 17:45:00+05:30', 'Office');

        -- 2026-08-07
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-07', '2026-08-07 09:32:00+05:30', '2026-08-07 17:46:00+05:30', 432, 62, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-07 09:32:00+05:30', '2026-08-07 17:46:00+05:30', 'Office');

        -- 2026-08-10
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-10', '2026-08-10 09:31:00+05:30', '2026-08-10 17:38:00+05:30', 423, 64, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-10 09:31:00+05:30', '2026-08-10 17:38:00+05:30', 'Office');

        -- 2026-08-11
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-11', '2026-08-11 09:38:00+05:30', '2026-08-11 17:32:00+05:30', 431, 43, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-11 09:38:00+05:30', '2026-08-11 17:32:00+05:30', 'Office');

        -- 2026-08-12
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-12', '2026-08-12 09:32:00+05:30', '2026-08-12 17:35:00+05:30', 428, 55, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-12 09:32:00+05:30', '2026-08-12 17:35:00+05:30', 'Office');

        -- 2026-08-13
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-13', '2026-08-13 09:37:00+05:30', '2026-08-13 17:31:00+05:30', 421, 53, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-13 09:37:00+05:30', '2026-08-13 17:31:00+05:30', 'Office');

        -- 2026-08-14
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-14', '2026-08-14 09:23:00+05:30', '2026-08-14 17:35:00+05:30', 433, 59, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-14 09:23:00+05:30', '2026-08-14 17:35:00+05:30', 'Office');

        -- 2026-08-17
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-17', '2026-08-17 09:26:00+05:30', '2026-08-17 17:43:00+05:30', 445, 52, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-17 09:26:00+05:30', '2026-08-17 17:43:00+05:30', 'Office');

        -- 2026-08-18
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-18', '2026-08-18 09:25:00+05:30', '2026-08-18 18:02:00+05:30', 462, 55, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-18 09:25:00+05:30', '2026-08-18 18:02:00+05:30', 'Office');

        -- 2026-08-19
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-19', '2026-08-19 09:26:00+05:30', '2026-08-19 20:08:00+05:30', 600, 42, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-19 09:26:00+05:30', '2026-08-19 20:08:00+05:30', 'Office');

        -- 2026-08-20
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-20', '2026-08-20 10:07:00+05:30', '2026-08-20 22:28:00+05:30', 691, 50, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-20 10:07:00+05:30', '2026-08-20 22:28:00+05:30', 'Office');

        -- 2026-08-21
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-21', '2026-08-21 09:35:00+05:30', '2026-08-21 17:36:00+05:30', 431, 50, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-21 09:35:00+05:30', '2026-08-21 17:36:00+05:30', 'Office');

        -- 2026-08-24
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-24', '2026-08-24 09:31:00+05:30', '2026-08-24 17:34:00+05:30', 432, 51, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-24 09:31:00+05:30', '2026-08-24 17:34:00+05:30', 'Office');

        -- 2026-08-25
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-25', '2026-08-25 09:26:00+05:30', '2026-08-25 18:21:00+05:30', 505, 30, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-25 09:26:00+05:30', '2026-08-25 18:21:00+05:30', 'Office');

        -- 2026-08-28
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-28', '2026-08-28 09:28:00+05:30', '2026-08-28 17:43:00+05:30', 439, 56, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-28 09:28:00+05:30', '2026-08-28 17:43:00+05:30', 'Office');

        -- 2026-08-31
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_freddy_id, '2026-08-31', '2026-08-31 09:23:00+05:30', '2026-08-31 17:31:00+05:30', 438, 50, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-31 09:23:00+05:30', '2026-08-31 17:31:00+05:30', 'Office');
    END IF;

    -- ========================================================================
    -- SECTION 2: ANJITHA P V ATTENDANCE LOGS
    -- ========================================================================
    IF v_anjitha_id IS NOT NULL THEN
        -- Clean existing sessions for Anjitha in Aug 2026
        DELETE FROM flwdsk_work_sessions 
        WHERE attendance_record_id IN (
            SELECT id FROM flwdsk_attendance_records 
            WHERE employee_id = v_anjitha_id AND work_date >= '2026-08-01' AND work_date <= '2026-08-31'
        );

        -- 2026-08-01 (2 Sessions)
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-01', '2026-08-01 09:31:00+05:30', '2026-08-02 00:02:00+05:30', 871, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES 
            (gen_random_uuid(), v_rec_id, '2026-08-01 09:31:00+05:30', '2026-08-01 09:36:00+05:30', 'Office'),
            (gen_random_uuid(), v_rec_id, '2026-08-01 09:36:00+05:30', '2026-08-02 00:02:00+05:30', 'Office');

        -- 2026-08-03
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-03', '2026-08-03 09:30:00+05:30', '2026-08-03 19:50:00+05:30', 609, 11, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-03 09:30:00+05:30', '2026-08-03 19:50:00+05:30', 'Office');

        -- 2026-08-04
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-04', '2026-08-04 10:00:00+05:30', '2026-08-04 23:45:00+05:30', 825, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-04 10:00:00+05:30', '2026-08-04 23:45:00+05:30', 'Office');

        -- 2026-08-05
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-05', '2026-08-05 09:44:00+05:30', '2026-08-05 17:53:00+05:30', 448, 41, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-05 09:44:00+05:30', '2026-08-05 17:53:00+05:30', 'Office');

        -- 2026-08-06
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-06', '2026-08-06 09:25:00+05:30', '2026-08-06 17:37:00+05:30', 404, 88, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-06 09:25:00+05:30', '2026-08-06 17:37:00+05:30', 'Office');

        -- 2026-08-07
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-07', '2026-08-07 09:24:00+05:30', '2026-08-07 17:30:00+05:30', 457, 29, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-07 09:24:00+05:30', '2026-08-07 17:30:00+05:30', 'Office');

        -- 2026-08-08
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-08', '2026-08-08 09:25:00+05:30', '2026-08-08 19:07:00+05:30', 582, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-08 09:25:00+05:30', '2026-08-08 19:07:00+05:30', 'Office');

        -- 2026-08-11
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-11', '2026-08-11 09:32:00+05:30', '2026-08-11 18:00:00+05:30', 488, 20, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-11 09:32:00+05:30', '2026-08-11 18:00:00+05:30', 'Office');

        -- 2026-08-12
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-12', '2026-08-12 09:30:00+05:30', '2026-08-12 17:30:00+05:30', 445, 35, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-12 09:30:00+05:30', '2026-08-12 17:30:00+05:30', 'Office');

        -- 2026-08-13
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-13', '2026-08-13 09:36:00+05:30', '2026-08-13 17:56:00+05:30', 475, 25, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-13 09:36:00+05:30', '2026-08-13 17:56:00+05:30', 'Office');

        -- 2026-08-14
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-14', '2026-08-14 13:41:00+05:30', '2026-08-14 17:30:00+05:30', 206, 23, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-14 13:41:00+05:30', '2026-08-14 17:30:00+05:30', 'Office');

        -- 2026-08-15
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-15', '2026-08-15 09:31:00+05:30', '2026-08-15 17:30:00+05:30', 479, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-15 09:31:00+05:30', '2026-08-15 17:30:00+05:30', 'Office');

        -- 2026-08-17
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-17', '2026-08-17 09:33:00+05:30', '2026-08-17 17:30:00+05:30', 468, 9, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-17 09:33:00+05:30', '2026-08-17 17:30:00+05:30', 'Office');

        -- 2026-08-18
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-18', '2026-08-18 09:30:00+05:30', '2026-08-18 22:22:00+05:30', 737, 35, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-18 09:30:00+05:30', '2026-08-18 22:22:00+05:30', 'Office');

        -- 2026-08-19
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-19', '2026-08-19 09:32:00+05:30', '2026-08-19 17:38:00+05:30', 486, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-19 09:32:00+05:30', '2026-08-19 17:38:00+05:30', 'Office');

        -- 2026-08-20
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-20', '2026-08-20 09:35:00+05:30', '2026-08-20 17:38:00+05:30', 466, 17, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-20 09:35:00+05:30', '2026-08-20 17:38:00+05:30', 'Office');

        -- 2026-08-21 (3 Sessions)
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-21', '2026-08-21 09:37:00+05:30', '2026-08-21 17:38:00+05:30', 313, 77, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES 
            (gen_random_uuid(), v_rec_id, '2026-08-21 09:37:00+05:30', '2026-08-21 13:26:00+05:30', 'Office'),
            (gen_random_uuid(), v_rec_id, '2026-08-21 13:26:00+05:30', '2026-08-21 14:44:00+05:30', 'Office'),
            (gen_random_uuid(), v_rec_id, '2026-08-21 16:15:00+05:30', '2026-08-21 17:38:00+05:30', 'Office');

        -- 2026-08-22
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-22', '2026-08-22 09:30:00+05:30', '2026-08-22 19:12:00+05:30', 542, 40, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-22 09:30:00+05:30', '2026-08-22 19:12:00+05:30', 'Office');

        -- 2026-08-24
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-24', '2026-08-24 09:30:00+05:30', '2026-08-24 19:06:00+05:30', 515, 61, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-24 09:30:00+05:30', '2026-08-24 19:06:00+05:30', 'Office');

        -- 2026-08-25
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-25', '2026-08-25 09:29:00+05:30', '2026-08-25 19:13:00+05:30', 543, 41, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-25 09:29:00+05:30', '2026-08-25 19:13:00+05:30', 'Office');

        -- 2026-08-28
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-28', '2026-08-28 09:28:00+05:30', '2026-08-28 17:49:00+05:30', 561, 0, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-28 09:28:00+05:30', '2026-08-28 17:49:00+05:30', 'Office');

        -- 2026-08-31
        INSERT INTO flwdsk_attendance_records (id, employee_id, work_date, first_clock_in, last_clock_out, total_working_minutes, total_break_minutes, status, created_at, updated_at)
        VALUES (gen_random_uuid(), v_anjitha_id, '2026-08-31', '2026-08-31 09:31:00+05:30', '2026-08-31 19:57:00+05:30', 616, 10, 'present', NOW(), NOW())
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
            first_clock_in = EXCLUDED.first_clock_in,
            last_clock_out = EXCLUDED.last_clock_out,
            total_working_minutes = EXCLUDED.total_working_minutes,
            total_break_minutes = EXCLUDED.total_break_minutes,
            status = 'present',
            updated_at = NOW()
        RETURNING id INTO v_rec_id;

        INSERT INTO flwdsk_work_sessions (id, attendance_record_id, clock_in, clock_out, work_type)
        VALUES (gen_random_uuid(), v_rec_id, '2026-08-31 09:31:00+05:30', '2026-08-31 19:57:00+05:30', 'Office');
    END IF;

    RAISE NOTICE 'Attendance logs successfully updated for Freddy Thomas and Anjitha P V.';
END $$;
