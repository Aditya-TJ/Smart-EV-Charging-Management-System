-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/04_procedures.sql
-- Description: Stored Procedure for Station Revenue Reporting in Module M8
-- DBMS Syllabus Concept: Unit 2 - Stored Procedures, Date Parameters & Aggregation
-- MySQL Version: 8.0+ Compatible (Idempotent)
-- ================================================================

DROP PROCEDURE IF EXISTS sp_station_revenue;

DELIMITER $$

-- ----------------------------------------------------------------
-- Procedure: sp_station_revenue
-- Parameters:
--   p_from (DATE) - Optional start date filter (pass NULL for all-time)
--   p_to   (DATE) - Optional end date filter (pass NULL for all-time)
-- Purpose:
--   Calculates session count, energy delivered, and total collected revenue
--   for every charging station within the requested date window.
--
-- Optimization & Correctness Highlights:
--   1. Double-counting protection: Aggregates sessions and payments
--      in a derived table by station_id BEFORE joining with charging_point.
--   2. Sargable Date Conditions: Avoids wrapping csess.start_time in DATE().
--      Uses direct index-friendly range comparison:
--      start_time >= p_from AND start_time < DATE_ADD(p_to, INTERVAL 1 DAY).
--      This accurately includes all timestamps up to 23:59:59 of p_to.
--   3. Preserves zero-revenue stations: Outer LEFT JOIN ensures stations with
--      no sessions during the period appear with count=0, energy=0, revenue=0.
-- ----------------------------------------------------------------
CREATE PROCEDURE sp_station_revenue(IN p_from DATE, IN p_to DATE)
BEGIN
    SELECT 
        cs.station_id,
        cs.name AS station_name,
        cs.location AS station_location,
        cs.status AS station_status,
        cs.total_slots,
        COUNT(DISTINCT cp.point_id) AS total_points,
        COALESCE(s.session_count, 0) AS session_count,
        COALESCE(s.total_energy_kwh, 0.00) AS total_energy_kwh,
        COALESCE(s.total_revenue, 0.00) AS total_revenue
    FROM charging_station cs
    LEFT JOIN charging_point cp ON cs.station_id = cp.station_id
    LEFT JOIN (
        SELECT 
            cp2.station_id,
            COUNT(csess.session_id) AS session_count,
            COALESCE(SUM(csess.energy_consumed_kwh), 0.00) AS total_energy_kwh,
            COALESCE(SUM(p.amount), 0.00) AS total_revenue
        FROM charging_point cp2
        INNER JOIN charging_session csess ON cp2.point_id = csess.point_id
        LEFT JOIN payment p ON csess.session_id = p.session_id
        WHERE (p_from IS NULL OR csess.start_time >= p_from)
          AND (p_to IS NULL OR csess.start_time < DATE_ADD(p_to, INTERVAL 1 DAY))
        GROUP BY cp2.station_id
    ) s ON cs.station_id = s.station_id
    GROUP BY cs.station_id, cs.name, cs.location, cs.status, cs.total_slots, s.session_count, s.total_energy_kwh, s.total_revenue
    ORDER BY total_revenue DESC, session_count DESC;
END$$

DELIMITER ;
