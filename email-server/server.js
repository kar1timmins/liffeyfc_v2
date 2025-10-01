const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Email server running - Web3Forms integration active'
    });
});

// Info endpoint
app.get('/', (req, res) => {
    res.json({ 
        service: 'Liffey FC Email Service',
        status: 'Web3Forms integration',
        health: '/health'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found - using Web3Forms for email' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`📧 Email server running on port ${PORT}`);
    console.log(`🚀 Health check: http://localhost:${PORT}/health`);
    console.log(`✉️  Using Web3Forms for email delivery`);
});