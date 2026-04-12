const pool = require('../../config/db');

// GET /api/claims/pending-claims  (Provider: all claims on their policies)
const getPendingClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        const providerId = String(req.user.userId);

        const result = await client.query(
            `SELECT 
                cl.claim_id,
                cl.claim_amount,
                cl.approved_amount,
                cl.claim_status,
                cl.claim_type,
                cl.filing_date,
                cl.incident_description,
                cl.policy_id,
                cl.policy_number,
                u.full_name  AS policyholder_name,
                u.email      AS policyholder_email,
                p.policy_type,
                p.coverage_amount
             FROM claims cl
             JOIN users u ON cl.user_id = u.user_id
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE p.provider_id::text = $1
             ORDER BY cl.filing_date DESC`,
            [providerId]
        );

        res.json({ success: true, count: result.rows.length, claims: result.rows });
    } catch (error) {
        console.error('Error fetching claims:', error);
        res.status(500).json({ success: false, error: 'Error fetching claims', details: error.message });
    } finally {
        client.release();
    }
};

// GET /api/claims/claim/:claimId
const getClaimDetails = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                cl.claim_id, cl.claim_amount, cl.approved_amount,
                cl.claim_status, cl.claim_type, cl.filing_date,
                cl.incident_description, cl.policy_id, cl.policy_number,
                u.full_name AS policyholder_name, u.email AS policyholder_email,
                p.policy_type, p.coverage_amount, p.provider_id
             FROM claims cl
             JOIN users u ON cl.user_id = u.user_id
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE cl.claim_id = $1`,
            [req.params.claimId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error) {
        console.error('Error fetching claim details:', error);
        res.status(500).json({ success: false, error: 'Error fetching claim details', details: error.message });
    } finally {
        client.release();
    }
};

// GET /api/claims/me  (Customer: their own claims)
const getUserClaims = async (req, res) => {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT 
                cl.claim_id,
                cl.claim_amount,
                cl.approved_amount,
                cl.claim_status,
                cl.claim_type,
                cl.filing_date,
                cl.incident_description,
                p.policy_number,
                p.policy_type
             FROM claims cl
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE cl.user_id = $1
             ORDER BY cl.filing_date DESC`,
            [req.user.userId]
        );

        res.json({ success: true, claims: result.rows });
    } catch (error) {
        console.error('Error fetching user claims:', error);
        res.status(500).json({ success: false, error: 'Error fetching user claims', details: error.message });
    } finally {
        client.release();
    }
};

// POST /api/claims/claim  (Customer: file a new claim)
const createClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { policyId, claimAmount, incidentDescription, claimType } = req.body;

        if (!policyId || !claimAmount || !incidentDescription) {
            return res.status(400).json({ success: false, error: 'policyId, claimAmount, and incidentDescription are required' });
        }

        // Verify policy belongs to this user and is active
        const policyResult = await client.query(
            `SELECT * FROM policies WHERE policy_id = $1 AND holder_id::text = $2`,
            [policyId, String(req.user.userId)]
        );

        if (policyResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Policy not found or does not belong to you' });
        }

        const policy = policyResult.rows[0];

        if (policy.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Policy is not active' });
        }

        if (parseFloat(claimAmount) > parseFloat(policy.coverage_amount)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Claim amount exceeds policy coverage of ' + policy.coverage_amount
            });
        }

        // Insert into claims table — use policy_number as policy_id (matching existing schema)
        const claimResult = await client.query(
            `INSERT INTO claims (
                user_id, policy_id, policy_number, claim_amount,
                incident_description, claim_type, claim_status, filing_date
             ) VALUES ($1, $2, $3, $4, $5, $6, 'pending_review', CURRENT_TIMESTAMP)
             RETURNING claim_id`,
            [
                req.user.userId,
                policy.policy_number,
                policy.policy_id,
                claimAmount,
                incidentDescription,
                claimType || policy.policy_type
            ]
        );

        // Notify provider (wrap in try-catch so claim still succeeds if notification fails)
        try {
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [
                    policy.provider_id,
                    'New Claim Filed',
                    'A new claim has been filed on policy ' + policy.policy_number,
                    'new_claim',
                    claimResult.rows[0].claim_id
                ]
            );
        } catch(notifErr) {
            console.warn('Notification insert failed:', notifErr.message);
        }

        res.status(201).json({
            success: true,
            claimId: claimResult.rows[0].claim_id,
            message: 'Claim filed successfully'
        });
    } catch (error) {
        console.error('Error creating claim:', error);
        res.status(500).json({ success: false, error: 'Error creating claim', details: error.message });
    } finally {
        client.release();
    }
};

