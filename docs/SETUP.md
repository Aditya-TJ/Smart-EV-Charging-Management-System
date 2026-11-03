# System Setup & Deployment Guide

This guide details the complete, step-by-step procedure for provisioning, configuring, and executing the **Smart EV Charging & Energy Management System** on your local machine.

---

## 1. Software Prerequisites

Before beginning installation, ensure your workstation has the following software installed:

| Software | Minimum Version | Recommended Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | `18.17.0` | `20.x` (LTS) | `node -v` |
| **npm** | `9.0.0` | `10.x+` | `npm -v` |
| **MySQL Server** | `8.0.0` | `8.0.36+` / `8.4+` | `mysql --version` |
| **Git** | `2.20+` | Latest | `git --version` |

---

## 2. MySQL Service Setup

Ensure that the MySQL server daemon is running and listening on port `3306`.

### Windows (PowerShell / Services)
To check the status or start the MySQL service:
```powershell
# Check if MySQL service is running
Get-Service -Name "MySQL*"

# Start service if stopped
Start-Service -Name "MySQL80"
```
*(Alternatively, press `Win + R`, type `services.msc`, locate `MySQL80`, and click **Start**).*

### macOS (Homebrew)
```bash
# Check status
brew services list

# Start MySQL daemon
brew services start mysql
```

### Linux (systemd)
```bash
# Check status
sudo systemctl status mysql

# Start service
sudo systemctl start mysql
```

---

## 3. Database Creation & Configuration

1. Connect to MySQL via the command-line client using an administrative user (typically `root`):
   ```bash
   mysql -u root -p
   ```
   *(Enter your MySQL root password when prompted).*

2. Create the dedicated database `smart_ev`:
   ```sql
   CREATE DATABASE IF NOT EXISTS smart_ev
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

3. *(Optional but Recommended)* Create a dedicated application user:
   ```sql
   CREATE USER IF NOT EXISTS 'ev_admin'@'localhost' IDENTIFIED BY 'your_secure_password';
   GRANT ALL PRIVILEGES ON smart_ev.* TO 'ev_admin'@'localhost';
   FLUSH PRIVILEGES;
   ```

4. Exit the MySQL interactive prompt:
   ```sql
   EXIT;
   ```

5. Schema & Sample Data Setup:
   - **For a Fresh Installation Only:** If setting up the database for the first time, import the base relational schema and sample records:
     ```bash
     # On Windows (PowerShell / Command Prompt) or macOS/Linux:
     mysql -u root -p smart_ev < schema.sql
     mysql -u root -p smart_ev < data.sql
     ```
     > **Important:** The `schema.sql` script creates all 9 base tables, primary keys, foreign keys, constraints, and initial indexes. The `data.sql` script loads the baseline test records.
   - **For an Already-Existing Database:** If the `smart_ev` database already exists and contains your tables and records, **do NOT re-run** `schema.sql` or `data.sql`, as doing so would drop tables and overwrite live data. Proceed directly to configuring `.env.local` and running `npm run db:setup`.

---

## 4. Environment Variable Configuration

The application requires database connection credentials provided via `.env.local`.

1. Copy the provided `.env.local.example` template:
   ```bash
   cp .env.local.example .env.local
   ```

2. Open `.env.local` in your code editor:
   ```ini
   # MySQL Database Configuration
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_mysql_password_here
   DB_NAME=smart_ev
   ```

3. Replace `your_mysql_password_here` with your actual local MySQL password. If you created the custom user `ev_admin`, update `DB_USER` and `DB_PASSWORD` accordingly.

> **Security Note:** Never commit `.env.local` to version control. The repository `.gitignore` automatically excludes this file.

---

## 5. Installing Dependencies

Install the required Node.js runtime dependencies from the project root:

```bash
npm install
```

This installs:
- `next` (v14.2.25)
- `react` & `react-dom` (v18.3.1)
- `mysql2` (v3.12.0)
- `tailwindcss`, `postcss`, and `autoprefixer`
- `eslint` & `eslint-config-next`

---

## 6. Running Database Setup (Additive Objects)

Deploy the views, stored function, triggers, and stored procedure:

```bash
npm run db:setup
```

### What This Command Does:
1. Executes `node db/setup.js`.
2. Connects to `smart_ev` using `.env.local`.
3. Safely parses and applies the 6 approved additive SQL scripts in dependency order:
   - `db/01_views.sql`: Deploys `v_available_points`, `v_charging_history`, and `v_station_revenue`.
   - `db/02_functions.sql`: Deploys `fn_session_cost`.
   - `db/03_triggers.sql`: Deploys `trg_session_bi`, `trg_session_bu`, and `trg_payment_bi`.
   - `db/04_procedures.sql`: Deploys `sp_station_revenue`.
   - `db/05_demo_queries.sql`: Validates viva demo queries against the live schema.
   - `db/06_admin_auth.sql`: Deploys administrator authentication and session tables (`admin_users`, `admin_sessions`, `admin_login_attempts`).

> **Integrity Guarantee:** `npm run db:setup` is strictly non-destructive. It executes only idempotent `CREATE OR REPLACE` and `DROP ... IF EXISTS` statements on routines and views. It does **NOT** truncate tables, modify columns, or alter sample records.

---

## 7. Starting the Next.js Application

### Development Mode (with Fast Refresh)
```bash
npm run dev
```
The server will start on port `3000`.

### Production Build & Launch
To test the compiled production bundle:
```bash
npm run build
npm run start
```

### Code Quality / Linting
To run static analysis:
```bash
npm run lint
```

---

## 8. Opening the Application Locally

1. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```
2. The **Smart EV Charging & Energy Management System** dashboard will load, displaying live database counts:
   - **Users:** 3 (Priya Sharma, Rahul Verma, Sneha Kulkarni)
   - **Vehicles:** 4 (Tata Nexon EV, Hyundai Kona Electric, MG ZS EV, Mahindra XUV400)
   - **Stations:** 3 (Bengaluru, Hyderabad, Chennai hubs)
   - **Charging Points:** 6
   - **Charging Sessions:** 3
   - **Payments:** 3
