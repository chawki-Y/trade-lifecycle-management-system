# Project Walkthrough: Trade Processing System

This document explains the Trade Processing System as if you built it and need to defend it in an interview. It covers the business purpose, technical flow, source files, API design, database design, business logic, interview talking points, and future improvements.

## 1. Project Purpose

### What Problem This App Solves

The app solves a simplified version of a common financial operations problem: capturing trades, generating controlled trade IDs, validating trades against reference data, calculating profit and loss, storing the results, and reporting on trade activity.

Instead of manually inserting trade records into a database, users can enter trades through a dashboard. The instrument is selected from a PostgreSQL-backed reference table, which is closer to how real financial systems control valid products. The backend applies business rules, calculates P&L, and stores both valid and rejected trades in PostgreSQL. The dashboard then shows trade history and summary metrics.

### Why Trade Processing Matters

In capital markets, a trade is not just a row of data. It usually moves through several operational steps:

- Capture: record the trade details.
- Validation: check that the trade is complete and economically valid.
- Enrichment/calculation: calculate values such as P&L, fees, risk, or settlement amounts.
- Storage: persist the trade for audit, reporting, and downstream systems.
- Reporting: show operational teams what happened and what needs attention.

Bad trade data can cause incorrect reports, settlement issues, risk errors, or financial loss. That is why validation, auditability, and reporting matter.

### Relation to Fintech, Banking, and Murex-Style Systems

Systems such as Murex, Calypso, and other banking platforms handle trade capture, lifecycle management, risk, P&L, and reporting at a much larger scale. This project is not a full trading platform, but it demonstrates the same core ideas in a simplified way:

- Trades are captured through a user interface.
- Instruments are controlled through reference data.
- Backend rules decide whether a trade is valid.
- Financial logic calculates P&L.
- A relational database stores trade records.
- Reports summarize business activity.

In an interview, you can describe this as a mini capital markets workflow that shows you understand both backend engineering and financial operations concepts.

## 2. End-to-End Flow

When a user creates a trade from the frontend, this is what happens:

1. The user opens the dashboard at `/`.
2. `public/app.js` calls `GET /api/instruments`.
3. The backend reads active instruments from the PostgreSQL `instruments` reference table.
4. The frontend populates the instrument dropdown with valid symbols.
5. The user fills the trade form with selected instrument, trade type, quantity, trade price, market price, and trade date.
6. `public/app.js` listens for the form submission.
7. The frontend builds a JSON payload matching the backend API contract.
8. The frontend sends a `POST /api/trades` request using `fetch`.
9. Express receives the request in `src/server.js`.
10. The request is routed through `src/routes/tradeRoutes.js`.
11. `createTrade` in `src/controllers/tradeController.js` handles the request.
12. The controller calls `validateTrade` from `src/services/validationService.js`.
13. If basic validation passes, the controller checks that the instrument exists and is active in the `instruments` table.
14. If validation fails, the trade is marked `REJECTED` and given a rejection reason.
15. If validation passes, the controller calls `calculatePnL` from `src/services/pnlService.js`.
16. The controller generates a trade ID using the pattern `TRD-YYYYMMDD-000001`, where `YYYYMMDD` comes from the trade date and the final number comes from a PostgreSQL sequence.
17. The controller inserts the trade into PostgreSQL using a parameterized query.
18. The backend returns a JSON response with message, generated trade ID, status, P&L, and rejection reason.
19. The frontend shows the result message to the user.
20. The frontend refreshes the dashboard by calling:
    - `GET /api/trades/report`
    - `GET /api/trades`
21. The summary metrics and latest trade table update on screen.

The important point is that the frontend does not calculate or trust business results by itself. The backend validates the submitted instrument against database reference data, calculates P&L, and persists the trade.

## 3. File-by-File Explanation

### `public/index.html`

This is the frontend page served by Express. It defines the dashboard structure:

- Header with the app name and refresh button.
- Summary metric cards for total trades, valid trades, rejected trades, and total P&L.
- Trade capture form with an instrument dropdown.
- Latest trades table.

