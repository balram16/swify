const { Pool } = require('pg');
const pool = new Pool({ user:'postgres', host:'localhost', database:'swiftclaim-actual', password:'balram16', port:5432 });

async function setup() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS claim_requests (
        claim_id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
        policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
        claim_amount DECIMAL(15,2) NOT NULL,
        incident_description TEXT NOT NULL,
        claim_type VARCHAR(50) DEFAULT 'general',
        claim_status VARCHAR(20) DEFAULT 'pending' CHECK (claim_status IN ('pending','approved','rejected','paid')),
        approved_amount DECIMAL(15,2),
        processing_notes TEXT,
        filing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('claim_requests table created/verified OK');
    const r = await pool.query('SELECT COUNT(*) as c FROM claim_requests');
    console.log('Existing claims:', r.rows[0].c);
    const p = await pool.query('SELECT COUNT(*) as c FROM policies');
    console.log('Existing policies:', p.rows[0].c);
  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
setup();
