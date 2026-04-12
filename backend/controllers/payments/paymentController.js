const pool = require('../../config/db');
const PaymentService = require('../../services/paymentService');
const { v4: uuidv4 } = require('uuid');

const paymentService = new PaymentService();

// Create payment order for policy purchase
const createPaymentOrder = async (req, res) => {
    try {
        const { templateId, amount } = req.body;
        const userId = req.user.userId;

        // Generate unique order ID
        const orderId = `POL_${Date.now()}_${uuidv4().substr(0, 8)}`;

        // Get user details
        const userQuery = 'SELECT * FROM users WHERE user_id = $1';
        const userResult = await pool.query(userQuery, [userId]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Get template details
        const templateQuery = 'SELECT * FROM policy_templates WHERE template_id = $1';
        const templateResult = await pool.query(templateQuery, [templateId]);
        
        if (templateResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Policy template not found'
            });
        }

        const template = templateResult.rows[0];

        // Create payment order
        const paymentData = {
            orderId: orderId,
            amount: amount || template.premium,
            currency: 'INR',
            customerDetails: {
                customerId: user.user_id.toString(),
                customerName: user.full_name,
                customerEmail: user.email,
                customerPhone: user.phone
            },
            policyDetails: {
                templateId: template.template_id,
                policyType: template.policy_type,
                coverageAmount: template.coverage_amount
            }
        };

        const paymentResult = await paymentService.createPaymentOrder(paymentData);

        if (paymentResult.success) {
            // Store payment record in database
            await pool.query(
                'INSERT INTO payments (policy_id, user_id, amount, payment_type, status, cashfree_txn_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [null, userId, paymentData.amount, 'premium', 'pending', paymentResult.data.cfPaymentId]
            );

            res.json({
                success: true,
                data: {
                    orderId: paymentResult.data.orderId,
                    paymentUrl: paymentResult.data.paymentUrl,
                    amount: paymentData.amount,
                    currency: paymentData.currency
                }
            });
        } else {
            throw new Error('Failed to create payment order');
        }

    } catch (error) {
        console.error('Error creating payment order:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create payment order',
            details: error.message
        });
    }
};

// Verify payment status
const verifyPayment = async (req, res) => {
    try {
        const { orderId } = req.params;

        const verificationResult = await paymentService.verifyPayment(orderId);

        if (verificationResult.success) {
            // Update payment status in database
            const status = verificationResult.data.paymentStatus === 'SUCCESS' ? 'completed' : 'failed';
            await pool.query(
                'UPDATE payments SET status = $1, processed_at = $2 WHERE cashfree_txn_id = $3',
                [status, new Date(), verificationResult.data.cfPaymentId]
            );

            res.json({
                success: true,
                data: verificationResult.data
            });
        } else {
            throw new Error('Failed to verify payment');
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify payment',
            details: error.message
        });
    }
};

// Process claim payout
const processClaimPayout = async (req, res) => {
    try {
        const { claimId } = req.params;
        const { amount, beneficiaryDetails } = req.body;
        const userId = req.user.userId;

        // Get claim details
        const claimQuery = `
            SELECT c.*, p.policy_number, p.holder_id 
            FROM claims c 
            JOIN policies p ON c.policy_id = p.policy_id 
            WHERE c.claim_id = $1 AND p.holder_id = $2
        `;
        const claimResult = await pool.query(claimQuery, [claimId, userId]);
        
        if (claimResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Claim not found or access denied'
            });
        }

        const claim = claimResult.rows[0];

        // Process payout
        const payoutData = {
            claimId: claimId,
            amount: amount || claim.amount,
            beneficiaryDetails: beneficiaryDetails,
            policyDetails: {
                policyNumber: claim.policy_number,
                claimNumber: claim.claim_number
            }
        };

        const payoutResult = await paymentService.processClaimPayout(payoutData);

        if (payoutResult.success) {
            // Update claim status
            await pool.query(
                'UPDATE claims SET status = $1, cashfree_txn_id = $2, processed_at = $3 WHERE claim_id = $4',
                ['paid', payoutResult.data.payoutId, new Date(), claimId]
            );

            // Create payment record
            await pool.query(
                'INSERT INTO payments (claim_id, user_id, amount, payment_type, status, cashfree_txn_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [claimId, userId, payoutResult.data.amount, 'claim_payout', 'completed', payoutResult.data.payoutId]
            );

            res.json({
                success: true,
                data: payoutResult.data
            });
        } else {
            throw new Error('Failed to process claim payout');
        }

    } catch (error) {
        console.error('Error processing claim payout:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process claim payout',
            details: error.message
        });
    }
};

// Get payment history
const getPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit = 10, offset = 0 } = req.query;

        const query = `
            SELECT p.*, pol.policy_number, c.claim_number
            FROM payments p
            LEFT JOIN policies pol ON p.policy_id = pol.policy_id
            LEFT JOIN claims c ON p.claim_id = c.claim_id
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await pool.query(query, [userId, limit, offset]);
        
        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error fetching payment history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history',
            details: error.message
        });
    }
};

// Refund payment
const refundPayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { amount, reason } = req.body;
        const userId = req.user.userId;

        // Get payment details
        const paymentQuery = 'SELECT * FROM payments WHERE payment_id = $1 AND user_id = $2';
        const paymentResult = await pool.query(paymentQuery, [paymentId, userId]);
        
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Payment not found or access denied'
            });
        }

        const payment = paymentResult.rows[0];

        // Process refund
        const refundResult = await paymentService.refundPayment(
            payment.cashfree_txn_id,
            amount || payment.amount,
            reason || 'Policy cancellation'
        );

        if (refundResult.success) {
            // Update payment status
            await pool.query(
                'UPDATE payments SET status = $1 WHERE payment_id = $2',
                ['refunded', paymentId]
            );

            // Create refund payment record
            await pool.query(
                'INSERT INTO payments (policy_id, user_id, amount, payment_type, status, cashfree_txn_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [payment.policy_id, userId, -(amount || payment.amount), 'refund', 'completed', refundResult.data.refundId]
            );

            res.json({
                success: true,
                data: refundResult.data
            });
        } else {
            throw new Error('Failed to process refund');
        }

    } catch (error) {
        console.error('Error processing refund:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process refund',
            details: error.message
        });
    }
};

module.exports = {
    createPaymentOrder,
    verifyPayment,
    processClaimPayout,
    getPaymentHistory,
    refundPayment
};