The form does not ask the user to type a trade ID. The backend generates it so IDs follow a controlled naming standard.

It does not contain business logic. It provides the HTML elements that `app.js` reads from and updates.

### `public/styles.css`

This file controls the visual design and responsive layout.

Key responsibilities:

- Defines a clean, neutral dashboard style.
- Uses CSS grid for metrics and form layout.
- Uses media queries to stack content on smaller phone screens.
- Keeps the trades table horizontally scrollable inside its section so it does not break mobile width.
- Styles valid and rejected statuses differently.

The design is intentionally simple and professional, suitable for an operations dashboard rather than a marketing page.

### `public/app.js`

This is the frontend behavior layer.

Key responsibilities:

- Reads form input.
- Loads active instruments from `GET /api/instruments`.
- Populates the instrument dropdown from PostgreSQL-backed reference data.
- Builds the JSON payload for `POST /api/trades`.
- Sends API requests using `fetch`.
- Loads dashboard metrics from `GET /api/trades/report`.
- Loads trade history from `GET /api/trades`.
- Updates the page without requiring a full reload.
- Shows success/error messages after submissions.

This file connects the user interface to the backend API.

### `src/server.js`

This is the Express application entry point.

Key responsibilities:

- Loads environment variables.
- Creates the Express app.
- Enables CORS.
- Enables JSON request parsing.
- Serves static frontend files from `public/`.
- Serves the dashboard at `/`.
- Registers the trade API routes under `/api/trades`.
- Registers the instrument API routes under `/api/instruments`.
- Starts the server on the configured port.

This file is the bridge between the frontend and backend API.

### `src/config/db.js`

This file configures the PostgreSQL connection.

Key responsibilities:

- Reads database credentials from environment variables.
- Creates a shared PostgreSQL connection pool using `pg`.
- Logs connection and pool errors.
- Exports the pool so controllers can run queries.

Using a pool is better than opening a new connection for every request because it is more efficient and scalable.

### `src/routes/tradeRoutes.js`

This file defines the trade API routes.

Routes:

- `POST /` maps to `createTrade`.
- `GET /` maps to `getTrades`.
- `GET /report` maps to `getTradeReport`.

Because `server.js` mounts this router at `/api/trades`, the final URLs are:

- `POST /api/trades`
- `GET /api/trades`
- `GET /api/trades/report`

This keeps route definitions separate from controller logic.

### `src/routes/instrumentRoutes.js`

This file defines the instrument reference-data route.

Routes:

- `GET /` maps to `getInstruments`.

Because `server.js` mounts this router at `/api/instruments`, the final URL is:

- `GET /api/instruments`

### `src/controllers/instrumentController.js`

This controller reads active instrument reference data from PostgreSQL.

Key responsibilities:

- Query the `instruments` table.
- Return only active instruments.
- Order results by asset class and symbol.
- Return a clean error response if the query fails.

This keeps reference-data retrieval separate from trade-processing logic.

### `src/controllers/tradeController.js`

This is the main backend logic for trade operations.

Key responsibilities:

- Receives API requests.
- Extracts request data.
- Calls validation and P&L services.
- Generates trade IDs from trade date and PostgreSQL sequence values.
- Decides trade status.
- Inserts trades into PostgreSQL.
- Reads trades from PostgreSQL.
- Builds report metrics using SQL aggregation.
- Handles generated trade ID conflicts and server errors.

The controller coordinates the workflow but delegates specific rules to services.

### `src/services/pnlService.js`

This file contains the P&L calculation logic.

It exports `calculatePnL(tradeType, quantity, tradePrice, marketPrice)`.

For a BUY trade:

```text
(Market Price - Trade Price) x Quantity
```

For a SELL trade:

```text
(Trade Price - Market Price) x Quantity
```

The result is rounded to four decimals to align with the database scale.

### `src/services/validationService.js`

This file contains trade validation rules.

It exports `validateTrade(trade)`.

It checks:

- `instrument` exists.
- `tradeType` is BUY or SELL.
- `quantity` is greater than 0.
- `tradePrice` is greater than 0.
- `marketPrice` is greater than 0.
- `tradeDate` exists.

