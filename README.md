# Trade Processing System

A mini financial trade processing backend built with Node.js, Express, and PostgreSQL. The project simulates a common trade lifecycle: trade capture, validation, profit and loss calculation, persistence, and reporting.

This is designed as a Technical Analyst / fintech portfolio project. It demonstrates how backend services can support trade operations workflows with validation rules, audit-friendly storage, calculated financial metrics, and aggregated reporting.

## Why This Project Is Relevant

Financial systems frequently need to capture trades, validate them against business rules, calculate trade-level economics, store normalized records, and provide operational reports. This project models those responsibilities in a compact API that is easy to understand, extend, and discuss in interviews.

The project includes:

- Trade capture through a REST API
- Validation for required fields and valid economic values
- P&L calculation for BUY and SELL trades
- PostgreSQL persistence with parameterized queries
- Reporting for total, valid, rejected, and P&L metrics

## Tech Stack

- Node.js
- Express
- PostgreSQL
- `pg`
- `dotenv`
- `cors`
- `nodemon`

## Architecture

```text
trade-processing-system/
|-- src/
|   |-- config/
|   |   `-- db.js
|   |-- controllers/
|   |   `-- tradeController.js
|   |-- routes/
|   |   `-- tradeRoutes.js
|   |-- services/
|   |   |-- pnlService.js
|   |   `-- validationService.js
|   `-- server.js
|-- .env
|-- database.sql
|-- package.json
`-- README.md
```

## P&L Formula

- BUY: `(Market Price - Trade Price) x Quantity`
- SELL: `(Trade Price - Market Price) x Quantity`

## Getting Started

Install dependencies:

```bash
npm install
```

Create the PostgreSQL database and table using `database.sql`.

Update `.env` with your local PostgreSQL credentials:

```env
PORT=3001
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_DATABASE=trade_processing_db
DB_PORT=5432
```

Run the API in development mode:

```bash
npm run dev
```

Open the frontend dashboard:

```text
http://localhost:3001/
```

Run the API in production mode:

```bash
npm start
```

## PostgreSQL Setup

Option 1: run these commands with `psql`:

```bash
psql -U postgres -c "CREATE DATABASE trade_processing_db;"
psql -U postgres -d trade_processing_db -f database.sql
```

If the database already exists, run only the second command.

Option 2: run the SQL manually in pgAdmin or another PostgreSQL client:

```sql
CREATE DATABASE trade_processing_db;
```

Then connect to `trade_processing_db` and run:

```sql
CREATE TABLE IF NOT EXISTS trades (
    id SERIAL PRIMARY KEY,
    trade_id VARCHAR(50) NOT NULL UNIQUE,
    instrument VARCHAR(50) NOT NULL,
    trade_type VARCHAR(10) NOT NULL,
    quantity NUMERIC(18,2) NOT NULL,
    trade_price NUMERIC(18,4) NOT NULL,
    market_price NUMERIC(18,4) NOT NULL,
    pnl NUMERIC(18,4) NOT NULL,
    trade_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    rejection_reason VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/` | Health check |
| POST | `/api/trades` | Capture, validate, calculate P&L, and store a trade |
| GET | `/api/trades` | Return all trades ordered by newest first |
| GET | `/api/trades/report` | Return aggregate trade reporting metrics |

## Frontend Dashboard

The Express app serves a simple responsive frontend from the `public/` folder. It includes:

- Summary metrics for total trades, valid trades, rejected trades, and total P&L
- Trade capture form
- Latest trades table
- Mobile-friendly layout with horizontal scrolling only inside the table area

To access the app from a phone while it is running locally, expose port `3001` with ngrok:

```bash
ngrok http 3001
```

Then open the generated HTTPS forwarding URL on your phone.

## Example POST Request

```http
POST /api/trades
Content-Type: application/json
```

```json
{
  "tradeId": "TRD-1001",
  "instrument": "AAPL",
  "tradeType": "BUY",
  "quantity": 100,
  "tradePrice": 180.25,
  "marketPrice": 184.10,
  "tradeDate": "2026-06-21"
}
```

Example response:

```json
{
  "message": "Trade captured successfully",
  "tradeId": "TRD-1001",
  "status": "VALID",
  "pnl": 385,
  "rejectionReason": null
}
```

## Example Rejected Trade

```json
{
  "tradeId": "TRD-1002",
  "instrument": "MSFT",
  "tradeType": "HOLD",
  "quantity": 50,
  "tradePrice": 410.75,
  "marketPrice": 412.20,
  "tradeDate": "2026-06-21"
}
```

Example response:

```json
{
  "message": "Trade rejected and stored",
  "tradeId": "TRD-1002",
  "status": "REJECTED",
  "pnl": 0,
  "rejectionReason": "tradeType must be BUY or SELL"
}
```

## Example Report Response

```json
{
  "TotalTrades": 10,
  "ValidTrades": 8,
  "RejectedTrades": 2,
  "TotalPnL": "1540.7500"
}
```

PostgreSQL returns `NUMERIC` values as strings through the `pg` driver by default. This preserves decimal precision for financial data.

## Notes

- All SQL writes use parameterized queries through the `pg` package.
- Rejected trades are stored with a rejection reason so operational reports can include failed validations.
- `TotalPnL` includes valid trades only.
