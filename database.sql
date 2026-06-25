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
    last_price_updated_at TIMESTAMP NULL,
    market_data_source VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_prices (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(50) UNIQUE NOT NULL,
    market_price NUMERIC(18,6) NOT NULL,
    source VARCHAR(50),
    provider_timestamp TIMESTAMP NULL,
    last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    stale BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS last_price_updated_at TIMESTAMP NULL;

ALTER TABLE trades
ADD COLUMN IF NOT EXISTS market_data_source VARCHAR(50);

-- Reset and seed demo trade data.
-- This clears old local test trades but keeps the instrument reference data above.
DELETE FROM trades;
DELETE FROM audit_logs;

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
    rejection_reason,
    last_price_updated_at,
    market_data_source
)
VALUES
    ('TRD-20260621-000001', 'EUR/USD', 'BUY', 100000.00, 1.0800, 1.0825, 250.0000, '2026-06-21', 'BOOKED', NULL, CURRENT_TIMESTAMP, 'seed'),
    ('TRD-20260621-000002', 'AAPL', 'BUY', 50.00, 180.2500, 184.1000, 192.5000, '2026-06-21', 'BOOKED', NULL, CURRENT_TIMESTAMP, 'seed'),
    ('TRD-20260621-000003', 'MSFT', 'SELL', 40.00, 410.7500, 407.5000, 130.0000, '2026-06-21', 'BOOKED', NULL, CURRENT_TIMESTAMP, 'seed'),
    ('TRD-20260621-000004', 'XAU/USD', 'BUY', 10.00, 2320.0000, 2335.5000, 155.0000, '2026-06-21', 'BOOKED', NULL, CURRENT_TIMESTAMP, 'seed'),
    ('TRD-20260621-000005', 'TSLA', 'BUY', 0.00, 250.0000, 252.0000, 0.0000, '2026-06-21', 'REJECTED', 'quantity must be greater than 0', NULL, 'seed');

SELECT setval('trade_id_sequence', 5, TRUE);

INSERT INTO audit_logs (event_type, entity_type, entity_id, description)
VALUES
    ('TRADE_VALIDATED', 'TRADE', 'TRD-20260621-000001', 'Seed trade TRD-20260621-000001 passed validation checks.'),
    ('TRADE_BOOKED', 'TRADE', 'TRD-20260621-000001', 'Seed trade TRD-20260621-000001 was booked.'),
    ('TRADE_VALIDATED', 'TRADE', 'TRD-20260621-000002', 'Seed trade TRD-20260621-000002 passed validation checks.'),
    ('TRADE_BOOKED', 'TRADE', 'TRD-20260621-000002', 'Seed trade TRD-20260621-000002 was booked.'),
    ('TRADE_VALIDATED', 'TRADE', 'TRD-20260621-000003', 'Seed trade TRD-20260621-000003 passed validation checks.'),
    ('TRADE_BOOKED', 'TRADE', 'TRD-20260621-000003', 'Seed trade TRD-20260621-000003 was booked.'),
    ('TRADE_VALIDATED', 'TRADE', 'TRD-20260621-000004', 'Seed trade TRD-20260621-000004 passed validation checks.'),
    ('TRADE_BOOKED', 'TRADE', 'TRD-20260621-000004', 'Seed trade TRD-20260621-000004 was booked.'),
    ('TRADE_REJECTED', 'TRADE', 'TRD-20260621-000005', 'Seed trade TRD-20260621-000005 was rejected: quantity must be greater than 0.');
