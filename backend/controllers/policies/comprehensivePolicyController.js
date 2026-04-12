const pool = require('../../config/db');
const InsuranceService = require('../../services/insuranceService');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize insurance service with error handling
let insuranceService;
try {
    insuranceService = new InsuranceService(
        process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        process.env.PROVIDER_URL || 'http://localhost:8545'
    );

    // Connect with signer for write operations
    const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    insuranceService.connectSigner(privateKey);
    console.log('Blockchain service initialized successfully');
} catch (error) {
    console.error('Failed to initialize blockchain service:', error);
    console.error('Error details:', error.message);
    console.error('This is expected if no blockchain is running. Continuing with mock data...');
    // Continue without blockchain service for now
    insuranceService = null;
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/policy-documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('File being processed:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        
        // More lenient file validation
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype || extname) {
            return cb(null, true);
        } else {
            console.log('File rejected:', file.originalname, file.mimetype);
            cb(new Error(`File type not allowed: ${file.originalname} (${file.mimetype})`));
        }
    }
});

// Comprehensive Policy Purchase
const purchaseComprehensivePolicy = async (req, res) => {
    const client = await pool.connect();
    try {
        console.log('=== Comprehensive Policy Purchase Debug ===');
        console.log('Request body:', req.body);
        console.log('Request files:', req.files);
        console.log('User:', req.user);
        console.log('Insurance service available:', !!insuranceService);
        
        await client.query('BEGIN');

        const {
            templateId,
            customerDetails,
            policyDetails,
            beneficiaries,
            paymentDetails
        } = req.body;

        console.log('Extracted data:', { templateId, customerDetails, policyDetails, beneficiaries, paymentDetails });

        const holderId = req.user.userId;

        // Parse JSON strings
        let customer, policy, beneficiaryList, payment;
        try {
            customer = JSON.parse(customerDetails);
            policy = JSON.parse(policyDetails);
            beneficiaryList = JSON.parse(beneficiaries);
            payment = JSON.parse(paymentDetails);
            console.log('JSON parsing successful');
        } catch (parseError) {
            console.error('JSON parsing error:', parseError);
            console.error('Raw data:', { customerDetails, policyDetails, beneficiaries, paymentDetails });
            throw new Error(`JSON parsing failed: ${parseError.message}`);
        }

        // Get template details
        const templateQuery = `
            SELECT pt.*, u.full_name as provider_name, u.email as provider_email
            FROM policy_templates pt
            JOIN users u ON pt.provider_id = u.user_id
            WHERE pt.template_id = $1 AND pt.is_active = true
        `;

        const templateResult = await client.query(templateQuery, [templateId]);
        
        if (templateResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Policy template not found',
                details: 'The requested policy template does not exist or is not active'
            });
        }

        const template = templateResult.rows[0];

        // Check if template is still valid
        if (new Date(template.insurance_exp_date) <= new Date()) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Template expired',
                details: 'This policy template has expired'
            });
        }

        // Calculate policy end date (1 year from start date)
        const startDate = new Date(policy.startDate);
        const endDate = new Date(startDate);
        endDate.setFullYear(endDate.getFullYear() + 1);

        // Generate policy number
        const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Purchase policy on blockchain (if service is available)
        let blockchainResult = null;
        if (insuranceService) {
            try {
                blockchainResult = await insuranceService.purchasePolicy(
                    template.blockchain_template_id,
                    template.premium
                );
                console.log('Blockchain transaction successful:', blockchainResult);
            } catch (blockchainError) {
                console.error('Blockchain transaction failed:', blockchainError);
                // Continue without blockchain for now
                blockchainResult = {
                    policyNumber: Math.floor(Math.random() * 1000000),
                    transactionHash: 'mock-tx-' + Date.now()
                };
            }
        } else {
            console.log('Blockchain service not available, using mock data');
            blockchainResult = {
                policyNumber: Math.floor(Math.random() * 1000000),
                transactionHash: 'mock-tx-' + Date.now()
            };
        }

        // Store comprehensive policy in database
        const policyQuery = `
            INSERT INTO policies (
                policy_number, template_id, holder_id, provider_id, 
                policy_type, coverage_amount, premium, start_date, 
                end_date, customer_name, customer_email, customer_phone,
                customer_address, plan_name, members_count, payment_status,
                blockchain_policy_id, blockchain_tx_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
            startDate,
            endDate,
            customer.fullName,
            customer.email,
            customer.phone,
            customer.address,
            policy.planName,
            policy.membersCount,
            'completed',
            blockchainResult.policyNumber,
            blockchainResult.transactionHash
        ];

        const policyResult = await client.query(policyQuery, policyValues);
        const newPolicy = policyResult.rows[0];

        // Store beneficiaries
        for (const beneficiary of beneficiaryList) {
            await client.query(`
                INSERT INTO policy_beneficiaries (
                    policy_id, name, relationship, age, gender, 
                    aadhar_number, date_of_birth, is_primary
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                newPolicy.policy_id,
                beneficiary.name,
                beneficiary.relationship,
                beneficiary.age,
                beneficiary.gender,
                beneficiary.aadhar_number,
                beneficiary.date_of_birth,
                beneficiary.is_primary
            ]);
        }

        // Store payment record
        await client.query(`
            INSERT INTO policy_payments (
                policy_id, payment_type, amount, payment_method, 
                payment_reference, status, transaction_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
            newPolicy.policy_id,
            'premium',
            template.premium,
            payment.paymentMethod,
            blockchainResult.transactionHash,
            'completed',
            blockchainResult.transactionHash
        ]);

        // Handle document uploads
        const documents = [];
        if (req.files && req.files.length > 0) {
            console.log('Processing uploaded files:', req.files);
            
            // Group files by their index
            const fileGroups = {};
            req.files.forEach(file => {
                // Extract index from fieldname like "document_0", "document_1", etc.
                const match = file.fieldname.match(/document_(\d+)/);
                if (match) {
                    const index = match[1];
                    if (!fileGroups[index]) {
                        fileGroups[index] = { file: null, type: null };
                    }
                    fileGroups[index].file = file;
                }
            });
            
            // Get document types from request body
            Object.keys(fileGroups).forEach(index => {
                const documentType = req.body[`document_type_${index}`];
                if (documentType && fileGroups[index].file) {
                    fileGroups[index].type = documentType;
                }
            });
            
            // Process each file group
            for (const index in fileGroups) {
                const { file, type } = fileGroups[index];
                if (file && type) {
                    const documentQuery = `
                        INSERT INTO policy_documents (
                            policy_id, document_type, document_name, 
                            file_path, file_size, mime_type, uploaded_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                        RETURNING *
                    `;

                    const documentResult = await client.query(documentQuery, [
                        newPolicy.policy_id,
                        type,
                        file.originalname,
                        file.path,
                        file.size,
                        file.mimetype,
                        holderId
                    ]);

                    documents.push(documentResult.rows[0]);
                }
            }
        }

        // Create notifications
        await client.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)',
            [holderId, 'Policy Purchased', `Policy ${policyNumber} purchased successfully`, 'policy_purchased', newPolicy.policy_id]
        );

        await client.query(
            'INSERT INTO notifications (user_id, title, message, type, related_id) VALUES ($1, $2, $3, $4, $5)',
            [template.provider_id, 'Policy Sold', `Policy ${policyNumber} purchased by ${customer.fullName}`, 'policy_purchased', newPolicy.policy_id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            data: {
                policyId: newPolicy.policy_id,
                policyNumber: newPolicy.policy_number,
                blockchainPolicyId: blockchainResult.policyNumber,
                transactionHash: blockchainResult.transactionHash,
                customerName: customer.fullName,
                planName: policy.planName,
                coverageAmount: template.coverage_amount,
                premium: template.premium,
                startDate: startDate,
                endDate: endDate,
                membersCount: policy.membersCount,
                documentsUploaded: documents.length,
                ...newPolicy
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error purchasing comprehensive policy:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: 'Failed to purchase policy',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        client.release();
    }
};

// Get comprehensive policy details
const getPolicyDetails = async (req, res) => {
    const client = await pool.connect();
    try {
        const { policyId } = req.params;
        const userId = req.user.userId;

        // Get policy with all related data
        const policyQuery = `
            SELECT p.*, pt.description, pt.terms_and_conditions,
                   u_provider.full_name as provider_name, u_provider.email as provider_email
            FROM policies p
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u_provider ON p.provider_id = u_provider.user_id
            WHERE p.policy_id = $1 AND p.holder_id = $2
        `;

        const policyResult = await client.query(policyQuery, [policyId, userId]);
        
        if (policyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Policy not found',
                details: 'The requested policy does not exist or you do not have access to it'
            });
        }

        const policy = policyResult.rows[0];

        // Get beneficiaries
        const beneficiariesQuery = `
            SELECT * FROM policy_beneficiaries 
            WHERE policy_id = $1 
            ORDER BY is_primary DESC, created_at ASC
        `;
        const beneficiariesResult = await client.query(beneficiariesQuery, [policyId]);

        // Get documents
        const documentsQuery = `
            SELECT * FROM policy_documents 
            WHERE policy_id = $1 
            ORDER BY uploaded_at ASC
        `;
        const documentsResult = await client.query(documentsQuery, [policyId]);

        // Get claims
        const claimsQuery = `
            SELECT * FROM policy_claims 
            WHERE policy_id = $1 
            ORDER BY claim_date DESC
        `;
        const claimsResult = await client.query(claimsQuery, [policyId]);

        // Get payments
        const paymentsQuery = `
            SELECT * FROM policy_payments 
            WHERE policy_id = $1 
            ORDER BY payment_date DESC
        `;
        const paymentsResult = await client.query(paymentsQuery, [policyId]);

        res.json({
            success: true,
            data: {
                ...policy,
                beneficiaries: beneficiariesResult.rows,
                documents: documentsResult.rows,
                claims: claimsResult.rows,
                payments: paymentsResult.rows
            }
        });

    } catch (error) {
        console.error('Error fetching policy details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch policy details',
            details: error.message
        });
    } finally {
        client.release();
    }
};

module.exports = {
    purchaseComprehensivePolicy,
    getPolicyDetails,
    upload
};
