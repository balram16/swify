const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL (for cloud: Neon/Render) or individual vars (for local)
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: { rejectUnauthorized: false }, // Required for Neon.tech / Render hosted DBs
          }
        : {
              user: process.env.DB_USER || 'postgres',
              host: process.env.DB_HOST || 'localhost',
              database: process.env.DB_NAME || 'swiftclaim-actual',
              password: process.env.DB_PASSWORD || 'balram16',
              port: process.env.DB_PORT || 5432,
          }
);

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

module.exports = pool;
