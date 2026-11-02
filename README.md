# Smart EV Charging & Energy Management System

A web-based Electric Vehicle (EV) Charging Station and Energy Management System developed as a Database Management Systems (DBMS) laboratory project. The application manages charging stations, points, user sessions, vehicles, energy allocations, and payment calculations using a relational database backend.

## Objectives

- Manage EV charging infrastructure, connector points, and renewable energy allocations.
- Maintain relational integrity and prevent double-booking during active charging sessions.
- Provide automated billing calculations based on energy consumption and tariff plans.
- Deliver station revenue analytics and user charging history through relational queries and database views.

## Technologies Used

- **Frontend & Backend:** Next.js 14 (App Router, JavaScript), React
- **Styling:** Tailwind CSS
- **Database:** MySQL 8.0
- **Database Driver:** `mysql2/promise` (connection pooling and parameterized SQL)

## Main Features

1. **User Management (M1):** Register, view, search, update, and manage EV driver accounts with email uniqueness checks.
2. **Vehicle Management (M2):** Add and manage electric vehicles linked to registered users with unique vehicle numbers.
3. **Station Management (M3):** Monitor charging stations, slot capacities, operational status, and energy source allocations.
4. **Charging Point Management (M4):** Manage charging stalls, connector types (CCS2, Type2, CHAdeMO), power ratings, and availability.
5. **Charging Session Tracking (M5):** Track ongoing and completed charging sessions with concurrency locking to prevent stall double-booking.
6. **Payment Management (M6):** Calculate session costs dynamically using stored functions and maintain a strict 1:1 session-to-payment record.
7. **Charging History (M7):** View user charging history, filter by date and status, and review running totals of user spending.
8. **Revenue Analysis (M8):** Analyze station revenue, delivered energy, and session counts with date range filtering and activity ranking.

## Database Overview

The system uses nine relational tables in the `smart_ev` database:

1. `USER` – Stores user profile and contact details.
2. `CHARGING_STATION` – Stores charging station locations, slot counts, status, and contact numbers.
3. `ENERGY_SOURCE` – Stores available energy sources (Solar, Grid, Wind) and capacities.
4. `TARIFF_PLAN` – Stores billing plans and rates per kilowatt-hour.
5. `VEHICLE` – Stores vehicles linked to users (1:N relationship).
6. `CHARGING_POINT` – Stores individual charging points at stations (1:N relationship).
7. `STATION_ENERGY_SOURCE` – Stores energy allocation percentages between stations and energy sources (M:N junction).
8. `CHARGING_SESSION` – Stores active and historical charging sessions linked to users, vehicles, points, and plans.
9. `PAYMENT` – Stores payment details for completed charging sessions (1:1 relationship with session).

## Project Structure

```
EVDBMS/
├── app/                  # Next.js App Router (pages and API routes)
│   ├── api/              # Backend API route handlers (users, sessions, payments, etc.)
│   ├── history/          # Charging history page (M7)
│   ├── payments/         # Payment management page (M6)
│   ├── points/           # Charging points page (M4)
│   ├── revenue/          # Revenue analysis page (M8)
│   ├── sessions/         # Charging sessions page (M5)
│   ├── stations/         # Station management page (M3)
│   ├── users/            # User management page (M1)
│   ├── vehicles/         # Vehicle management page (M2)
│   └── page.js           # Dashboard home page
├── components/           # Reusable UI components (Navbar, Modal, DataTable, etc.)
├── db/                   # Database scripts (views, functions, triggers, procedures)
├── docs/                 # Setup documentation
├── lib/                  # Database connection pool and error helpers
├── data.sql              # Initial sample dataset
├── schema.sql            # Base relational schema DDL
├── package.json          # Dependencies and npm scripts
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
   - **For an existing database:** If you already have `smart_ev` loaded with tables and sample data, skip step 3 to avoid overwriting existing data.

4. **Deploy Database Objects:**
   Deploy or refresh database views, functions, triggers, and stored procedures:
   ```bash
   npm run db:setup
   ```
   *(Note: `npm run db:setup` is non-destructive and will not modify or drop your existing table records).*

## Environment Configuration

Create a `.env.local` file in the project root by copying `.env.local.example`:

```bash
cp .env.local.example .env.local
```

Update `.env.local` with your MySQL connection credentials:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=smart_ev
```

## Running the Application

- **Development server:**
  ```bash
  npm run dev
  ```
- **Build production bundle:**
  ```bash
  npm run build
  ```
- **Start production server:**
  ```bash
  npm run start
  ```
- **Code linting:**
  ```bash
  npm run lint
  ```

## Application URL

Once the application is running, open your web browser and visit:

```
http://localhost:3000
```
