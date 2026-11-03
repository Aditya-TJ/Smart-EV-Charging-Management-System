-- ================================================================
-- Smart EV Charging & Energy Management System - Sample Data
-- Name : Akash MP
-- SRN  : PES1UG24CS040
-- Class: 5A
-- ================================================================

-- 1. Insert into USER
INSERT INTO USER (user_id, name, email, phone, address) VALUES
(1, 'Priya Sharma', 'priya.sharma@example.com', '+91-98450-12345', '12, 4th Cross, Indiranagar, Bengaluru, Karnataka 560038'),
(2, 'Rahul Verma', 'rahul.verma@example.com', '+91-98765-23456', '45, Jubilee Hills, Road No. 36, Hyderabad, Telangana 500033'),
(3, 'Sneha Kulkarni', 'sneha.kulkarni@example.com', '+91-97654-34567', '88, FC Road, Shivajinagar, Pune, Maharashtra 411005');

-- 2. Insert into CHARGING_STATION
INSERT INTO CHARGING_STATION (station_id, name, location, total_slots, status, contact_number) VALUES
(1, 'Bengaluru Tech Park EV Hub', 'Bengaluru, Karnataka', 10, 'active', '+91-80-2841001'),
(2, 'Hyderabad Green Energy Station', 'Hyderabad, Telangana', 8, 'active', '+91-40-2341002'),
(3, 'Chennai Marina EV Point', 'Chennai, Tamil Nadu', 12, 'maintenance', '+91-44-2841003');

-- 3. Insert into ENERGY_SOURCE
INSERT INTO ENERGY_SOURCE (source_id, source_type, capacity_kw) VALUES
(1, 'Solar', 500.00),
(2, 'Grid', 2000.00),
(3, 'Wind', 300.00);

-- 4. Insert into TARIFF_PLAN
INSERT INTO TARIFF_PLAN (plan_id, plan_name, rate_per_kwh) VALUES
(1, 'Standard', 8.50),
(2, 'Off-Peak', 6.00);

-- 5. Insert into VEHICLE
INSERT INTO VEHICLE (vehicle_id, vehicle_number, model, battery_capacity, user_id) VALUES
(1, 'KA-03-AB-1234', 'Tata Nexon EV', 40.50, 1),
(2, 'TS-09-CD-5678', 'Hyundai Kona Electric', 39.20, 2),
(3, 'MH-12-EF-9012', 'MG ZS EV', 50.30, 3);

-- 6. Insert into CHARGING_POINT
INSERT INTO CHARGING_POINT (point_id, connector_type, power_rating_kw, status, station_id) VALUES
(4, 'CCS2', 60.00, 'in-use', 1),
(5, 'Type2', 22.00, 'available', 2),
(6, 'CHAdeMO', 50.00, 'available', 3),
(7, 'CCS2', 60.00, 'in-use', 1),
(8, 'Type2', 22.00, 'available', 2),
(9, 'CHAdeMO', 50.00, 'available', 3);

-- 7. Insert into STATION_ENERGY_SOURCE (M:N)
INSERT INTO STATION_ENERGY_SOURCE (station_id, source_id, allocation_pct) VALUES
(1, 1, 40.00),
(1, 2, 60.00),
(2, 2, 100.00),
(3, 3, 30.00);

-- 8. Insert into CHARGING_SESSION
INSERT INTO CHARGING_SESSION (session_id, start_time, end_time, energy_consumed_kwh, status, user_id, vehicle_id, point_id, plan_id) VALUES
(7, '2026-08-18 09:00:00', '2026-08-18 10:30:00', 25.50, 'completed', 1, 1, 4, 1),
(8, '2026-08-25 14:00:00', NULL, 12.30, 'ongoing', 2, 2, 5, 2),
(9, '2026-08-27 08:00:00', '2026-08-27 09:15:00', 18.75, 'completed', 3, 3, 6, 1);

-- 9. Insert into PAYMENT
INSERT INTO PAYMENT (payment_id, amount, payment_date, payment_method, session_id) VALUES
(3, 216.75, '2026-08-18', 'UPI', 7),
(4, 159.38, '2026-08-27', 'Card', 9);