It returns a rejection reason string if invalid, or `null` if valid.

Instrument existence is then checked in the controller against the PostgreSQL `instruments` table because that check requires a database query. Trade ID is not validated from user input because the backend generates it.

### `database.sql`

This file defines the PostgreSQL table structure.

It creates the `instruments` table, the `trade_id_sequence`, and the `trades` table if they do not already exist. It also seeds sample active instruments such as FX pairs, equities, gold, and Bitcoin. The `trades` table stores trade details, calculated P&L, validation status, rejection reason, and creation timestamp.

It is useful for setting up the database on a new machine.

### `package.json`

This file defines the Node.js project metadata, scripts, and dependencies.

Important scripts:

- `npm run dev`: starts the app with nodemon.
- `npm start`: starts the app with Node.

Important dependencies:

- `express`: backend web framework.
- `pg`: PostgreSQL driver.
- `dotenv`: loads `.env` variables.
- `cors`: allows cross-origin API access.
- `nodemon`: restarts the server during development.

### `.env.example`

This file shows the environment variables needed to run the project:

- App port.
- PostgreSQL user.
- PostgreSQL password placeholder.
- PostgreSQL host.
- Database name.
- Database port.

The real `.env` file is not committed because it contains local secrets.

### `.gitignore`

This file tells Git what not to commit.

It excludes:

- `node_modules/`
- `.env`
- npm debug logs

This prevents uploading dependencies and local secrets to GitHub.

### `README.md`

This is the public project overview for GitHub.

It briefly explains:

- What the app does.
- Its purpose.
- Features.
- Tech stack.
- API endpoints.
- P&L formula.
- Project structure.

`README.md` is for recruiters or visitors. `PROJECT_WALKTHROUGH.md` is for deeper interview preparation.

## 4. API Explanation

### POST `/api/trades`

#### Purpose

Creates a new trade, validates it, calculates P&L if valid, stores it in PostgreSQL, and returns the processing result.

#### Request Body

```json
{
  "instrument": "AAPL",
  "tradeType": "BUY",
  "quantity": 100,
  "tradePrice": 180.25,
  "marketPrice": 184.10,
  "tradeDate": "2026-06-21"
}
```

#### Backend Function Called

`createTrade` in `src/controllers/tradeController.js`.

#### Database Action

Before inserting, the backend checks the selected instrument against the `instruments` table:

```sql
SELECT 1
FROM instruments
WHERE symbol = $1
  AND is_active = TRUE
LIMIT 1
```

If the instrument does not exist or is inactive, the trade is rejected with:

```text
Invalid or inactive instrument
```

Then the controller runs an `INSERT INTO trades (...) VALUES (...)` query using PostgreSQL placeholders `$1` through `$10`.

This stores:

- Trade details
- Backend-generated trade ID
- Calculated P&L
- Status: `VALID` or `REJECTED`
- Rejection reason if invalid

#### Example Response

Valid trade:

```json
{
  "message": "Trade captured successfully",
  "tradeId": "TRD-20260621-000001",
  "status": "VALID",
  "pnl": 385,
  "rejectionReason": null
}
```

Rejected trade:

```json
{
  "message": "Trade rejected and stored",
  "tradeId": "TRD-20260621-000002",
  "status": "REJECTED",
  "pnl": 0,
  "rejectionReason": "tradeType must be BUY or SELL"
}
```

Duplicate trade:

```json
{
  "message": "TradeId already exists",
  "tradeId": "TRD-20260621-000003",
  "status": "REJECTED",
  "pnl": 0,
  "rejectionReason": "Duplicate tradeId"
}
```

### GET `/api/trades`

#### Purpose

Returns all saved trades, newest first.

#### Request Body

No request body.

#### Backend Function Called

`getTrades` in `src/controllers/tradeController.js`.

#### Database Query

Runs a `SELECT` query from the `trades` table:

```sql
SELECT ...
FROM trades
ORDER BY created_at DESC
```

The query aliases snake_case database columns into frontend-friendly names such as `TradeId`, `TradeType`, and `CreatedAt`.

#### Example Response

