# Trade Processing System

A full-stack mini trade-processing system that simulates a simplified capital markets workflow.

The application allows users to enter financial trades, select valid instruments from PostgreSQL reference data, validate trade data, calculate profit/loss, store trades in PostgreSQL, and view trade reporting metrics from a simple dashboard.

## Purpose

This project was built to demonstrate backend API development, SQL/database design, business rule validation, financial calculation logic, and reporting - concepts commonly found in banking, ERP, and financial technology systems.

## Features

- Create financial trades
- Load active instruments from a PostgreSQL reference table
- Select instruments from a frontend dropdown
- Validate trade input data
- Validate submitted instruments against backend reference data
- Calculate P&L for BUY and SELL trades
- Store trade records in PostgreSQL
- Display trade history
- Show reporting dashboard with total trades, valid trades, rejected trades, and total P&L
- Responsive frontend for laptop and mobile

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- HTML
- CSS
- JavaScript

## API Endpoints

### POST `/api/trades`

Creates a trade, validates it, calculates P&L, and saves it to the database.

### GET `/api/trades`

Returns all saved trades.

### GET `/api/trades/report`

Returns trade reporting metrics:

- Total trades
- Valid trades
- Rejected trades
- Total P&L

### GET `/api/instruments`

Returns active instruments from the PostgreSQL reference table.

The frontend uses this endpoint to populate the instrument dropdown. The backend also validates submitted instruments against the same table, which simulates instrument/reference-data validation used in financial and trading systems.

## P&L Formula

BUY:

```text
(Market Price - Trade Price) x Quantity
```

SELL:

```text
(Trade Price - Market Price) x Quantity
```

## Project Structure

```text
trade-processing-system/
|-- public/
|   |-- index.html
|   |-- styles.css
|   `-- app.js
|-- src/
|   |-- config/
|   |   `-- db.js
|   |-- controllers/
|   |   |-- instrumentController.js
|   |   `-- tradeController.js
|   |-- routes/
|   |   |-- instrumentRoutes.js
|   |   `-- tradeRoutes.js
|   |-- services/
|   |   |-- pnlService.js
|   |   `-- validationService.js
|   `-- server.js
|-- database.sql
|-- package.json
|-- .env.example
|-- .gitignore
`-- README.md
```
