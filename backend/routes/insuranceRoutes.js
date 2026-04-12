const express = require('express');
const router = express.Router();
const InsuranceService = require('../services/insuranceService');
const pool = require('../config/db');
require('dotenv').config();
const { ethers } = require('ethers');
const { authenticateToken } = require('../middlewares/authMiddleware');

// Initialize insurance service with error handling
let insuranceService;
try {
    const contractAddress = process.env.CONTRACT_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
    const providerUrl = process.env.PROVIDER_URL || 'http://localhost:8545';
    const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    
    insuranceService = new InsuranceService(contractAddress, providerUrl);
    insuranceService.connectSigner(privateKey);
    console.log('Insurance service initialized successfully');
} catch (error) {
    console.error('Failed to initialize insurance service:', error);
    insuranceService = null;
}



// Simple test route to get all pending claims
router.get('/pending-claims', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                c.claim_id,
                c.claim_amount,
                c.claim_status,
                c.claim_type,
                c.filing_date,
                u.full_name as policyholder_name,
                sp.policy_number
             FROM claims c
             JOIN users u ON c.user_id = u.user_id
             JOIN subscribed_policies sp ON c.policy_number = sp.policy_number
             WHERE c.claim_status = 'pending'
             ORDER BY c.filing_date DESC`
        );

        res.json({
            success: true,
            count: result.rows.length,
            claims: result.rows
        });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ 
            error: 'Error fetching pending claims',
            details: error.message
        });
    } finally {
        client.release();
    }
});

// Get policy details
router.get('/policy/:policyNumber', async (req, res) => {
    try {
        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        const policy = await insuranceService.getPolicy(req.params.policyNumber);
        res.json(policy);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get current user's policies (DB-backed subscribed policies)
router.get('/policies/me', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                p.policy_id,
                p.policy_number,
                p.policy_type as type,
                p.coverage_amount as coverage,
                p.premium,
                p.start_date,
                p.end_date,
                p.status,
                pt.description,
                u.full_name as provider_name,
                u.email as provider_email
             FROM policies p
             JOIN policy_templates pt ON p.template_id = pt.template_id
             JOIN users u ON p.provider_id = u.user_id
             WHERE p.holder_id = $1
             ORDER BY p.created_at DESC`,
            [req.user.userId]
        );
        res.json({ success: true, policies: result.rows });
    } catch (error) {
        console.error('Error fetching user policies:', error);
        res.status(500).json({ success: false, error: 'Error fetching user policies' });
    } finally {
        client.release();
    }
});