```json
[
  {
    "Id": 1,
    "TradeId": "TRD-20260621-000001",
    "Instrument": "AAPL",
    "TradeType": "BUY",
    "Quantity": "100.00",
    "TradePrice": "180.2500",
    "MarketPrice": "184.1000",
    "PnL": "385.0000",
    "TradeDate": "2026-06-21T00:00:00.000Z",
    "Status": "VALID",
    "RejectionReason": null,
    "CreatedAt": "2026-06-21T10:15:00.000Z"
  }
]
```

### GET `/api/trades/report`

#### Purpose

Returns aggregate reporting metrics for the dashboard.

#### Request Body

No request body.

#### Backend Function Called

`getTradeReport` in `src/controllers/tradeController.js`.

#### Database Query

Runs an aggregate SQL query:

- `COUNT(*)` for total trades.
- `SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END)` for valid trades.
- `SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END)` for rejected trades.
- `SUM(CASE WHEN status = 'VALID' THEN pnl ELSE 0 END)` for valid-trade P&L only.

`COALESCE` is used so an empty table returns `0` instead of `null`.

#### Example Response

```json
{
  "TotalTrades": 4,
  "ValidTrades": 4,
  "RejectedTrades": 0,
  "TotalPnL": "835.0000"
}
```

### GET `/api/instruments`

#### Purpose

Returns active instruments from PostgreSQL reference data. The frontend uses this endpoint to populate the instrument dropdown.

#### Request Body

No request body.

#### Backend Function Called

`getInstruments` in `src/controllers/instrumentController.js`.

#### Database Query

Runs a `SELECT` query from the `instruments` table:

```sql
SELECT id, symbol, name, asset_class, currency
FROM instruments
WHERE is_active = TRUE
ORDER BY asset_class, symbol
```

#### Example Response

```json
[
  {
    "id": 1,
    "symbol": "EUR/USD",
    "name": "Euro vs US Dollar",
    "asset_class": "FX",
    "currency": "USD"
  }
]
```

## 5. Database Explanation

### PostgreSQL Role in the Project

PostgreSQL is the persistent storage layer. It stores all captured trades so the application can:

- Maintain instrument reference data.
- Show trade history.
- Produce reports.
- Preserve valid and rejected records.
- Avoid losing data when the server restarts.

The backend uses the `pg` package to communicate with PostgreSQL.

### Why Reference Data Matters

Reference data is controlled master data used by financial systems. Instruments, currencies, counterparties, books, and calendars are common examples.

For this project, the `instruments` table defines which products users are allowed to trade. This prevents users from entering random symbols and makes the application closer to real trading systems, where a trade must reference a known, active product.

Frontend dropdown validation improves user experience, but backend validation is still required. A user can bypass the browser using Postman, curl, or another client. That is why the controller checks the selected instrument against PostgreSQL before accepting the trade.

### `instruments` Table Columns

#### `id`

Auto-generated primary key for the instrument record.

#### `symbol`

The unique tradeable symbol, such as `EUR/USD`, `AAPL`, or `BTC/USD`.

#### `name`

Readable instrument name, such as `Apple Inc.` or `Euro vs US Dollar`.

#### `asset_class`

Groups instruments into business categories such as FX, Equity, Commodity, or Crypto.

#### `currency`

The main currency used for the instrument.

#### `is_active`

Controls whether the instrument can currently be selected and traded. Inactive instruments are hidden from the dropdown and rejected by the backend.

#### `created_at`

Timestamp showing when the instrument record was created.

### `trades` Table Columns

#### `id`

Auto-generated primary key. It uniquely identifies each database row.

#### `trade_id`

Business identifier for the trade. It is generated by the backend using the pattern `TRD-YYYYMMDD-000001`. The date portion comes from `trade_date`, and the sequence portion comes from PostgreSQL. It is unique because the column has a unique constraint.

#### `instrument`

The traded product or symbol, such as `AAPL`, `EUR/USD`, or another financial instrument. The backend validates this value against the active `instruments` reference table.

#### `trade_type`

The direction of the trade. In this project it can be `BUY`, `SELL`, or an invalid value stored for rejected captures.

