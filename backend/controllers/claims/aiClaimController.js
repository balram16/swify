const pool = require('../../config/db');
const ABDMService = require('../../services/abdmService');
const GroqService = require('../../services/groqService');
const CashfreePayoutService = require('../../services/cashfreePayoutService');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Initialize services
const abdmService = new ABDMService();
const groqService = new GroqService();
const cashfreePayoutService = new CashfreePayoutService();

// Configure multer for claim document uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/claim-documents');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `claim_${req.user.userId}_${uniqueSuffix}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx|image\/|application\/pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype || extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and PDFs are allowed'));
        }
    }
});

/**
 * Submit a new insurance claim with AI analysis
 */
const submitClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            policyId: policyIdStr,
            abdmId,
            claimAmount,
            incidentDate,
            claimDescription,
            hospitalName,
            treatmentDetails,
            bankAccount,
            ifscCode,
            beneficiaryName
        } = req.body;

        const userId = req.user.userId;
        
        // Convert policyId to integer and validate
        const policyId = parseInt(policyIdStr);
        if (isNaN(policyId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid policy ID format'
            });
        }

        // Validate required fields
        if (!abdmId || !claimAmount || !incidentDate || !claimDescription) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }

        // Validate ABDM ID format
        if (!abdmService.validateABDMId(abdmId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid ABDM ID format. Expected format: ABDM followed by 9 digits'
            });
        }

        // Fetch ABDM records
        console.log('Fetching ABDM records for:', abdmId);
        const abdmResult = await abdmService.fetchPatientRecords(abdmId);
        
        if (!abdmResult.success) {
            return res.status(400).json({
                success: false,
                error: 'Failed to fetch ABDM records: ' + abdmResult.error
            });
        }

        // Get policy details
        console.log('Fetching policy with ID:', policyId, 'for user:', userId);
        const policyQuery = `
            SELECT p.*, pt.policy_type, pt.coverage_amount, pt.premium
            FROM policies p
            JOIN policy_templates pt ON p.template_id = pt.template_id
            WHERE p.policy_id = $1 AND p.holder_id = $2
        `;
        const policyResult = await client.query(policyQuery, [policyId, userId]);
        console.log('Policy found:', policyResult.rows[0]);
        
        if (policyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Policy not found or access denied'
            });
        }

        const policy = policyResult.rows[0];

        // Process uploaded documents
        const documents = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const documentQuery = `
                    INSERT INTO claim_documents (
                        claim_id, document_type, document_name, 
                        file_path, file_size, mime_type, uploaded_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `;
                // We'll update this after creating the claim
                documents.push({
                    type: req.body[`document_type_${file.fieldname.split('_')[1]}`] || 'Supporting Document',
                    name: file.originalname,
                    path: file.path,
                    size: file.size,
                    mimeType: file.mimetype
                });
            }
        }

        // Create claim record
        const claimQuery = `
            INSERT INTO claims (
                user_id, policy_id, policy_number, incident_description,
                claim_amount, filing_date, claim_status, claim_type,
                aabha_id, hospital_name, treatment_details,
                abdm_data, bank_account, ifsc_code, beneficiary_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING *
        `;

        console.log('Inserting claim with values:', {
            userId,
            policyId,
            'policy.policy_number': policy.policy_number,
            claimDescription,
            claimAmount
        });
        
        const claimResult = await client.query(claimQuery, [
            userId,
            policy.policy_number, // $2: policy_id should be string (POL-xxx)
            policyId, // $3: policy_number should be integer (12)
            claimDescription,
            claimAmount,
            new Date(),
            'pending', // Changed from 'pending_ai_analysis' to 'pending'
            'health',
            abdmId,
            hospitalName,
            treatmentDetails,
            JSON.stringify(abdmResult.data),
            bankAccount,
            ifscCode,
            beneficiaryName
        ]);

        const claim = claimResult.rows[0];

        // Store documents
        for (const doc of documents) {
            await client.query(`
                INSERT INTO claim_documents (
                    claim_id, document_type, document_name, 
                    file_path, file_size, mime_type, uploaded_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
                claim.claim_id,
                doc.type,
                doc.name,
                doc.path,
                doc.size,
                doc.mimeType,
                userId
            ]);
        }

        // Prepare data for AI analysis
        const claimData = {
            abdmRecords: abdmResult.data,
            userDocuments: documents,
            claimAmount: parseFloat(claimAmount),
            policyDetails: policy,
            claimDescription,
            incidentDate
        };

        // Perform AI analysis
        console.log('Starting AI analysis...');
        const aiResult = await groqService.analyzeClaim(claimData);
        
        let aiAnalysis = null;
        if (aiResult.success) {
            aiAnalysis = aiResult.data;
        } else {
            console.log('AI analysis failed, using fallback:', aiResult.error);
            aiAnalysis = groqService.getMockAnalysis();
        }

        // Update claim with AI analysis
        const updateQuery = `
            UPDATE claims SET 
                ai_analysis = $1,
                fraud_score = $2,
                risk_level = $3,
                ai_confidence = $4,
                claim_status = $5,
                updated_at = CURRENT_TIMESTAMP
            WHERE claim_id = $6
        `;

        await client.query(updateQuery, [
            JSON.stringify(aiAnalysis),
            aiAnalysis.fraudScore,
            aiAnalysis.riskLevel,
            aiAnalysis.confidence,
            aiAnalysis.isValidClaim ? 'pending_provider_review' : 'rejected_by_ai',
            claim.claim_id
        ]);

        // Create notification for provider
        await client.query(`
            INSERT INTO notifications (user_id, title, message, type, related_id)
            VALUES ($1, $2, $3, $4, $5)
        `, [
            policy.provider_id,
            'New Claim Submitted',
            `New claim #${claim.claim_id} submitted by ${req.user.email}. AI Analysis: ${aiAnalysis.riskLevel} risk, ${aiAnalysis.fraudScore}% fraud score.`,
            'new_claim',
            claim.claim_id
        ]);

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                claimId: claim.claim_id,
                status: aiAnalysis.isValidClaim ? 'pending_provider_review' : 'rejected_by_ai',
                aiAnalysis: {
                    fraudScore: aiAnalysis.fraudScore,
                    riskLevel: aiAnalysis.riskLevel,
                    isValidClaim: aiAnalysis.isValidClaim,
                    confidence: aiAnalysis.confidence,
                    summary: aiAnalysis.summary
                },
                message: aiAnalysis.isValidClaim ? 
                    'Claim submitted successfully. Awaiting provider review.' : 
                    'Claim rejected by AI analysis. Please contact support.'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting claim:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to submit claim',
            details: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * Get user's claims
 */
