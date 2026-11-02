-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/05_demo_queries.sql
-- Description: Curated Demo Queries for Viva Examination
-- DBMS Syllabus: Units 1, 2, and 3
-- ================================================================

-- ----------------------------------------------------------------
-- 1. INNER JOIN & LEFT JOIN (Unit 2: Relational Joins)
-- Demonstrates: Combining user, vehicle, station, charging point, and
-- payment records. Uses LEFT JOIN for payment because ongoing or
-- unpaid completed sessions do not yet have a payment row.
-- ----------------------------------------------------------------
SELECT 
    cs.session_id,
    u.name AS user_name,
    v.vehicle_number,
    st.name AS station_name,
    cp.connector_type,
    cs.status AS session_status,
    p.amount AS amount_paid,
    p.payment_method
FROM charging_session cs
INNER JOIN `user` u ON cs.user_id = u.user_id
INNER JOIN vehicle v ON cs.vehicle_id = v.vehicle_id
INNER JOIN charging_point cp ON cs.point_id = cp.point_id
INNER JOIN charging_station st ON cp.station_id = st.station_id
LEFT JOIN payment p ON cs.session_id = p.session_id;

-- ----------------------------------------------------------------
-- 2. GROUP BY and HAVING (Unit 2: Aggregations & Filtering)
-- Demonstrates: Finding stations that have delivered more than 20 kWh
-- of total charging energy.
-- ----------------------------------------------------------------
SELECT 
    st.station_id,
    st.name AS station_name,
    COUNT(cs.session_id) AS total_sessions,
    SUM(cs.energy_consumed_kwh) AS total_energy_kwh
FROM charging_station st
INNER JOIN charging_point cp ON st.station_id = cp.station_id
INNER JOIN charging_session cs ON cp.point_id = cs.point_id
GROUP BY st.station_id, st.name
HAVING SUM(cs.energy_consumed_kwh) > 20.00;

-- ----------------------------------------------------------------
-- 3. NESTED SUBQUERY (Unit 2: Non-Correlated Subquery)
-- Demonstrates: Finding stations whose total revenue strictly exceeds
-- the average revenue generated across all stations that have earnings.
-- ----------------------------------------------------------------
SELECT 
    st.station_id,
    st.name AS station_name,
    SUM(p.amount) AS station_revenue
FROM charging_station st
INNER JOIN charging_point cp ON st.station_id = cp.station_id
INNER JOIN charging_session cs ON cp.point_id = cs.point_id
INNER JOIN payment p ON cs.session_id = p.session_id
GROUP BY st.station_id, st.name
HAVING SUM(p.amount) > (
    -- Subquery: Computes average revenue across earning stations
    SELECT AVG(station_total)
    FROM (
        SELECT SUM(p2.amount) AS station_total
        FROM charging_station st2
        INNER JOIN charging_point cp2 ON st2.station_id = cp2.station_id
        INNER JOIN charging_session cs2 ON cp2.point_id = cs2.point_id
        INNER JOIN payment p2 ON cs2.session_id = p2.session_id
        GROUP BY st2.station_id
    ) AS station_revenues
);

-- ----------------------------------------------------------------
-- 4. CORRELATED SUBQUERY (Unit 2: Correlated Subquery)
-- Demonstrates: Finding charging sessions whose energy consumption
-- is strictly greater than that specific user's own average consumption.
-- Evaluated once per row of the outer query.
-- ----------------------------------------------------------------
SELECT 
    cs.session_id,
    cs.user_id,
    cs.energy_consumed_kwh,
    cs.start_time
FROM charging_session cs
WHERE cs.energy_consumed_kwh > (
    SELECT AVG(cs_inner.energy_consumed_kwh)
    FROM charging_session cs_inner
    WHERE cs_inner.user_id = cs.user_id
      AND cs_inner.energy_consumed_kwh IS NOT NULL
);

-- ----------------------------------------------------------------
-- 5. CORRELATED SUBQUERY WITH EXISTS (Unit 2: Set Membership)
-- Demonstrates: Finding all users who currently have at least one
-- active ('ongoing') charging session.
-- ----------------------------------------------------------------
SELECT 
    u.user_id,
    u.name,
    u.email,
    u.phone