#### `quantity`

The number of units traded. It must be greater than zero for a valid trade.

#### `trade_price`

The price at which the trade was executed.

#### `market_price`

The current market/reference price used to calculate P&L.

#### `pnl`

The calculated profit or loss. Valid trades have calculated P&L. Rejected trades are stored with P&L of `0`.

#### `trade_date`

The date the trade happened.

#### `status`

Shows whether the trade passed validation:

- `VALID`
- `REJECTED`

#### `rejection_reason`

Explains why a trade was rejected. It is `NULL` for valid trades.

#### `created_at`

Timestamp showing when the trade was inserted into the database.

### How Valid and Rejected Trades Are Stored

Valid trades are stored with:

- `status = 'VALID'`
- calculated P&L
- `rejection_reason = NULL`

Rejected trades are stored with:

- `status = 'REJECTED'`
- `pnl = 0`
- a rejection reason

Storing rejected trades is useful because operations teams often need to know not only what succeeded, but also what failed and why.

### How Reports Are Calculated

The report endpoint uses SQL aggregation:

- Counts all rows for total trades.
- Counts rows where status is `VALID`.
- Counts rows where status is `REJECTED`.
- Sums P&L only for valid trades.

This is efficient because PostgreSQL performs the aggregation instead of the application loading all rows and calculating totals manually.

## 6. Business Logic Explanation

### Trade Validation Rules

The validation service checks that:

- Instrument is present.
- Instrument exists in the active PostgreSQL reference-data table.
- Trade type is either BUY or SELL.
- Quantity is greater than zero.
- Trade price is greater than zero.
- Market price is greater than zero.
- Trade date is present.

If any rule fails, the function returns the first rejection reason. If all rules pass, it returns `null`.

The active instrument check is intentionally done on the backend. Even though the frontend dropdown only shows valid instruments, users can bypass the UI and call the API directly.

### BUY P&L Formula

```text
(Market Price - Trade Price) x Quantity
```

For a BUY trade, profit happens when the current market price is higher than the trade price.

Example:

```text
Trade Price = 180.25
Market Price = 184.10
Quantity = 100
P&L = (184.10 - 180.25) x 100 = 385
```

### SELL P&L Formula

```text
(Trade Price - Market Price) x Quantity
```

For a SELL trade, profit happens when the trade was sold at a higher price than the current market price.

Example:

```text
Trade Price = 184.10
Market Price = 180.25
Quantity = 100
P&L = (184.10 - 180.25) x 100 = 385
```

### Difference Between Trade Price and Market Price

The trade price is the execution price: the price at which the trade happened.

The market price is the current/reference price used to value the trade after execution.

P&L measures the economic difference between the trade price and the market price, adjusted for whether the trade is a BUY or SELL.

### What Valid and Rejected Status Means

`VALID` means the trade passed all business validation rules and the app calculated P&L.

`REJECTED` means the trade failed at least one validation rule. The record is still stored with a reason so the issue can be reviewed.

## 7. How to Explain This Project in an Interview

### 30-Second Explanation

I built a full-stack trade-processing system using Node.js, Express, PostgreSQL, and a simple JavaScript frontend. Users can select valid instruments from PostgreSQL reference data, enter trades, and the backend validates the data, calculates BUY/SELL P&L, stores the trade with a valid or rejected status, and exposes reporting metrics on a dashboard. The project demonstrates REST API design, SQL storage, reference-data validation, business rules, and financial calculation logic.

### 2-Minute Explanation

This project simulates a simplified capital markets trade workflow. The frontend provides a dashboard where a user selects an instrument from a dropdown and enters a trade with fields like trade type, quantity, trade price, market price, and trade date.

The dropdown is populated from `GET /api/instruments`, which reads active instruments from PostgreSQL. When the user submits the form, the frontend sends a JSON request to an Express API. The backend controller receives the request, normalizes the trade type, validates required fields and numeric values, checks that the instrument exists and is active in the database, calculates P&L if the trade is valid, and saves the trade into PostgreSQL using a parameterized query.

