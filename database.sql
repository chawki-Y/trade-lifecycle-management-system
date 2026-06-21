-- First create the database if it does not exist:
-- CREATE DATABASE trade_processing_db;
--
-- Then connect to trade_processing_db before running this table script.

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