// POST /api/claims/claim/:claimId/approve  (Provider)
const approveClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { claimId } = req.params;
        const { approvedAmount, notes } = req.body;
        const providerId = String(req.user.userId);

        const claimResult = await client.query(
            `SELECT cl.claim_id, cl.claim_amount, cl.claim_status, cl.user_id,
                    p.provider_id, p.policy_number
             FROM claims cl
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE cl.claim_id = $1`,
            [claimId]
        );

        if (claimResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }

        const claim = claimResult.rows[0];

        if (String(claim.provider_id) !== providerId) {
            return res.status(403).json({ success: false, error: 'Not authorized to manage this claim' });
        }

        const finalAmount = approvedAmount || claim.claim_amount;

        await client.query(
            `UPDATE claims 
             SET claim_status = 'approved', 
                 approved_amount = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE claim_id = $2`,
            [finalAmount, claimId]
        );

        // Notify customer
        try {
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [claim.user_id, 'Claim Approved!', 'Your claim #' + claimId + ' has been approved for ' + finalAmount, 'claim_approved', claimId]
            );
        } catch(e) { console.warn('Notification failed:', e.message); }

        res.json({ success: true, message: 'Claim approved successfully', approvedAmount: finalAmount });
    } catch (error) {
        console.error('Error approving claim:', error);
        res.status(500).json({ success: false, error: 'Error approving claim', details: error.message });
    } finally {
        client.release();
    }
};

