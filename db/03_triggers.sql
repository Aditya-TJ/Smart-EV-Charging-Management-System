-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/03_triggers.sql
-- Description: Business Rule & Constraint Enforcement Triggers
-- DBMS Syllabus Concept: Unit 2 - Triggers & Exception Handling (SIGNAL SQLSTATE)
-- MySQL Version: 8.0+ Compatible (Idempotent)
-- ================================================================

-- ----------------------------------------------------------------
-- Trigger 1: trg_session_bi (BEFORE INSERT ON charging_session)
-- Purpose: 
--  1. Guards the 3NF transitive dependency (session_id -> vehicle_id -> user_id)
--     by ensuring the vehicle inserted belongs to the initiating user.
--  2. Validates that end_time is not earlier than start_time.
--  3. Validates that energy_consumed_kwh is non-negative.
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_session_bi;

DELIMITER $$
CREATE TRIGGER trg_session_bi
BEFORE INSERT ON charging_session
FOR EACH ROW
BEGIN
    DECLARE v_owner_id INT;

    -- 1. Validate vehicle ownership
    SELECT user_id INTO v_owner_id 
    FROM vehicle 
    WHERE vehicle_id = NEW.vehicle_id;

    IF v_owner_id IS NULL OR v_owner_id != NEW.user_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Violation: The specified vehicle does not belong to this user.';
    END IF;

    -- 2. Validate chronological order of session timestamps
    IF NEW.end_time IS NOT NULL AND NEW.end_time < NEW.start_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Validation Error: Session end_time cannot be earlier than start_time.';
    END IF;

    -- 3. Validate non-negative energy consumption
    IF NEW.energy_consumed_kwh IS NOT NULL AND NEW.energy_consumed_kwh < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Validation Error: Energy consumed (kWh) cannot be negative.';
    END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------
-- Trigger 2: trg_session_bu (BEFORE UPDATE ON charging_session)
-- Purpose:
--  Maintains data integrity during session lifecycle updates (e.g., when
--  completing a session or updating energy consumed).
--  Enforces the identical validation rules as trg_session_bi.
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_session_bu;

DELIMITER $$
CREATE TRIGGER trg_session_bu
BEFORE UPDATE ON charging_session
FOR EACH ROW
BEGIN
    DECLARE v_owner_id INT;

    -- 1. Validate vehicle ownership if user or vehicle changes
    SELECT user_id INTO v_owner_id 
    FROM vehicle 
    WHERE vehicle_id = NEW.vehicle_id;

    IF v_owner_id IS NULL OR v_owner_id != NEW.user_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Violation: The specified vehicle does not belong to this user.';
    END IF;

    -- 2. Validate chronological order of session timestamps
    IF NEW.end_time IS NOT NULL AND NEW.end_time < NEW.start_time THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Validation Error: Session end_time cannot be earlier than start_time.';
    END IF;

    -- 3. Validate non-negative energy consumption
    IF NEW.energy_consumed_kwh IS NOT NULL AND NEW.energy_consumed_kwh < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Validation Error: Energy consumed (kWh) cannot be negative.';
    END IF;
END$$
DELIMITER ;

-- ----------------------------------------------------------------
-- Trigger 3: trg_payment_bi (BEFORE INSERT ON payment)
-- Purpose:
--  1. Enforces the strict 1:1 GENERATES relationship in application logic:
--     complements and is fully compatible with the database UNIQUE constraint
--     on payment.session_id, providing a descriptive error message.
--  2. Enforces state machine validity: payment can only be recorded
--     for a session whose status is 'completed'.
--  3. Validates that payment amount is non-negative.
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_payment_bi;

DELIMITER $$
CREATE TRIGGER trg_payment_bi
BEFORE INSERT ON payment
FOR EACH ROW
BEGIN
    DECLARE v_session_status VARCHAR(20);
    DECLARE v_existing_payment_count INT;

    -- 1. Validate amount is non-negative
    IF NEW.amount IS NOT NULL AND NEW.amount < 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Validation Error: Payment amount cannot be negative.';
    END IF;

    -- 2. Verify target session exists and is completed
    SELECT status INTO v_session_status
    FROM charging_session
    WHERE session_id = NEW.session_id;

    IF v_session_status IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Violation: Referenced charging session does not exist.';
    ELSEIF v_session_status != 'completed' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Business Rule Violation: Payment can only be recorded for completed sessions.';
    END IF;

    -- 3. Enforce 1:1 relationship between session and payment (compatible with UNIQUE index)
    SELECT COUNT(*) INTO v_existing_payment_count
    FROM payment
    WHERE session_id = NEW.session_id;

    IF v_existing_payment_count > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Integrity Violation: A payment record already exists for this session (1:1 constraint).';
    END IF;
END$$
DELIMITER ;
