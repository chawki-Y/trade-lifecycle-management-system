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
