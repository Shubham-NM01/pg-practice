require("dotenv").config();

const config = {
  db_name: process.env.DB_NAME,
  db_password: process.env.DB_PASSWORD,
  db_host: process.env.DB_HOST,
  db_port: process.env.DB_PORT,
  db_user: process.env.DB_USER || 5432,
};

module.exports = config;