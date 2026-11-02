-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/02_functions.sql
-- Description: Stored Function for Cost Calculation in Module M6
-- DBMS Syllabus Concept: Unit 2 - Stored Functions & Mathematical Expressions
-- MySQL Version: 8.0+ Compatible (Idempotent)
-- ================================================================

DROP FUNCTION IF EXISTS fn_session_cost;

DELIMITER $$

-- ----------------------------------------------------------------
-- Function: fn_session_cost
-- Purpose: Computes charging session bill amount dynamically based on
--          energy consumed (kWh) and tariff rate per kWh.
-- Formula: ROUND(energy_consumed_kwh * rate_per_kwh, 2)
-- Returns: DECIMAL(8,2) or NULL if energy or plan is unassigned.
-- Validation: Handles missing session IDs, NULL values, and non-existent records safely.
-- ----------------------------------------------------------------
CREATE FUNCTION fn_session_cost(p_session_id INT)
RETURNS DECIMAL(8,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_cost DECIMAL(8,2);
    DECLARE v_energy DECIMAL(7,2);
    DECLARE v_rate DECIMAL(5,2);

    -- Initialize to NULL
    SET v_cost = NULL;

    -- Guard against invalid or missing input parameter
    IF p_session_id IS NULL OR p_session_id <= 0 THEN
        RETURN NULL;
    END IF;

    -- Fetch energy consumed and the tariff plan's rate
    SELECT cs.energy_consumed_kwh, tp.rate_per_kwh
    INTO v_energy, v_rate
    FROM charging_session cs
    INNER JOIN tariff_plan tp ON cs.plan_id = tp.plan_id
    WHERE cs.session_id = p_session_id;

    -- Return NULL if session record does not exist or values are NULL
    IF v_energy IS NULL OR v_rate IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate exact cost rounded to 2 decimal places
    SET v_cost = ROUND(v_energy * v_rate, 2);

    RETURN v_cost;
END$$

DELIMITER ;
