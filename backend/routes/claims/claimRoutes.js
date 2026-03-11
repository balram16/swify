const express = require('express');
const router = express.Router();
const claimController = require('../../controllers/claims/claimController');
const { authenticateToken } = require('../../middlewares/authMiddleware');

function requireInsurer(req, res, next) {
    if (req.user?.role === 'insurer' || req.user?.role === 'admin') return next();
    return res.status(403).json({ success: false, error: 'Forbidden' });
}

// Claims routes
router.get('/pending-claims', authenticateToken, requireInsurer, claimController.getPendingClaims);
router.get('/claim/:claimId', authenticateToken, claimController.getClaimDetails);
router.post('/claim', authenticateToken, claimController.createClaim);
router.post('/claim/:claimId/approve', authenticateToken, requireInsurer, claimController.approveClaim);
router.post('/claim/:claimId/reject', authenticateToken, requireInsurer, claimController.rejectClaim);
router.post('/claim/:claimId/verify', authenticateToken, requireInsurer, claimController.verifyClaim);
router.post('/claim/:claimId/process', authenticateToken, requireInsurer, claimController.approveClaim);
router.get('/me', authenticateToken, claimController.getUserClaims);

module.exports = router;