require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const insuranceRoutes = require('./routes/insuranceRoutes');
const claimRoutes = require('./routes/claims/claimRoutes');
const aiClaimRoutes = require('./routes/claims/aiClaimRoutes');
const authRoutes = require('./routes/auth/authRoutes');
const policyRoutes = require('./routes/policies/policyRoutes');
const comprehensivePolicyRoutes = require('./routes/policies/comprehensivePolicyRoutes');
const paymentRoutes = require('./routes/payments/paymentRoutes');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
}));
app.use(express.json());

// Test route
app.get('/api/test', (req, res) => {
    res.json({
        message: 'Namaste! SwiftClaim API is working properly!',
        timestamp: new Date().toISOString()
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/insurance', insuranceRoutes);
app.use('/api/claims', claimRoutes);
app.use('/api/ai-claims', aiClaimRoutes);
app.use('/api/policies', policyRoutes);
app.use('/api/policies', comprehensivePolicyRoutes);
app.use('/api/payments', paymentRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!',
        details: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 