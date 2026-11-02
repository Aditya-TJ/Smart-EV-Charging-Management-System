-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/06_admin_auth.sql
-- Description: Administrator Authentication & Session Storage
-- Phase: Phase 8 - Admin Authentication Implementation
-- MySQL Version: 8.0+ Compatible (Idempotent)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Table: admin_users
-- Purpose: Stores registered administrators with bcrypt password hashes.
-- Integrity: Independent from customer table `user`; never stores plaintext.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_users (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 2. Table: admin_sessions
-- Purpose: Server-side persistent session store for active admin logins.
-- Security: Cryptographically random tokens with explicit expiry times.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
    session_id VARCHAR(64) PRIMARY KEY,
    admin_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    INDEX idx_admin_session_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 3. Table: admin_login_attempts
-- Purpose: Brute-force attack mitigation & rate limiting tracking.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_login_attempts (
    attempt_id INT PRIMARY KEY AUTO_INCREMENT,
    ip_address VARCHAR(45) NOT NULL,
    email VARCHAR(100) NOT NULL,
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_successful BOOLEAN DEFAULT FALSE,
    INDEX idx_attempts_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
