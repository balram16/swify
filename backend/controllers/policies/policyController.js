const { Pool } = require('pg');
const InsuranceService = require('../../services/insuranceService');
const { v4: uuidv4 } = require('uuid');

// Database connection
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'swiftclaim-actual',
    password: process.env.DB_PASSWORD || 'balram16',
    port: process.env.DB_PORT || 5432,
});

// Initialize insurance service
const insuranceService = new InsuranceService(
    process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    process.env.PROVIDER_URL || 'http://localhost:8545'
);

// Connect with signer for write operations
const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
insuranceService.connectSigner(privateKey);

// Create Policy Template (Provider only)
const createPolicyTemplate = async (req, res) => {
    try {
        const {
            policyType,
            coverageAmount,
            premium,
            insuranceExpDate,
            maxClaimsPerYear,
            description,
            termsAndConditions
        } = req.body;

        const providerId = req.user.userId;

        // Validate required fields
        if (!policyType || !coverageAmount || !premium || !insuranceExpDate || !maxClaimsPerYear || !description || !termsAndConditions) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                details: 'All fields are required for policy template creation'
            });
        }

        // Validate policy type
        const validTypes = ['Health', 'Vehicle', 'Life', 'Travel', 'Property'];
        if (!validTypes.includes(policyType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid policy type',
                details: `Policy type must be one of: ${validTypes.join(', ')}`
            });
        }

        // Validate dates
        const expDate = new Date(insuranceExpDate);
        if (expDate <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Invalid expiry date',
                details: 'Insurance expiry date must be in the future'
            });
        }

        // Validate amounts
        if (coverageAmount <= 0 || premium <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amounts',
                details: 'Coverage amount and premium must be greater than zero'
            });
        }

        // Create policy template on blockchain (optional - can be done later)
        let blockchainTemplateId = null;
        let transactionHash = null;
        
        try {
            const blockchainResult = await insuranceService.addPolicyTemplate(
                policyType,
                coverageAmount,
                premium,
                insuranceExpDate,
                maxClaimsPerYear,
                description,
                termsAndConditions
            );
            blockchainTemplateId = blockchainResult.templateId;
            transactionHash = blockchainResult.transactionHash;
        } catch (blockchainError) {
            console.warn('Blockchain operation failed, continuing with database only:', blockchainError.message);
        }

        // Store in database
        const query = `
            INSERT INTO policy_templates (
                provider_id, policy_type, coverage_amount, premium, 
                insurance_exp_date, max_claims_per_year, description, 
                terms_and_conditions, blockchain_template_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;

        const values = [
            providerId,
            policyType,
            coverageAmount,
            premium,
            insuranceExpDate,
            maxClaimsPerYear,
            description,
            termsAndConditions,
            blockchainTemplateId
        ];

        const result = await pool.query(query, values);
        const template = result.rows[0];

        // Create notification
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)',
            [providerId, 'Policy Template Created', `Policy template "${policyType}" created successfully`, 'general', template.template_id]
        );

        res.status(201).json({
            success: true,
            data: {
                templateId: template.template_id,
                blockchainTemplateId: blockchainTemplateId,
                transactionHash: transactionHash,
                ...template
            }
        });

    } catch (error) {
        console.error('Error creating policy template:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create policy template',
            details: error.message
        });
    }
};

// Get All Policy Templates (Public)
const getAllPolicyTemplates = async (req, res) => {
    try {
        const query = `
            SELECT pt.*, u.full_name as provider_name, u.email as provider_email
            FROM policy_templates pt
            JOIN users u ON pt.provider_id = u.user_id
            WHERE pt.is_active = true
            ORDER BY pt.created_at DESC
        `;

        const result = await pool.query(query);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching policy templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch policy templates',
            details: error.message
        });
    }
};

// Get Policy Templates by Provider
const getProviderPolicyTemplates = async (req, res) => {
    try {
        const providerId = req.user.userId;

        const query = `
            SELECT * FROM policy_templates 
            WHERE provider_id = $1 
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [providerId]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching provider policy templates:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch policy templates',
            details: error.message
        });
    }
};

