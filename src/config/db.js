const { Pool } = require("pg");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT) || 5432
};

// A shared connection pool lets every request reuse PostgreSQL connections efficiently.
const pool = new Pool(dbConfig);

pool.on("connect", () => {
  console.log("Connected to PostgreSQL");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL error:", error.message);
});

module.exports = {
  pool
};
