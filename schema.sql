-- ============================================================================
-- KVJ Analytics — Complete Database Schema & Seed Script (PostgreSQL / MySQL compatible)
-- ============================================================================

-- 1. USERS & AUTHENTICATION TABLE
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    role VARCHAR(32) NOT NULL DEFAULT 'EMPLOYEE', -- 'ADMIN', 'TRAINER', 'MANAGER', 'EMPLOYEE', 'STUDENT'
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE
);

-- 2. EMPLOYEES / TRAINERS TABLE
CREATE TABLE IF NOT EXISTS employees (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    first_name VARCHAR(64) NOT NULL,
    last_name VARCHAR(64) NOT NULL,
    email VARCHAR(128) UNIQUE NOT NULL,
    phone VARCHAR(32),
    department VARCHAR(64) DEFAULT 'Training & Development',
    designation VARCHAR(64) DEFAULT 'Senior Technical Trainer',
    status VARCHAR(32) DEFAULT 'Active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. COLLEGES TABLE
CREATE TABLE IF NOT EXISTS colleges (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    location VARCHAR(128),
    principal_name VARCHAR(128),
    contact_email VARCHAR(128),
    contact_phone VARCHAR(32),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. COURSES TABLE
CREATE TABLE IF NOT EXISTS courses (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    code VARCHAR(32) UNIQUE NOT NULL,
    category VARCHAR(64) NOT NULL,
    duration_hours INT DEFAULT 40,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TRAINING BATCHES TABLE
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(64) PRIMARY KEY,
    batch_code VARCHAR(64) UNIQUE NOT NULL,
    college_id VARCHAR(64) REFERENCES colleges(id) ON DELETE CASCADE,
    course_id VARCHAR(64) REFERENCES courses(id) ON DELETE CASCADE,
    trainer_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    coordinator VARCHAR(128),
    phase VARCHAR(32) DEFAULT 'Scheduled',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. SCHEDULE SESSIONS TABLE (MATRIX CALENDAR)
CREATE TABLE IF NOT EXISTS schedule_sessions (
    id VARCHAR(64) PRIMARY KEY,
    batch_id VARCHAR(64) REFERENCES batches(id) ON DELETE CASCADE,
    trainer_id VARCHAR(64) REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    session_title VARCHAR(128) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(128),
    mode VARCHAR(32) DEFAULT 'Offline',
    student_count INT DEFAULT 40,
    status VARCHAR(32) DEFAULT 'Scheduled',
    color VARCHAR(16) DEFAULT '#3b82f6',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(64) PRIMARY KEY,
    trainer_id VARCHAR(64) REFERENCES employees(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    duration VARCHAR(32) NOT NULL, -- 'Full Day', 'Half Day Morning', 'Half Day Afternoon'
    leave_type VARCHAR(32) NOT NULL, -- 'Casual', 'Medical', 'Emergency'
    status VARCHAR(32) DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. ENROLLED STUDENTS TABLE
CREATE TABLE IF NOT EXISTS student_records (
    id VARCHAR(64) PRIMARY KEY,
    batch_id VARCHAR(64) REFERENCES batches(id) ON DELETE CASCADE,
    register_no VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(128) NOT NULL,
    email VARCHAR(128),
    phone VARCHAR(32),
    gender VARCHAR(16) DEFAULT 'Female',
    qualification VARCHAR(64) DEFAULT 'B.Tech CS',
    has_laptop BOOLEAN DEFAULT TRUE,
    prior_knowledge VARCHAR(32) DEFAULT 'Beginner',
    attendance_pct INT DEFAULT 90,
    voucher_id VARCHAR(64),
    voucher_status VARCHAR(32) DEFAULT 'Unassigned',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. FINAL EXAM RESULTS TABLE
CREATE TABLE IF NOT EXISTS final_exam_results (
    id VARCHAR(64) PRIMARY KEY,
    student_id VARCHAR(64) REFERENCES student_records(id) ON DELETE CASCADE,
    batch_id VARCHAR(64) REFERENCES batches(id) ON DELETE CASCADE,
    mark INT NOT NULL CHECK (mark >= 0 AND mark <= 100),
    result VARCHAR(16) NOT NULL, -- 'Passed', 'Failed'
    evaluated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- DEFAULT SEED DATA
-- ============================================================================

-- Admin user (Username: Admin, Password: AjayThomas)
INSERT INTO users (id, username, email, password_hash, full_name, role, must_change_password)
VALUES (
    'u-admin',
    'Admin',
    'admin@kvjanalytics.com',
    'AjayThomas', -- Replace with bcrypt hash in production: $2a$12$...
    'System Admin',
    'ADMIN',
    FALSE
) ON CONFLICT (id) DO NOTHING;

-- Trainers with default password "password" and must_change_password = TRUE
INSERT INTO users (id, username, email, password_hash, full_name, role, must_change_password)
VALUES 
    ('u-trainer-priya', 'PriyaNair', 'priya.nair@kvjanalytics.com', 'password', 'Priya Nair', 'TRAINER', TRUE),
    ('u-trainer-rahul', 'RahulMenon', 'rahul.menon@kvjanalytics.com', 'password', 'Rahul Menon', 'TRAINER', TRUE),
    ('u-coord-thomas', 'ThomasKurian', 'thomas.kurian@kvjanalytics.com', 'password', 'Prof. Thomas Kurian', 'MANAGER', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Trainers Employee Profiles
INSERT INTO employees (id, user_id, first_name, last_name, email, phone, designation)
VALUES
    ('emp-1', 'u-trainer-priya', 'Priya', 'Nair', 'priya.nair@kvjanalytics.com', '+91 98765 43210', 'Senior Data Trainer'),
    ('emp-2', 'u-trainer-rahul', 'Rahul', 'Menon', 'rahul.menon@kvjanalytics.com', '+91 98765 43211', 'Lead BI Specialist')
ON CONFLICT (id) DO NOTHING;