The system stores both valid and rejected trades. Valid trades include calculated P&L, while rejected trades include a rejection reason. The reporting endpoint uses SQL aggregation to calculate total trades, valid trades, rejected trades, and total P&L for valid trades only. The frontend calls those endpoints and updates the dashboard.

I built it this way to show separation of concerns: routes define API endpoints, controllers handle request flow, services contain business logic, and PostgreSQL handles persistence and reporting.

### Technical Explanation

The app uses Express as the HTTP server, `pg` for PostgreSQL access, and dotenv for configuration. The backend is organized into config, routes, controllers, and services.

The trade creation flow uses a controller-service pattern. `tradeRoutes.js` maps HTTP routes to controller functions. `tradeController.js` orchestrates validation, P&L calculation, and SQL persistence. `validationService.js` keeps validation rules isolated. `pnlService.js` keeps financial calculation logic isolated.

PostgreSQL queries use parameterized placeholders to reduce SQL injection risk. The app also uses PostgreSQL as a reference-data source for instruments, and the backend validates submitted instrument symbols against that table. Reports are calculated with SQL aggregate functions and conditional `CASE` statements. The frontend uses plain HTML, CSS, and JavaScript to keep the UI lightweight and easy to deploy from the same Express server.

### Business/Finance Explanation

From a finance perspective, the app models the first steps of a trade lifecycle. A trade is captured, checked against instrument reference data and basic business rules, valued using market price, and stored for reporting.

For BUY trades, P&L improves when market price rises above trade price. For SELL trades, P&L improves when market price falls below trade price. The report gives an operations-style view of trade volume, rejected records, and total valid P&L.

This is similar in concept to what larger systems in banking do, although real systems add much more: trade amendments, confirmations, settlement, risk, limits, audit logs, approvals, and integration with market data.

## 8. Possible Interview Questions and Strong Answers

### 1. Why did you choose Node.js and Express?

Node.js and Express are lightweight and fast for building REST APIs. Express makes it easy to define routes, parse JSON, serve static frontend files, and organize backend logic into controllers and services.

### 2. Why did you use PostgreSQL?

PostgreSQL is a reliable relational database. Trade data is structured, so a relational database is a good fit. PostgreSQL also supports strong typing, constraints, aggregation, and SQL reporting.

### 3. What is the role of the controller?

The controller coordinates the request flow. It reads request data, calls validation and P&L services, performs database actions, handles errors, and returns HTTP responses.

### 4. Why separate services from controllers?

Services keep business logic separate from HTTP handling. This makes the code easier to test, reuse, and maintain. For example, P&L calculation can be tested without starting the Express server.

### 5. What makes this a REST API?

It exposes resources through HTTP endpoints. `POST /api/trades` creates a trade, `GET /api/trades` reads trades, and `GET /api/trades/report` returns a report resource.

### 6. How do you prevent SQL injection?

The app uses parameterized PostgreSQL queries with `$1`, `$2`, etc. User input is passed separately from the SQL string, so it is not directly concatenated into SQL.

### 7. How are trade IDs generated?

The backend generates trade IDs using the pattern `TRD-YYYYMMDD-000001`. The date comes from the submitted trade date, and the sequence number comes from PostgreSQL. The database still has a unique constraint on `trade_id` as a final safety check.

### 8. Why store rejected trades?

Rejected trades are operationally useful. They show what failed and why. In real financial systems, rejected records help support teams investigate data quality issues and integration problems.

### 9. Why is P&L calculated differently for BUY and SELL?

For BUY trades, profit increases when the market price is higher than the trade price. For SELL trades, profit increases when the trade price is higher than the market price.

### 10. Why does PostgreSQL return numeric values as strings?

The `pg` driver returns `NUMERIC` values as strings by default to preserve decimal precision. This is important for financial data because floating-point numbers can introduce rounding issues.

### 11. How does the dashboard update?

After a trade is submitted, the frontend calls `GET /api/trades/report` and `GET /api/trades`. It then updates metric cards and the trade table without reloading the page.

### 12. What validation rules are implemented?

