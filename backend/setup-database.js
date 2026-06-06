const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = require('./config/db');

async function setupDatabase() {
    try {
        console.log('Setting up database schema...');
        
        // Read the schema file
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        // Execute the schema
        await pool.query(schema);
        
        console.log('✅ Database schema created successfully!');
        
        // Test the connection
        const result = await pool.query('SELECT NOW()');
        console.log('✅ Database connection test successful:', result.rows[0].now);
        
    } catch (error) {
        console.error('❌ Error setting up database:', error.message);
        console.error('Full error:', error);
    } finally {
        await pool.end();
    }
}

setupDatabase();