const getUserClaims = async (req, res) => {
    try {
        const userId = req.user.userId;
        
        const query = `
            SELECT c.*, p.policy_number, p.policy_type, p.coverage_amount,
                   pt.policy_type as template_type
            FROM claims c
            JOIN policies p ON c.policy_id = p.policy_number
            JOIN policy_templates pt ON p.template_id = pt.template_id
            WHERE c.user_id = $1
            ORDER BY c.filing_date DESC
        `;

        const result = await pool.query(query, [userId]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching user claims:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch claims'
        });
    }
};

/**
 * Get claims for provider review
 */
const getProviderClaims = async (req, res) => {
    try {
        const providerId = req.user.userId;
        
        const query = `
            SELECT c.*, p.policy_number, p.policy_type, p.coverage_amount,
                   u.full_name as claimant_name, u.email as claimant_email,
                   pt.policy_type as template_type
            FROM claims c
            JOIN policies p ON c.policy_id = p.policy_number
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u ON c.user_id = u.user_id
            WHERE p.provider_id = $1
            ORDER BY c.filing_date DESC
        `;

        const result = await pool.query(query, [providerId]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching provider claims:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch claims'
        });
    }
};

/**
 * Approve or reject claim
 */
const processClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { claimId } = req.params;
        const { action, comments } = req.body; // action: 'approve' or 'reject'
        const providerId = req.user.userId;

        await client.query('BEGIN');

        // Get claim details
        const claimQuery = `
            SELECT c.*, p.provider_id, p.policy_id as policies_policy_id, p.policy_number, u.full_name as claimant_name,
                   u.email as claimant_email, u.phone as claimant_phone
            FROM claims c
            JOIN policies p ON c.policy_id = p.policy_number
            JOIN users u ON c.user_id = u.user_id
            WHERE c.claim_id = $1 AND p.provider_id = $2
        `;

        const claimResult = await client.query(claimQuery, [claimId, providerId]);
        
        if (claimResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Claim not found or access denied'
            });
        }

        const claim = claimResult.rows[0];

        if (action === 'approve') {
            // Update claim status
            await client.query(`
                UPDATE claims SET 
                    claim_status = 'approved',
                    provider_comments = $1,
                    approved_by = $2,
                    approved_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE claim_id = $3
            `, [comments, providerId, claimId]);

            // Initiate payout
            const payoutResult = await cashfreePayoutService.initiatePayout({
                claimId: claim.claim_id,
                userId: claim.user_id,
                amount: claim.claim_amount,
                beneficiaryName: claim.beneficiary_name,
                bankAccount: claim.bank_account,
                ifscCode: claim.ifsc_code,
                phone: claim.claimant_phone,
                email: claim.claimant_email
            });

            if (payoutResult.success) {
                // Update claim with payout details
                await client.query(`
                    UPDATE claims SET 
                        payout_id = $1,
                        payout_status = 'initiated',
                        payout_amount = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE claim_id = $3
                `, [
                    payoutResult.data.payoutId,
                    claim.claim_amount,
                    claimId
                ]);

                // Create payment record
                await client.query(`
                    INSERT INTO policy_payments (
                        policy_id, amount, payment_type, 
                        status, payment_reference, payment_date
                    ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                `, [
                    claim.policies_policy_id,
                    claim.claim_amount,
                    'claim_payout',
                    'completed',
                    payoutResult.data.payoutId
                ]);
            }

            // Create notification for claimant
            await client.query(`
                INSERT INTO notifications (user_id, title, message, type, related_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                claim.user_id,
                'Claim Approved',
                `Your claim #${claim.claim_id} has been approved and payment of ₹${claim.claim_amount} has been initiated.`,
                'claim_approved',
                claim.claim_id
            ]);

        } else if (action === 'reject') {
            // Update claim status
            await client.query(`
                UPDATE claims SET 
                    claim_status = 'rejected',
                    provider_comments = $1,
                    rejected_by = $2,
                    rejected_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE claim_id = $3
            `, [comments, providerId, claimId]);

            // Create notification for claimant
            await client.query(`
                INSERT INTO notifications (user_id, title, message, type, related_id)
                VALUES ($1, $2, $3, $4, $5)
            `, [
                claim.user_id,
                'Claim Rejected',
                `Your claim #${claim.claim_id} has been rejected. Reason: ${comments}`,
                'claim_rejected',
                claim.claim_id
            ]);
        }

        await client.query('COMMIT');

        res.json({
            success: true,
            data: {
                claimId: claim.claim_id,
                status: action === 'approve' ? 'approved' : 'rejected',
                message: action === 'approve' ? 
                    'Claim approved and payment initiated' : 
                    'Claim rejected'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing claim:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process claim',
            details: error.message
        });
    } finally {
        client.release();
    }
};