FROM `user` u
WHERE EXISTS (
    SELECT 1 
    FROM charging_session cs 
    WHERE cs.user_id = u.user_id 
      AND cs.status = 'ongoing'
);

-- ----------------------------------------------------------------
-- 6. SUBQUERY WITH NOT EXISTS (Unit 2: Set Difference / Pending Payments)
-- Demonstrates: Finding all completed charging sessions that have NO
-- corresponding payment row in the payment table.
-- Used directly by Module M6 (Pending Payments Panel).
-- ----------------------------------------------------------------
SELECT 
    cs.session_id,
    cs.start_time,
    cs.end_time,
    cs.energy_consumed_kwh,
    u.name AS user_name,
    v.vehicle_number,
    st.name AS station_name
FROM charging_session cs
INNER JOIN `user` u ON cs.user_id = u.user_id
INNER JOIN vehicle v ON cs.vehicle_id = v.vehicle_id
INNER JOIN charging_point cp ON cs.point_id = cp.point_id
INNER JOIN charging_station st ON cp.station_id = st.station_id
WHERE cs.status = 'completed'
  AND NOT EXISTS (
      SELECT 1 
      FROM payment p 
      WHERE p.session_id = cs.session_id
  );

-- ----------------------------------------------------------------
-- 7. COMMON TABLE EXPRESSION (CTE) & RANK() (Unit 2: Window Functions & CTE)
-- Demonstrates: Ranking stations by session count using a CTE and
-- the RANK() window function.
-- Required output: "Stations with the highest number of charging sessions"
-- ----------------------------------------------------------------
WITH StationSessionStats AS (
    SELECT 
        cs.station_id,
        cs.name AS station_name,
        cs.location,
        COUNT(csess.session_id) AS total_sessions
    FROM charging_station cs
    LEFT JOIN charging_point cp ON cs.station_id = cp.station_id
    LEFT JOIN charging_session csess ON cp.point_id = csess.point_id
    GROUP BY cs.station_id, cs.name, cs.location
)
SELECT 
    station_id,
    station_name,
    location,
    total_sessions,
    RANK() OVER (ORDER BY total_sessions DESC) AS session_rank
FROM StationSessionStats
ORDER BY session_rank ASC, station_name ASC;

-- ----------------------------------------------------------------
-- 8. WINDOW FUNCTION: RUNNING TOTAL (Unit 2: Analytic Functions)
-- Demonstrates: Calculating a cumulative running sum of amount spent
-- per user, partitioned by user_id and ordered chronologically by session start.
-- Required output: "A user's charging history and total amount spent"
-- ----------------------------------------------------------------
SELECT 
    cs.session_id,
    cs.user_id,
    u.name AS user_name,
    cs.start_time,
    p.amount,
    SUM(p.amount) OVER (
        PARTITION BY cs.user_id 
        ORDER BY cs.start_time
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total_spent
FROM charging_session cs
INNER JOIN `user` u ON cs.user_id = u.user_id
INNER JOIN payment p ON cs.session_id = p.session_id
ORDER BY cs.user_id, cs.start_time;

-- ----------------------------------------------------------------
-- 9. QUERY OPTIMIZATION WITH EXPLAIN (Unit 3: Index Utilization)
-- Demonstrates: Verifying that searching sessions by user_id uses the
-- secondary B-Tree index `idx_session_user` rather than a full table scan.
-- ----------------------------------------------------------------
EXPLAIN 
SELECT * 
FROM charging_session 
WHERE user_id = 1;

-- ----------------------------------------------------------------
-- 10. QUERY OPTIMIZATION WITH EXPLAIN (Unit 3: Index Utilization)
-- Demonstrates: Verifying that filtering sessions by status uses the
-- secondary B-Tree index `idx_session_status`.
-- ----------------------------------------------------------------
EXPLAIN 
SELECT * 
FROM charging_session 
WHERE status = 'ongoing';
