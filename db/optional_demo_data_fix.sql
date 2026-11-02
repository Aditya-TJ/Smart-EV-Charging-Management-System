-- ================================================================
-- Smart EV Charging & Energy Management System
-- File: db/optional_demo_data_fix.sql
-- Description: OPTIONAL demo data synchronization script.
-- IMPORTANT: DO NOT execute automatically. Review before running.
-- ================================================================

-- Inconsistency 1: Point 4 is marked 'in-use' in demo data, but its only
-- session (session 7) is already completed.
-- Fix: Reconcile Point 4 to 'available'.
UPDATE charging_point 
SET status = 'available' 
WHERE point_id = 4 AND status = 'in-use';

-- Inconsistency 2: Point 5 is marked 'available' in demo data, but session 8
-- is actively 'ongoing' on it.
-- Fix: Reconcile Point 5 to 'in-use'.
UPDATE charging_point 
SET status = 'in-use' 
WHERE point_id = 5 AND status = 'available';

-- Inconsistency 3: Point 7 is marked 'in-use' but has no active session attached.
-- Fix: Free Point 7 to 'available'.
UPDATE charging_point 
SET status = 'available' 
WHERE point_id = 7 AND status = 'in-use';

-- Inconsistency 4 (Informational only):
-- Station 3 is in 'maintenance' status while having charging points.
-- Station 3's energy allocation is 30% (Wind), leaving 70% unallocated.
-- (Preserved as-is so you can showcase maintenance and unallocated warnings in your viva).