/**
 * Get claim details with AI analysis
 */
const getClaimDetails = async (req, res) => {
    try {
        const { claimId } = req.params;
        const userId = req.user.userId;

        const query = `
            SELECT c.*, p.policy_number, p.policy_type, p.coverage_amount,
                   u.full_name as claimant_name, u.email as claimant_email,
                   pt.policy_type as template_type
            FROM claims c
            JOIN policies p ON c.policy_id = p.policy_number
            JOIN policy_templates pt ON p.template_id = pt.template_id
            JOIN users u ON c.user_id = u.user_id
            WHERE c.claim_id = $1 AND (c.user_id = $2 OR p.provider_id = $2)
        `;

        const result = await pool.query(query, [claimId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Claim not found or access denied'
            });
        }

        const claim = result.rows[0];
        
        // Parse AI analysis if available
        if (claim.ai_analysis) {
            claim.ai_analysis = JSON.parse(claim.ai_analysis);
        }

        // Parse ABDM data if available
        if (claim.abdm_data) {
            claim.abdm_data = JSON.parse(claim.abdm_data);
        }

        res.json({
            success: true,
            data: claim
        });

    } catch (error) {
        console.error('Error fetching claim details:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch claim details'
        });
    }
};

module.exports = {
    submitClaim,
    getUserClaims,
    getProviderClaims,
    processClaim,
    getClaimDetails,
    upload
};
