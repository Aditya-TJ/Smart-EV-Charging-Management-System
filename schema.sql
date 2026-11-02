-- ================================================================
-- Smart EV Charging & Energy Management System - DDL
-- Name : Akash MP
-- SRN  : PES1UG24CS040
-- Class: 5A
-- ================================================================

-- Drop tables in reverse dependency order (child -> parent)
DROP TABLE IF EXISTS PAYMENT;
DROP TABLE IF EXISTS CHARGING_SESSION;
DROP TABLE IF EXISTS STATION_ENERGY_SOURCE;
DROP TABLE IF EXISTS CHARGING_POINT;
DROP TABLE IF EXISTS TARIFF_PLAN;
DROP TABLE IF EXISTS ENERGY_SOURCE;
DROP TABLE IF EXISTS CHARGING_STATION;
DROP TABLE IF EXISTS VEHICLE;
DROP TABLE IF EXISTS USER;

-- ================================================================
-- 1. Strong Entities
-- ================================================================

-- USER Entity
CREATE TABLE USER (
    user_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15),
    address VARCHAR(255)
);

-- CHARGING_STATION Entity
CREATE TABLE CHARGING_STATION (
    station_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255) NOT NULL,
    total_slots INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active'
);

-- ENERGY_SOURCE Entity
CREATE TABLE ENERGY_SOURCE (
    source_id INT PRIMARY KEY AUTO_INCREMENT,
    source_type VARCHAR(30) NOT NULL,
    capacity_kw DECIMAL(8,2) NOT NULL
);

-- TARIFF_PLAN Entity
CREATE TABLE TARIFF_PLAN (
    plan_id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(50) NOT NULL,
    rate_per_kwh DECIMAL(5,2) NOT NULL
);

-- ================================================================
-- 2. Entities with 1:N Relationships
-- ================================================================

-- VEHICLE Entity (User 1:N Vehicle)
CREATE TABLE VEHICLE (
    vehicle_id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_number VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(50) NOT NULL,
    battery_capacity DECIMAL(6,2) NOT NULL,
    user_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE
);

-- CHARGING_POINT Entity (Charging_Station 1:N Charging_Point)
CREATE TABLE CHARGING_POINT (
    point_id INT PRIMARY KEY AUTO_INCREMENT,
    connector_type VARCHAR(30) NOT NULL,
    power_rating_kw DECIMAL(6,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'available',
    station_id INT NOT NULL,
    FOREIGN KEY (station_id) REFERENCES CHARGING_STATION(station_id) ON DELETE CASCADE
);

-- ================================================================
-- 3. M:N Junction Table
-- CHARGING_STATION <-> ENERGY_SOURCE (SUPPLIES)
-- ================================================================

CREATE TABLE STATION_ENERGY_SOURCE (
    station_id INT NOT NULL,
    source_id INT NOT NULL,
    allocation_pct DECIMAL(5,2) NOT NULL,
    PRIMARY KEY (station_id, source_id),
    FOREIGN KEY (station_id) REFERENCES CHARGING_STATION(station_id) ON DELETE CASCADE,
    FOREIGN KEY (source_id) REFERENCES ENERGY_SOURCE(source_id) ON DELETE CASCADE
);

-- ================================================================
-- 4. CHARGING_SESSION (Absorbs INITIATES, CHARGES, OCCURS_AT, FOLLOWS)
-- ================================================================

CREATE TABLE CHARGING_SESSION (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    energy_consumed_kwh DECIMAL(7,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'ongoing',
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    point_id INT NOT NULL,
    plan_id INT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES VEHICLE(vehicle_id) ON DELETE CASCADE,
    FOREIGN KEY (point_id) REFERENCES CHARGING_POINT(point_id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES TARIFF_PLAN(plan_id) ON DELETE CASCADE
);

-- ================================================================
-- 5. PAYMENT (Dependent Entity: Charging_Session 1:1 Payment)
-- ================================================================

CREATE TABLE PAYMENT (
    payment_id INT PRIMARY KEY AUTO_INCREMENT,
    amount DECIMAL(8,2) NOT NULL,
    payment_date DATE DEFAULT (CURRENT_DATE),
    payment_method VARCHAR(20) NOT NULL,
    session_id INT NOT NULL UNIQUE,
    FOREIGN KEY (session_id) REFERENCES CHARGING_SESSION(session_id) ON DELETE CASCADE
);

-- ================================================================
-- 6. Indexes for Performance & Common Lookups
-- ================================================================

CREATE INDEX idx_session_user ON CHARGING_SESSION(user_id);
CREATE INDEX idx_session_status ON CHARGING_SESSION(status);
CREATE INDEX idx_payment_session ON PAYMENT(session_id);
CREATE INDEX idx_point_station ON CHARGING_POINT(station_id);

-- ================================================================
-- 7. ALTER TABLE Statements
-- ================================================================

ALTER TABLE CHARGING_STATION
ADD COLUMN contact_number VARCHAR(15);
