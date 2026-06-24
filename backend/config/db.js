const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL (for cloud: Neon/Render) or individual vars (for local)
const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1')
                  ? false
                  : { rejectUnauthorized: false },
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