3. Use the top navigation bar to navigate through all eight modules (M1–M8).
4. Verify backend health by querying the API health check directly in your browser or curl:
   ```
   http://localhost:3000/api/health
   ```
   You should receive a `{"status": "ok", "database": "connected"}` JSON response.

---

## 9. Common Setup Errors & Solutions

### Error 1: `ECONNREFUSED 127.0.0.1:3306`
- **Cause:** The MySQL database server is not running or is listening on a different port.
- **Solution:**
  - Verify the MySQL service is started via `Get-Service MySQL*` (Windows) or `sudo systemctl status mysql` (Linux).
  - Verify port `3306` is open: `netstat -an | findstr 3306` (Windows) or `lsof -i :3306` (macOS/Linux).
  - Verify that `DB_HOST=localhost` and `DB_PORT=3306` are properly set in `.env.local`.

---

### Error 2: `ER_ACCESS_DENIED_ERROR` (Authentication Failed)
- **Cause:** Incorrect username or password specified in `.env.local`.
- **Solution:**
  - Test connecting via command line: `mysql -u root -p -h localhost`.
  - Ensure `.env.local` contains the exact password without surrounding unescaped quotes or extra spaces.
  - If using MySQL 8.0 default `caching_sha2_password` and encountering handshake issues, alter the user authentication plugin:
    ```sql
    ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';
    FLUSH PRIVILEGES;
    ```

---

### Error 3: `ER_BAD_DB_ERROR: Unknown database 'smart_ev'`
- **Cause:** The database was not created prior to running setup scripts.
- **Solution:**
  - Run `CREATE DATABASE smart_ev;` in your MySQL console, then import `schema.sql` and `data.sql` before running `npm run db:setup`.

---

### Error 4: `EPERM: operation not permitted` during `npm run build` (Windows)
- **Cause:** An active background process (such as a running `next dev` instance) holds an exclusive file lock on the `.next/trace` or `.next/cache` directory.
- **Solution:**
  - Stop any running `npm run dev` processes (`Ctrl + C` in terminal or `taskkill /IM node.exe /F` in PowerShell).
  - Re-run `npm run build`.

---

### Error 5: `SyntaxError: DELIMITER` when running custom scripts directly
- **Cause:** `DELIMITER` is a MySQL command-line client directive, not an SQL statement recognized by the MySQL server wire protocol.
- **Solution:**
  - Always deploy stored routines and triggers using `npm run db:setup`. The custom parser in `db/setup.js` strips client delimiter directives and sends complete function and trigger definitions cleanly.

---

### Error 6: Port 3000 Already in Use
- **Cause:** Another application is occupying port `3000`.
- **Solution:**
  - Next.js will automatically prompt to use port `3001` or another available port.
  - Alternatively, identify and terminate the occupying process or start Next.js on an explicit port:
    ```bash
    npm run dev -- -p 3005
    ```