// Create a new policy (provider/insurer only)
router.post('/policy', authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'insurer' && req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        const { policyholder, coverageAmount, startDate, endDate, policyType, terms } = req.body;
        if (!policyholder || !coverageAmount || !startDate || !endDate || !policyType) {
            return res.status(400).json({ success: false, error: 'Missing required fields' });
        }

        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }

        const result = await insuranceService.createPolicy(
            policyholder,
            coverageAmount,
            startDate,
            endDate,
            policyType,
            terms
        );

        res.status(201).json({ success: true, ...result });
    } catch (error) {
        console.error('Create policy error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// List available policy templates (catalog)
router.get('/catalog', async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                pt.template_id as policy_id,
                pt.policy_type as type,
                pt.coverage_amount as coverage,
                pt.premium,
                pt.description,
                pt.insurance_exp_date,
                pt.max_claims_per_year,
                u.full_name as provider_name,
                u.email as provider_email
             FROM policy_templates pt
             JOIN users u ON pt.provider_id = u.user_id
             WHERE pt.is_active = true
             ORDER BY pt.created_at DESC`
        );
        res.json({ success: true, catalog: result.rows });
    } catch (error) {
        console.error('Error fetching catalog:', error);
        res.status(500).json({ success: false, error: 'Error fetching catalog' });
    } finally {
        client.release();
    }
});

// Subscribe/purchase a policy template -> create active user policy and on-chain policy
router.post('/policies/subscribe', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { templatePolicyId, policyholderAddress, startDate, endDate } = req.body;
        if (!templatePolicyId || !policyholderAddress) {
            return res.status(400).json({ success: false, error: 'templatePolicyId and policyholderAddress are required' });
        }

        await client.query('BEGIN');

        // Fetch template from policy_templates
        const tpl = await client.query(
            `SELECT 
                pt.template_id, 
                pt.policy_type, 
                pt.coverage_amount,
                pt.premium,
                pt.provider_id,
                pt.insurance_exp_date,
                pt.max_claims_per_year
             FROM policy_templates pt 
             WHERE pt.template_id = $1 AND pt.is_active = true`,
            [templatePolicyId]
        );
        if (tpl.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Policy template not found or inactive' });
        }
        const template = tpl.rows[0];

        // Derive dates
        const start = startDate ? new Date(startDate) : new Date();
        const end = endDate ? new Date(endDate) : new Date(template.insurance_exp_date);

        // Generate policy number
        const policyNumber = `POL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

        // Create policy on-chain (optional - can fail gracefully)
        let chainPolicyNumber = null;
        let transactionHash = null;
        
        try {
            if (!insuranceService) {
                return res.status(500).json({
                    success: false,
                    error: 'Blockchain service not available'
                });
            }
            const result = await insuranceService.createPolicy(
                policyholderAddress,
                template.coverage_amount,
                start.toISOString(),
                end.toISOString(),
                (template.policy_type || '').toString().toUpperCase() === 'TRAVEL' ? 'TRAVEL' : 'HEALTH',
                {
                    maxCoveragePerClaim: template.coverage_amount,
                    copayPercentage: 10,
                    coveredTreatments: [],
                    excludedTreatments: [],
                    waitingPeriod: 0,
                    maxClaimsPerYear: template.max_claims_per_year || 3,
                    preExistingConditionsCovered: false,
                    maxHospitalizationDays: 30,
                    maxRoomRent: 0,
                    maxICUCharges: 0,
                    maxOperationCharges: 0,
                    maxMedicineCharges: 0,
                    maxDiagnosticCharges: 0,
                    maxAmbulanceCharges: 0,
                    maxPreHospitalizationDays: 0,
                    maxPostHospitalizationDays: 0,
                    delayTimeMinutes: 0,
                    cancellationStatus: false,
                    travelTimeHours: 0
                }
            );
            chainPolicyNumber = result.policyNumber;
            transactionHash = result.transactionHash;
        } catch (blockchainError) {
            console.warn('Blockchain operation failed, continuing with database only:', blockchainError.message);
        }

        // Insert into policies table
        const policyInsert = await client.query(
            `INSERT INTO policies (
                policy_number, template_id, holder_id, provider_id,
                policy_type, coverage_amount, premium, start_date, end_date,
                status, blockchain_policy_id, blockchain_tx_hash
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING policy_id, policy_number`,
            [
                policyNumber,
                template.template_id,
                req.user.userId,
                template.provider_id,
                template.policy_type,
                template.coverage_amount,
                template.premium,
                start,
                end,
                'active',
                chainPolicyNumber,
                transactionHash
            ]
        );

        // Create payment record
        await client.query(
            `INSERT INTO payments (policy_id, user_id, amount, payment_type, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [policyInsert.rows[0].policy_id, req.user.userId, template.premium, 'premium', 'completed']
        );

        await client.query('COMMIT');

        res.status(201).json({
            success: true,
            policyNumber,
            chainPolicyNumber,
            transactionHash
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error subscribing policy:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});
// Get claim details
router.get('/claim/:claimId', async (req, res) => {
    try {
        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        const claim = await insuranceService.getClaim(req.params.claimId);
        res.json(claim);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Verify a claim with database integration
router.post('/claim/:claimId/verify', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Check if claim exists and is in pending status
        const claimResult = await client.query(
            `SELECT c.*, sp.policy_number, u.user_id 
             FROM claims c 
             JOIN subscribed_policies sp ON c.policy_number = sp.policy_number
             JOIN users u ON c.user_id = u.user_id
             WHERE c.claim_id = $1 AND c.claim_status = 'pending'`,
            [req.params.claimId]
        );

        if (claimResult.rows.length === 0) {
            throw new Error('Claim not found or not in pending status');
        }

        const claim = claimResult.rows[0];

        // 2. Verify claim on blockchain
        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        const verificationResult = await insuranceService.verifyClaim(req.params.claimId);

        // 3. Update claim status in database
        await client.query(
            `UPDATE claims 
             SET claim_status = 'processing', 
                 processing_notes = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE claim_id = $2`,
            [`Claim verified on blockchain. Transaction hash: ${verificationResult.transactionHash}`, req.params.claimId]
        );

        // 4. Add audit log
        await client.query(
            `INSERT INTO audit_log (entity_type, entity_id, action, user_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['claims', req.params.claimId, 'VERIFY', claim.user_id, `Claim verified on blockchain. TX: ${verificationResult.transactionHash}`]
        );

        await client.query('COMMIT');

        res.json({
            success: true,
            message: 'Claim verified successfully',
            claimId: req.params.claimId,
            transactionHash: verificationResult.transactionHash
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error verifying claim:', error);
        res.status(500).json({ 
            error: error.message || 'Error verifying claim',
            claimId: req.params.claimId
        });
    } finally {
        client.release();
    }
});

// Process a claim
router.post('/claim/:claimId/process', async (req, res) => {
    try {
        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        const result = await insuranceService.processClaim(req.params.claimId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Test route for policy number conversion
router.post('/test-claim', async (req, res) => {
    try {
        const { policyNumber } = req.body;
        
        console.log('Original policy number:', policyNumber);
        console.log('Type:', typeof policyNumber);
        
        // Try different conversion methods
        const asString = String(policyNumber);
        console.log('As String:', asString);
        
        const asBigNumber = ethers.BigNumber.from(asString);
        console.log('As BigNumber:', asBigNumber.toString());
        
        res.json({ 
            original: policyNumber,
            type: typeof policyNumber,
            asString: asString,
            asBigNumber: asBigNumber.toString(),
            success: true
        });
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

// Submit a new claim
router.post('/claim', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const {
            policyNumber,
            claimAmount,
            incidentDescription,
            billStartDate,
            billEndDate,
            aabhaId,
            flightId
        } = req.body;

        // Validate required fields
        if (!policyNumber || !claimAmount || !incidentDescription) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                details: 'Policy number, claim amount, and incident description are required'
            });
        }

        // 1. Verify the policy exists and is active
        const policyResult = await client.query(
            `SELECT sp.*, ip.type, ip.coverage, u.user_id
             FROM subscribed_policies sp
             JOIN insurance_policies ip ON sp.policy_id = ip.policy_id
             JOIN users u ON sp.user_id = u.user_id
             WHERE sp.policy_number = $1 AND sp.status = 'active'`,
            [policyNumber]
        );

        if (policyResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({
                success: false,
                error: 'Policy not found or inactive',
                details: `No active policy found with policy number: ${policyNumber}`
            });
        }

        const policy = policyResult.rows[0];
        const userId = policy.user_id;
        const policyType = policy.type;
        const policyId = policy.policy_id;
        const claimType = aabhaId ? 'health' : 'travel';

        // 2. Check if a claim already exists for this user and policy
        const existingClaimResult = await client.query(
            `SELECT claim_id, claim_status 
             FROM claims 
             WHERE user_id = $1 AND policy_id = $2 AND claim_status IN ('pending', 'processing', 'approved')`,
            [userId, policyId]
        );

        if (existingClaimResult.rows.length > 0) {
            const existingClaim = existingClaimResult.rows[0];
            await client.query('ROLLBACK');
            return res.status(409).json({
                success: false,
                error: 'Duplicate claim',
                details: `An active claim (ID: ${existingClaim.claim_id}, Status: ${existingClaim.claim_status}) already exists for this policy`,
                existingClaimId: existingClaim.claim_id
            });
        }

        // 3. Validate claim amount
        if (claimAmount <= 0 || claimAmount > policy.coverage) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Invalid claim amount',
                details: `Claim amount must be greater than 0 and less than or equal to policy coverage (${policy.coverage})`
            });
        }

        // 4. Validate claim type matches policy type
        if (policyType !== claimType) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Claim type mismatch',
                details: `Cannot submit a ${claimType} claim for a ${policyType} policy`
            });
        }

        // 5. Validate type-specific fields
        if (claimType === 'health' && !aabhaId) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Missing AABHA ID',
                details: 'AABHA ID is required for health claims'
            });
        }

        if (claimType === 'travel' && !flightId) {
            await client.query('ROLLBACK');
            return res.status(400).json({
                success: false,
                error: 'Missing Flight ID',
                details: 'Flight ID is required for travel claims'
            });
        }

        // 6. Verify AABHA record or flight data exists
        if (claimType === 'health') {
            const aabhaResult = await client.query(
                'SELECT * FROM aabha_records WHERE aabha_id = $1',
                [aabhaId]
            );

            if (aabhaResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'AABHA record not found',
                    details: `No AABHA record found with ID: ${aabhaId}`
                });
            }
        } else {
            const flightResult = await client.query(
                'SELECT * FROM flight_data WHERE flight_id = $1',
                [flightId]
            );

            if (flightResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({
                    success: false,
                    error: 'Flight data not found',
                    details: `No flight data found with ID: ${flightId}`
                });
            }
        }

        // 7. Insert claim into database
        const claimResult = await client.query(
            `INSERT INTO claims (
                user_id, policy_number, policy_id, incident_description, 
                claim_amount, bill_start_date, bill_end_date, aabha_id, 
                flight_id, claim_type, claim_status
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING claim_id`,
            [
                userId,
                policyNumber,
                policy.policy_id,
                incidentDescription,
                claimAmount,
                billStartDate,
                billEndDate,
                claimType === 'health' ? aabhaId : null,
                claimType === 'travel' ? flightId : null,
                claimType,
                'approved'
            ]
        );

        const claimId = claimResult.rows[0].claim_id;

        // 8. Log the claim creation in audit log
        await client.query(
            `INSERT INTO audit_log (entity_type, entity_id, action, user_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                'claims',
                claimId,
                'CREATE',
                userId,
                `Created ${claimType} claim for policy #${policyNumber} with amount ${claimAmount}`
            ]
        );

        // 9. Submit claim to blockchain
        console.log(`Submitting claim to blockchain for policy number: ${policyNumber} (${typeof policyNumber})`);
        
        // Convert policy number to BigNumber
        const policyNumberStr = String(policyNumber);
        console.log(`Policy number as string: ${policyNumberStr}`);
        
        const policyNumberBN = ethers.BigNumber.from(policyNumberStr);
        console.log(`Policy number as BigNumber: ${policyNumberBN.toString()}`);
        
        // Calculate timestamp for admission date if available
        let admissionTimestamp = 0;
        if (billStartDate) {
            admissionTimestamp = Math.floor(new Date(billStartDate).getTime() / 1000);
        }
        
        // Submit to blockchain with proper params
        if (!insuranceService) {
            return res.status(500).json({
                success: false,
                error: 'Blockchain service not available'
            });
        }
        const blockchainResult = await insuranceService.submitClaim(
            policyNumberBN,
            ethers.utils.parseEther(claimAmount.toString()),
            incidentDescription,
            aabhaId || "",
            admissionTimestamp,
            flightId || 0,
            false, // flightCancellationStatus
            0,     // flightDelayMinutes
            0      // flightDurationMinutes
        );

        console.log('Blockchain result:', blockchainResult);

        // 10. Record transaction hash
        await client.query(
            `INSERT INTO claimed_transactions (
                claim_id, amount, transaction_hash, transaction_type, notes, status
             )
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                claimId,
                claimAmount,
                blockchainResult.transactionHash,
                'claim_payout',
                `Initial claim submission for ${claimType} claim. Status: ${blockchainResult.status}`,
                'pending'
            ]
        );

        await client.query('COMMIT');

        // 11. Return success response
        res.status(201).json({
            success: true,
            claim: {
                claimId,
                policyNumber,
                claimAmount,
                claimType,
                status: 'approved'
            },
            blockchain: {
                chainClaimId: blockchainResult.claimId || '0',
                transactionHash: blockchainResult.transactionHash,
                blockchainStatus: blockchainResult.status || 'unknown'
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting claim:', error);
        
        // Standard error response format
        res.status(500).json({ 
            success: false,
            error: 'Error submitting claim',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        client.release();
    }
});

module.exports = router; 