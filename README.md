# Smart EV Charging & Energy Management System

A web-based Electric Vehicle (EV) Charging Station and Energy Management System developed as a Database Management Systems (DBMS) laboratory project. The application manages charging stations, points, user sessions, vehicles, energy allocations, automated billing calculations, and secure administrator access using a MySQL relational database backend.

## Objectives

- Manage EV charging infrastructure, connector points, and renewable energy allocations.
- Maintain relational integrity and prevent double-booking during active charging sessions.
- Provide automated billing calculations based on energy consumption and tariff plans.
- Deliver station revenue analytics and user charging history through relational queries and database views.
- Provide secure administrator-only authentication with database-backed sessions, CSRF protection, and brute-force mitigation.

## Technologies Used

- **Frontend & Backend:** Next.js 14 (App Router, JavaScript), React
- **Styling:** Tailwind CSS
- **Database:** MySQL 8.0
- **Database Driver:** `mysql2/promise` (connection pooling, parameterized SQL, and ACID transactions)
- **Security & Authentication:** `bcryptjs` (salted password hashing), Node.js `crypto` (SHA-256 session token hashing, CSRF origin verification)

## Main Features

1. **User Management (M1):** Register, view, search, update, and manage EV driver accounts with email uniqueness checks.
2. **Vehicle Management (M2):** Add and manage electric vehicles linked to registered users with unique vehicle numbers.
3. **Station Management (M3):** Monitor charging stations, slot capacities, operational status, and energy source allocations.
4. **Charging Point Management (M4):** Manage charging stalls, connector types (CCS2, Type2, CHAdeMO), power ratings, and availability.
5. **Charging Session Tracking (M5):** Track ongoing and completed charging sessions with concurrency locking to prevent stall double-booking.
6. **Payment Management (M6):** Calculate session costs dynamically using stored functions and maintain a strict 1:1 session-to-payment record.
7. **Charging History (M7):** View user charging history, filter by date and status, and review running totals of user spending.
8. **Revenue Analysis (M8):** Analyze station revenue, delivered energy, and session counts with date range filtering and activity ranking.
9. **Admin Authentication & Access Control:** Admin-exclusive portal with bcrypt password verification, server-side SHA-256 hashed sessions, HTTP-only cookies, brute-force rate limiting, and CSRF protection.

## Database Overview

The system runs on the `smart_ev` database across 12 relational tables:

### Core Charging Management Tables
1. `USER` – Stores customer profile and contact details.
2. `CHARGING_STATION` – Stores charging station locations, slot counts, status, and contact numbers.
3. `ENERGY_SOURCE` – Stores available energy sources (Solar, Grid, Wind) and capacities.
4. `TARIFF_PLAN` – Stores billing plans and rates per kilowatt-hour.
5. `VEHICLE` – Stores vehicles linked to users (1:N relationship).
6. `CHARGING_POINT` – Stores individual charging points at stations (1:N relationship).
7. `STATION_ENERGY_SOURCE` – Stores energy allocation percentages between stations and energy sources (M:N junction).
8. `CHARGING_SESSION` – Stores active and historical charging sessions linked to users, vehicles, points, and plans.
9. `PAYMENT` – Stores payment details for completed charging sessions (1:1 relationship with session).

### Administrator Authentication Tables
10. `admin_users` – Stores administrator credentials with salted bcrypt password hashes.
11. `admin_sessions` – Server-side session store keeping SHA-256 hashed tokens with explicit expiration.
12. `admin_login_attempts` – Records failed login attempts by IP address and normalized email for brute-force rate limiting.

## Project Structure

```
EVDBMS/
├── app/                  # Next.js App Router (pages and API routes)
│   ├── api/              # Backend API route handlers (users, sessions, payments, auth, etc.)
│   │   └── auth/         # Login, logout, and session identity APIs
│   ├── history/          # Charging history page (M7)
│   ├── login/            # Administrator sign-in portal
│   ├── payments/         # Payment management page (M6)
│   ├── points/           # Charging points page (M4)
│   ├── revenue/          # Revenue analysis page (M8)
│   ├── sessions/         # Charging sessions page (M5)
│   ├── stations/         # Station management page (M3)
│   ├── users/            # User management page (M1)
│   ├── vehicles/         # Vehicle management page (M2)
│   └── page.js           # Protected dashboard home page
├── components/           # Reusable UI components (Navbar with admin badge, DataTable, Modals)
├── db/                   # Database scripts (views, functions, triggers, procedures, auth)
│   ├── 01_views.sql      # Database views (v_available_points, v_charging_history, v_station_revenue)
│   ├── 02_functions.sql  # Stored function (fn_session_cost)
│   ├── 03_triggers.sql   # Relational integrity triggers
│   ├── 04_procedures.sql # Stored procedure (sp_station_revenue)
│   ├── 06_admin_auth.sql # Administrator authentication & session tables
│   ├── seed-admin.js     # Administrator seed and safe password update utility
│   ├── setup.js          # Non-destructive additive database setup runner
│   └── test-phase8.js    # Authentication and security test suite
├── lib/                  # DB connection pool (db.js) and Auth/CSRF engine (auth.js)
├── middleware.js         # Edge route guard protecting dashboard and module pages
├── package.json          # Dependencies and scripts
└── README.md             # Project documentation
```

## Installation and Setup

1. **Clone or open the repository folder:**
   ```bash
   cd EVDBMS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Database Setup:**
   - **For a fresh installation:** Create the database in MySQL and import the base schema and sample records:
     ```bash
     mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS smart_ev;"
     mysql -u root -p smart_ev < schema.sql
     mysql -u root -p smart_ev < data.sql
     ```
   - **For an existing database:** If you already have `smart_ev` loaded with tables and sample data, skip this step to avoid overwriting existing data.

4. **Deploy Database Objects:**
   Deploy or refresh views, functions, triggers, procedures, and admin tables:
   ```bash
   npm run db:setup
   ```
   *(Note: `npm run db:setup` is non-destructive and will not modify or drop your existing customer data).*

5. **Provision Administrator Account:**
   Seed the initial administrator account from environment variables:
   ```bash
   npm run db:seed-admin
   ```
   To safely update an existing administrator password from `.env.local`, run:
   ```bash
   npm run db:seed-admin -- --update-password
   ```

## Environment Configuration

Create a `.env.local` file in the project root by copying `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Configure your local MySQL and administrator credentials:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=smart_ev

# Administrator Credentials (Read locally, excluded from Git)
INITIAL_ADMIN_NAME=System Administrator
INITIAL_ADMIN_EMAIL=admin@smartev.com
INITIAL_ADMIN_PASSWORD=your_secure_admin_password_here
```

Administrator credentials are read exclusively from local environment variables and hashed using bcrypt. After setting up `.env.local`, provision the account using `npm run db:seed-admin`.

## Running the Application

- **Development server:**
  ```bash
  npm run dev
  ```
- **Run Phase 8 Security & Auth Test Suite:**
  ```bash
  node db/test-phase8.js
  ```
- **Code linting:**
  ```bash
  npm run lint
  ```
- **Build production bundle:**
  ```bash
  npm run build
  ```
- **Start production server:**
  ```bash
  npm run start
  ```

## Application URL

Once the application is running, open your web browser and visit:

```
http://localhost:3000
```

Unauthenticated requests will automatically redirect to the `/login` portal.