// Purchase Policy (Customer) - Create payment order first
const purchasePolicy = async (req, res) => {
    try {
        const { templateId } = req.params;
        const holderId = req.user.userId;

        // Get template details
        const templateQuery = `
            SELECT pt.*, u.full_name as provider_name, u.email as provider_email
            FROM policy_templates pt
            JOIN users u ON pt.provider_id = u.user_id
            WHERE pt.template_id = $1 AND pt.is_active = true
        `;

        const templateResult = await pool.query(templateQuery, [templateId]);
        
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Policy template not found',
                details: 'The requested policy template does not exist or is not active'
            });
        }

        const template = templateResult.rows[0];

        // Check if template is still valid
        if (new Date(template.insurance_exp_date) <= new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Template expired',
                details: 'This policy template has expired'
            });
        }

        // For now, we'll create the policy directly without payment integration
        // In a real implementation, you would create a payment order first
        // and only create the policy after successful payment verification

        // Purchase policy on blockchain
        const blockchainResult = await insuranceService.purchasePolicy(
            template.blockchain_template_id,
            template.premium
        );

        // Generate policy number
        const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Store policy in database
        const policyQuery = `
            INSERT INTO policies (
                policy_number, template_id, holder_id, provider_id, 
                policy_type, coverage_amount, premium, start_date, 
                end_date, blockchain_policy_id, blockchain_tx_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `;

        const policyValues = [
            policyNumber,
            templateId,
            holderId,
            template.provider_id,
            template.policy_type,
            template.coverage_amount,
            template.premium,
            new Date(),
            template.insurance_exp_date,
            blockchainResult.policyNumber,
            blockchainResult.transactionHash
        ];

        const policyResult = await pool.query(policyQuery, policyValues);
        const policy = policyResult.rows[0];

        // Create payment record
        await pool.query(
            'INSERT INTO payments (policy_id, user_id, amount, payment_type, status, cashfree_txn_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [policy.policy_id, holderId, template.premium, 'premium', 'completed', blockchainResult.transactionHash]
        );

        // Create notifications
        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)',
            [holderId, 'Policy Purchased', `Policy ${policyNumber} purchased successfully`, 'policy_purchased', policy.policy_id]
        );

        await pool.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)',
            [template.provider_id, 'Policy Sold', `Policy ${policyNumber} purchased by customer`, 'policy_purchased', policy.policy_id]
        );

        res.status(201).json({
            success: true,
            data: {
                policyId: policy.policy_id,
                policyNumber: policy.policy_number,
                blockchainPolicyId: blockchainResult.policyNumber,
                transactionHash: blockchainResult.transactionHash,
                ...policy
            }
        });

    } catch (error) {
        console.error('Error purchasing policy:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to purchase policy',
            details: error.message
        });
    }
};

// Get User's Policies
const getUserPolicies = async (req, res) => {
    try {
        const userId = req.user.userId;

        const query = `
            SELECT p.*, pt.description, pt.terms_and_conditions, 
                   u_provider.full_name as provider_name, u_provider.email as provider_email
            FROM policies p
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u_provider ON p.provider_id = u_provider.user_id
            WHERE p.holder_id = $1
            ORDER BY p.created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching user policies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user policies',
            details: error.message
        });
    }
};

// Get Provider's Policies (sold policies)
const getProviderPolicies = async (req, res) => {
    try {
        const providerId = req.user.userId;

        const query = `
            SELECT p.*, pt.description, pt.terms_and_conditions,
                   u_holder.full_name as holder_name, u_holder.email as holder_email
            FROM policies p
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u_holder ON p.holder_id = u_holder.user_id
            WHERE p.provider_id = $1
            ORDER BY p.created_at DESC
        `;

        const result = await pool.query(query, [providerId]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching provider policies:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch provider policies',
            details: error.message
        });
    }
};

// Get Policy Details
const getPolicyDetails = async (req, res) => {
    try {
        const { policyId } = req.params;
        const userId = req.user.userId;

        const query = `
            SELECT p.*, pt.description, pt.terms_and_conditions,
                   u_provider.full_name as provider_name, u_provider.email as provider_email,
                   u_holder.full_name as holder_name, u_holder.email as holder_email
            FROM policies p
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u_provider ON p.provider_id = u_provider.user_id
            JOIN users u_holder ON p.holder_id = u_holder.user_id
            WHERE p.policy_id = $1 AND (p.holder_id = $2 OR p.provider_id = $2)
        `;

        const result = await pool.query(query, [policyId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Policy not found',
                details: 'The requested policy does not exist or you do not have access to it'
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        console.error('Error fetching policy details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch policy details',
            details: error.message
        });
    }
};

module.exports = {
    createPolicyTemplate,
    getAllPolicyTemplates,
    getProviderPolicyTemplates,
    purchasePolicy,
    getUserPolicies,
    getProviderPolicies,
    getPolicyDetails
};
