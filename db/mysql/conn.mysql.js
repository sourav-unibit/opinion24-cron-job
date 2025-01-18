const mysql = require("mysql2");

// Create a connection to the database
const connection = mysql.createPool({
  connectionLimit: process.env.DB_MAIN_POOL_SIZE,
  host: process.env.DB_MAIN_HOST,
  user: process.env.DB_MAIN_USER,
  password: process.env.DB_MAIN_PASSWORD,
  database: process.env.DB_MAIN_DATABASE,
  port: process.env.DB_MAIN_PORT,
});

module.exports = connection;