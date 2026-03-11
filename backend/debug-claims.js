const { Pool } = require('pg');
const pool = new Pool({ user:'postgres', host:'localhost', database:'swiftclaim-actual', password:'balram16', port:5432 });

async function run() {
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='claims' ORDER BY ordinal_position"
  );
  console.log('ALL COLUMNS:', cols.rows.map(r => r.column_name).join(', '));
  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