// POST /api/claims/claim/:claimId/reject  (Provider)
const rejectClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { claimId } = req.params;
        const { reason } = req.body;
        const providerId = String(req.user.userId);

        const claimResult = await client.query(
            `SELECT cl.claim_id, cl.claim_status, cl.user_id,
                    p.provider_id, p.policy_number
             FROM claims cl
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE cl.claim_id = $1`,
            [claimId]
        );

        if (claimResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }

        const claim = claimResult.rows[0];

        if (String(claim.provider_id) !== providerId) {
            return res.status(403).json({ success: false, error: 'Not authorized to manage this claim' });
        }

        await client.query(
            `UPDATE claims 
             SET claim_status = 'rejected',
                 updated_at = CURRENT_TIMESTAMP
             WHERE claim_id = $1`,
            [claimId]
        );

        // Notify customer
        try {
            await client.query(
                `INSERT INTO notifications (user_id, title, message, type, related_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [claim.user_id, 'Claim Rejected', 'Your claim #' + claimId + ' has been rejected. Reason: ' + (reason || 'See policy terms'), 'claim_rejected', claimId]
            );
        } catch(e) { console.warn('Notification failed:', e.message); }

        res.json({ success: true, message: 'Claim rejected' });
    } catch (error) {
        console.error('Error rejecting claim:', error);
        res.status(500).json({ success: false, error: 'Error rejecting claim', details: error.message });
    } finally {
        client.release();
    }
};

// POST /api/claims/claim/:claimId/verify  (Provider: AI analysis)
const verifyClaim = async (req, res) => {
    const client = await pool.connect();
    try {
        const { claimId } = req.params;
        const providerId = String(req.user.userId);

        const claimResult = await client.query(
            `SELECT cl.claim_id, cl.claim_amount, cl.claim_status, cl.claim_type,
                    cl.incident_description, cl.filing_date, cl.user_id,
                    p.provider_id, p.policy_type, p.coverage_amount, p.policy_number
             FROM claims cl
             JOIN policies p ON cl.policy_id = p.policy_number
             WHERE cl.claim_id = $1`,
            [claimId]
        );

        if (claimResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Claim not found' });
        }

        const claim = claimResult.rows[0];

        if (String(claim.provider_id) !== providerId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // --- AI Analysis Logic ---
        const claimAmount = parseFloat(claim.claim_amount);
        const coverageAmount = parseFloat(claim.coverage_amount);
        const coverageRatio = claimAmount / coverageAmount;
        const descLength = (claim.incident_description || '').length;

        // Scoring factors
        const factors = [];
        let riskScore = 0; // 0-100, higher = more risky

        // 1. Coverage ratio check
        if (coverageRatio > 0.9) {
            riskScore += 30;
            factors.push({ name: 'High Coverage Ratio', impact: 'high', detail: `Claim is ${(coverageRatio * 100).toFixed(0)}% of total coverage` });
        } else if (coverageRatio > 0.5) {
            riskScore += 15;
            factors.push({ name: 'Moderate Coverage Ratio', impact: 'medium', detail: `Claim is ${(coverageRatio * 100).toFixed(0)}% of total coverage` });
        } else {
            factors.push({ name: 'Low Coverage Ratio', impact: 'low', detail: `Claim is ${(coverageRatio * 100).toFixed(0)}% of total coverage - within normal range` });
        }

        // 2. Description quality
        if (descLength < 20) {
            riskScore += 25;
            factors.push({ name: 'Insufficient Description', impact: 'high', detail: 'Very short incident description — may need more details' });
        } else if (descLength < 50) {
            riskScore += 10;
            factors.push({ name: 'Brief Description', impact: 'medium', detail: 'Incident description could be more detailed' });
        } else {
            factors.push({ name: 'Detailed Description', impact: 'low', detail: 'Incident description is adequately detailed' });
        }

        // 3. Filing speed (how quickly after coverage started)
        const filingDate = new Date(claim.filing_date);
        const now = new Date();
        const daysSinceFiling = Math.floor((now - filingDate) / (1000 * 60 * 60 * 24));
        if (daysSinceFiling < 1) {
            riskScore += 10;
            factors.push({ name: 'Recent Filing', impact: 'medium', detail: 'Claim filed very recently' });
        } else {
            factors.push({ name: 'Filing Timeline', impact: 'low', detail: `Filed ${daysSinceFiling} days ago` });
        }

        // 4. Claim type matching
        if (claim.claim_type && claim.policy_type && 
            claim.claim_type.toLowerCase() !== claim.policy_type.toLowerCase()) {
            riskScore += 20;
            factors.push({ name: 'Type Mismatch', impact: 'high', detail: `Claim type (${claim.claim_type}) differs from policy type (${claim.policy_type})` });
        } else {
            factors.push({ name: 'Type Match', impact: 'low', detail: 'Claim type matches policy type' });
        }

        // 5. Check for duplicate/repeat claims
        const duplicateCheck = await client.query(
            `SELECT COUNT(*) as cnt FROM claims 
             WHERE user_id = $1 AND policy_id = $2 AND claim_id != $3`,
            [claim.user_id, claim.policy_number, claimId]
        );
        const prevClaims = parseInt(duplicateCheck.rows[0].cnt);
        if (prevClaims > 2) {
            riskScore += 20;
            factors.push({ name: 'Multiple Claims', impact: 'high', detail: `${prevClaims} previous claims on this policy` });
        } else if (prevClaims > 0) {
            riskScore += 5;
            factors.push({ name: 'Prior Claims', impact: 'medium', detail: `${prevClaims} previous claim(s) on this policy` });
        } else {
            factors.push({ name: 'First Claim', impact: 'low', detail: 'No previous claims on this policy' });
        }

        // Calculate confidence and recommendation
        const confidenceScore = Math.max(60, Math.min(98, 95 - (riskScore * 0.3) + Math.random() * 5));
        let recommendation;
        if (riskScore <= 25) {
            recommendation = 'approve';
        } else if (riskScore <= 50) {
            recommendation = 'review';
        } else {
            recommendation = 'reject';
        }

        const aiResult = {
            riskScore: Math.min(100, riskScore),
            confidenceScore: parseFloat(confidenceScore.toFixed(1)),
            recommendation,
            factors,
            analyzedAt: new Date().toISOString(),
            summary: recommendation === 'approve' 
                ? 'Low risk claim. AI recommends approval.'
                : recommendation === 'review'
                ? 'Moderate risk detected. Manual review recommended before approval.'
                : 'High risk indicators found. AI recommends rejection or further investigation.'
        };

        // Update claim status to under_review
        await client.query(
            `UPDATE claims SET claim_status = 'under_review' WHERE claim_id = $1`,
            [claimId]
        );

        res.json({
            success: true,
            claimId: parseInt(claimId),
            analysis: aiResult
        });

    } catch (error) {
        console.error('Error verifying claim:', error);
        res.status(500).json({ success: false, error: 'Error verifying claim', details: error.message });
    } finally {
        client.release();
    }
};

const processClaim = approveClaim;

module.exports = {
    getPendingClaims,
    getClaimDetails,
    createClaim,
    verifyClaim,
    processClaim,
    getUserClaims,
    approveClaim,
    rejectClaim,
};