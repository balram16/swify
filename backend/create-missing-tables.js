const { Pool } = require('pg');

const pool = require('./config/db');

async function createMissingTables() {
    try {
        console.log('Creating missing tables for policy system...');
        
        // Update users table with missing columns
        await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS upi_id VARCHAR(50),
            ADD COLUMN IF NOT EXISTS company_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS registration_number VARCHAR(100),
            ADD COLUMN IF NOT EXISTS company_type VARCHAR(50),
            ADD COLUMN IF NOT EXISTS designation VARCHAR(100)
        `);
        console.log('✅ Updated users table schema');
        
        // Create policy_templates table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS policy_templates (
                template_id SERIAL PRIMARY KEY,
                provider_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('Health', 'Vehicle', 'Life', 'Travel', 'Property')),
                coverage_amount DECIMAL(15,2) NOT NULL,
                premium DECIMAL(15,2) NOT NULL,
                insurance_exp_date TIMESTAMP NOT NULL,
                max_claims_per_year INTEGER NOT NULL,
                description TEXT NOT NULL,
                terms_and_conditions TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                blockchain_template_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created policy_templates table');

        // Create policies table (for purchased policies)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS policies (
                policy_id SERIAL PRIMARY KEY,
                policy_number VARCHAR(50) UNIQUE NOT NULL,
                template_id INTEGER REFERENCES policy_templates(template_id) ON DELETE CASCADE,
                holder_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                provider_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                policy_type VARCHAR(50) NOT NULL,
                coverage_amount DECIMAL(15,2) NOT NULL,
                premium DECIMAL(15,2) NOT NULL,
                start_date TIMESTAMP NOT NULL,
                end_date TIMESTAMP NOT NULL,
                status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
                blockchain_policy_id INTEGER,
                blockchain_tx_hash VARCHAR(66),
                purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created policies table');

        // Add columns for comprehensive policies
        await pool.query(`
            ALTER TABLE policies 
            ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
            ADD COLUMN IF NOT EXISTS customer_address TEXT,
            ADD COLUMN IF NOT EXISTS plan_name VARCHAR(255),
            ADD COLUMN IF NOT EXISTS members_count INTEGER,
            ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50)
        `);
        console.log('✅ Updated policies table with comprehensive columns');

        // Create payments table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payments (
                payment_id SERIAL PRIMARY KEY,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                claim_id INTEGER REFERENCES claims(claim_id) ON DELETE SET NULL,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                amount DECIMAL(15,2) NOT NULL,
                payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('premium', 'claim_payout', 'refund')),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
                cashfree_txn_id VARCHAR(100),
                payment_method VARCHAR(50),
                payment_reference VARCHAR(100),
                processed_at TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created payments table');

        // Create notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                notification_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                message TEXT NOT NULL,
                type VARCHAR(50) NOT NULL,
                is_read BOOLEAN DEFAULT FALSE,
                related_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Drop the type constraint if it exists from previous deployments
        try {
            await pool.query('ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;');
        } catch(e) {
            console.log('Constraint might not exist, skipping drop.');
        }
        console.log('✅ Created notifications table (no type constraints)');

        // Create correct audit_log table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                log_id SERIAL PRIMARY KEY,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INTEGER NOT NULL,
                action VARCHAR(50) NOT NULL,
                user_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Created correct audit_log table');

        // Fix claims table schema
        await pool.query(`
            DROP TABLE IF EXISTS claims CASCADE;
            CREATE TABLE claims (
                claim_id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                policy_number VARCHAR(100),
                claim_amount DECIMAL(15,2) NOT NULL,
                approved_amount DECIMAL(15,2),
                incident_description TEXT NOT NULL,
                claim_type VARCHAR(50) NOT NULL,
                claim_status VARCHAR(50) DEFAULT 'pending_review',
                filing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Fixed claims table schema');

        // Create comprehensive policy tables
        await pool.query(`
            CREATE TABLE IF NOT EXISTS policy_beneficiaries (
                beneficiary_id SERIAL PRIMARY KEY,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                relationship VARCHAR(100) NOT NULL,
                age INTEGER,
                gender VARCHAR(20),
                aadhar_number VARCHAR(20),
                date_of_birth DATE,
                is_primary BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS policy_payments (
                payment_id SERIAL PRIMARY KEY,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                payment_type VARCHAR(50) NOT NULL,
                amount DECIMAL(15,2) NOT NULL,
                payment_method VARCHAR(50),
                payment_reference VARCHAR(255),
                status VARCHAR(50) DEFAULT 'pending',
                transaction_id VARCHAR(255),
                payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS policy_documents (
                document_id SERIAL PRIMARY KEY,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                document_type VARCHAR(100) NOT NULL,
                document_name VARCHAR(255) NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                mime_type VARCHAR(100),
                uploaded_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
                uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS policy_claims (
                claim_id SERIAL PRIMARY KEY,
                policy_id INTEGER REFERENCES policies(policy_id) ON DELETE CASCADE,
                claim_number VARCHAR(100),
                claim_type VARCHAR(50),
                claim_amount DECIMAL(15,2),
                incident_date TIMESTAMP,
                claim_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'pending',
                description TEXT
            );
        `);
        console.log('✅ Created comprehensive policy tables');

        // Create indexes for performance
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policy_templates_provider ON policy_templates(provider_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policy_templates_type ON policy_templates(policy_type)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policy_templates_active ON policy_templates(is_active)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policies_holder ON policies(holder_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policies_provider ON policies(provider_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policies_number ON policies(policy_number)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_policies_status ON policies(status)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_payments_policy ON payments(policy_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read)');
        console.log('✅ Created indexes');

        // Create triggers for updated_at timestamps
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS update_policy_templates_updated_at ON policy_templates;
            CREATE TRIGGER update_policy_templates_updated_at 
                BEFORE UPDATE ON policy_templates 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);

        await pool.query(`
            DROP TRIGGER IF EXISTS update_policies_updated_at ON policies;
            CREATE TRIGGER update_policies_updated_at 
                BEFORE UPDATE ON policies 
                FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
        `);
        console.log('✅ Created triggers');

        console.log('\n🎉 Database setup completed successfully!');
        
        // Test the new tables
        const result = await pool.query('SELECT COUNT(*) as count FROM policy_templates');
        console.log('✅ Policy templates table is ready (count:', result.rows[0].count, ')');
        
    } catch (error) {
        console.error('❌ Error creating tables:', error.message);
        console.error('Full error:', error);
    } finally {
        await pool.end();
    }
}

createMissingTables();
