-- First create the database if it does not exist:
-- CREATE DATABASE trade_processing_db;
--
-- Then connect to trade_processing_db before running this table script.

CREATE TABLE IF NOT EXISTS instruments (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    asset_class VARCHAR(50) NOT NULL,
    currency VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO instruments (symbol, name, asset_class, currency)
VALUES
    ('EUR/USD', 'Euro vs US Dollar', 'FX', 'USD'),
    ('GBP/USD', 'British Pound vs US Dollar', 'FX', 'USD'),
    ('USD/JPY', 'US Dollar vs Japanese Yen', 'FX', 'JPY'),
    ('AAPL', 'Apple Inc.', 'Equity', 'USD'),
    ('MSFT', 'Microsoft Corporation', 'Equity', 'USD'),
    ('TSLA', 'Tesla Inc.', 'Equity', 'USD'),
    ('XAU/USD', 'Gold vs US Dollar', 'Commodity', 'USD'),
    ('BTC/USD', 'Bitcoin vs US Dollar', 'Crypto', 'USD')
ON CONFLICT (symbol) DO NOTHING;

CREATE SEQUENCE IF NOT EXISTS trade_id_sequence START 1;

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

-- Reset and seed demo trade data.
-- This clears old local test trades but keeps the instrument reference data above.
DELETE FROM trades;

ALTER SEQUENCE trade_id_sequence RESTART WITH 1;

INSERT INTO trades (
    trade_id,
    instrument,
    trade_type,
    quantity,
    trade_price,
    market_price,
    pnl,
    trade_date,
    status,
    rejection_reason
)
VALUES
    ('TRD-20260621-000001', 'EUR/USD', 'BUY', 100000.00, 1.0800, 1.0825, 250.0000, '2026-06-21', 'VALID', NULL),
    ('TRD-20260621-000002', 'AAPL', 'BUY', 50.00, 180.2500, 184.1000, 192.5000, '2026-06-21', 'VALID', NULL),
    ('TRD-20260621-000003', 'MSFT', 'SELL', 40.00, 410.7500, 407.5000, 130.0000, '2026-06-21', 'VALID', NULL),
    ('TRD-20260621-000004', 'XAU/USD', 'BUY', 10.00, 2320.0000, 2335.5000, 155.0000, '2026-06-21', 'VALID', NULL),
    ('TRD-20260621-000005', 'TSLA', 'BUY', 0.00, 250.0000, 252.0000, 0.0000, '2026-06-21', 'REJECTED', 'quantity must be greater than 0');

SELECT setval('trade_id_sequence', 5, TRUE);