The app checks required instrument, valid active instrument in PostgreSQL reference data, valid BUY/SELL trade type, quantity greater than zero, prices greater than zero, and required trade date. Trade ID is generated by the backend.

### 13. Why is backend instrument validation required if the frontend has a dropdown?

Frontend validation is only for user experience. A user can bypass the browser and call `POST /api/trades` directly from Postman or curl. The backend must validate the instrument against PostgreSQL to protect data quality.

### 14. What error handling exists?

The API handles generated trade ID conflicts with a `409` response and general database/server failures with a `500` response. The frontend catches failed requests and displays an error message.

### 15. What security improvements would you add?

I would add authentication, role-based authorization, rate limiting, stronger input sanitization, better CORS configuration, HTTPS in production, and secure secret management.

### 16. How would you test this project?

I would add unit tests for validation and P&L services, integration tests for API endpoints, and database tests for insert/report behavior. I would also test generated trade ID format, rejected trade scenarios, inactive instruments, and invalid instrument symbols submitted through Postman.

### 17. Why use a connection pool?

A pool reuses database connections instead of creating a new connection for every request. This improves performance and resource usage.

### 18. How would you improve reporting?

I would add reports by instrument, trade date, status, and daily P&L. I could also add SQL views or stored procedures for more advanced reporting.

### 19. How does this relate to Murex-style systems?

It models a small part of the same workflow: trade capture, reference-data validation, valuation/P&L, persistence, and reporting. Real platforms are much larger, but the core concepts are similar.

### 20. Why serve the frontend from Express?

For this portfolio project, serving the frontend from Express keeps deployment simple. One server hosts both the dashboard and API. In a larger system, the frontend could be a separate React app.

### 21. What is missing for production readiness?

Authentication, audit logging, detailed trade lifecycle states, tests, structured logging, monitoring, deployment configuration, migrations, and stronger error handling.

## 9. Weaknesses and Improvements

### Authentication

Currently, anyone who can access the app can create and view trades. A real system should have login, session/token handling, and role-based permissions.

### Audit Logs

The app stores `created_at`, but it does not store who created a trade, who changed it, or a full history of changes. Real financial systems require strong audit trails.

### CSV Import

Trades must be entered one at a time. A useful improvement would be CSV upload for bulk trade capture, with row-level validation results.

### Trade Lifecycle Statuses

The project only has `VALID` and `REJECTED`. Real systems often include statuses such as:

- Captured
- Validated
- Amended
- Cancelled
- Confirmed
- Settled
- Failed

### Better Error Handling

The API returns basic error messages. A production app should use centralized error handling, structured error codes, logging, and safer production error responses.

### Unit Tests

The project does not yet include automated tests. The best first tests would cover:

- P&L calculation.
- Validation rules.
- Trade creation endpoint.
- Report endpoint.
- Generated trade ID format and uniqueness.

### Deployment

The project runs locally. A production-ready version could be deployed to a cloud platform with managed PostgreSQL, environment variables, HTTPS, and monitoring.

### Stored Procedures or Advanced SQL Reporting

The current report is simple. More advanced reporting could use:

- SQL views.
- Stored procedures.
- Materialized views.
- Instrument-level P&L.
- Date-range filters.
- Daily P&L trend reports.

### Market Data Integration

The user manually enters market price. A stronger version could fetch market prices from an external market data API.

### Frontend Framework

The frontend uses plain JavaScript. That is fine for this project, but a larger dashboard could use React, Vue, or Angular for more complex state management and components.

## 10. Interview Defense Summary

The strongest way to defend this project is to say:

I built a full-stack trade-processing system that models a simplified capital markets workflow. The frontend captures trade input, the backend validates business rules and calculates P&L, PostgreSQL stores both valid and rejected trades, and the dashboard reports trade counts and total valid P&L. I structured the backend with routes, controllers, services, and database config to keep responsibilities clear. The project demonstrates REST API development, SQL persistence, financial business logic, and operational reporting.

If asked what you would improve, be honest:

This is a portfolio version, so I intentionally kept it simple. For production, I would add authentication, audit logging, unit tests, CSV upload, lifecycle statuses, structured logging, deployment configuration, and richer SQL reporting.
