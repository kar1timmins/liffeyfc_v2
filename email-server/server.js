const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy for Railway
app.set('trust proxy', 1);

// Security middleware
// Security and CORS configuration
app.use(helmet());

// CORS configuration - allow your frontend domains
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'https://liffeyfoundersclub.com',
        'https://www.liffeyfoundersclub.com',
        'http://localhost:4173',
        'http://localhost:5173'
    ];

console.log('🔧 CORS allowed origins:', allowedOrigins);

// Add preflight handler for all routes
app.options('*', cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        console.log('❌ CORS blocked origin:', origin);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        
        console.log('❌ CORS blocked origin:', origin);
        const msg = `CORS policy: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(', ')}`;
        return callback(new Error(msg), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Origin', 'X-Requested-With']
}));

app.use(express.json());

// SMTP transporter configuration with multiple provider support
let transporter = null;
const createTransporter = (config) => {
    return nodemailer.createTransport({
        host: config.host,
        port: parseInt(config.port),
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        },
        // Connection timeout and retry settings
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,   // 30 seconds
        socketTimeout: 60000,     // 60 seconds
        
        // Connection pooling
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        
        // TLS settings for better compatibility
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: false
        },
        
        // Debug logging
        debug: process.env.NODE_ENV !== 'production',
        logger: process.env.NODE_ENV !== 'production'
    });
};

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Primary SMTP configuration
    const primaryConfig = {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    };
    
    transporter = createTransporter(primaryConfig);
    
    // Verify SMTP connection (non-blocking)
    setTimeout(() => {
        try {
            transporter.verify((error, success) => {
                if (error) {
                    console.log('❌ SMTP verification failed:', error.message);
                    console.log('💡 Consider switching to Gmail or SendGrid SMTP');
                    console.log('📖 See SMTP_ALTERNATIVES.md for setup instructions');
                } else {
                    console.log('✅ SMTP server ready for messages');
                }
            });
        } catch (verifyError) {
            console.log('⚠️ SMTP verification error:', verifyError.message);
        }
    }, 1000); // Delay verification to not block startup
    
    console.log('📧 SMTP transporter configured with timeouts and pooling');
    console.log(`📮 Using SMTP: ${primaryConfig.host}:${primaryConfig.port} (secure: ${primaryConfig.secure})`);
} else {
    console.log('⚠️  SMTP not configured - welcome emails will be disabled');
    console.log('Missing env vars:', {
        SMTP_HOST: !!process.env.SMTP_HOST,
        SMTP_USER: !!process.env.SMTP_USER,
        SMTP_PASS: !!process.env.SMTP_PASS
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Email server running - Web3Forms integration active',
        smtp_configured: !!transporter,
        allowed_origins: allowedOrigins,
        request_origin: req.get('Origin') || 'none'
    });
});

// CORS test endpoint
app.get('/cors-test', (req, res) => {
    res.json({
        message: 'CORS working correctly',
        origin: req.get('Origin') || 'no-origin',
        timestamp: new Date().toISOString()
    });
});

// SMTP test endpoint
app.get('/smtp-test', async (req, res) => {
    if (!transporter) {
        return res.status(503).json({
            success: false,
            message: 'SMTP not configured',
            configured: false
        });
    }
    
    try {
        await transporter.verify();
        res.json({
            success: true,
            message: 'SMTP connection successful',
            configured: true,
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'SMTP connection failed',
            configured: true,
            error: error.message,
            code: error.code
        });
    }
});

// Welcome email endpoint
app.post('/send-welcome', [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('interest').optional().trim(),
    body('pitchedBefore').optional().isIn(['Yes', 'No']),
    body('eventQuarter').optional().trim(),
    body('eventYear').optional().isNumeric()
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ 
                success: false, 
                errors: errors.array() 
            });
        }

        // Check if SMTP is configured
        if (!transporter) {
            return res.status(503).json({
                success: false,
                message: 'SMTP not configured - welcome emails disabled'
            });
        }

        const { email, name, interest, pitchedBefore, eventQuarter, eventYear } = req.body;

        // Create welcome email content
        const welcomeEmailHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px 20px; }
                .highlight { background: #fff; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #667eea; }
                .footer { background: #333; color: #ccc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .emoji { font-size: 1.2em; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🚀 Welcome to Liffey Founders Club!</h1>
                    <p>Dublin's Premier Startup Community</p>
                </div>
                
                <div class="content">
                    <p>Hello <strong>${name}</strong>,</p>
                    
                    <p>Thank you for registering your interest with Liffey Founders Club! We're excited to have you join Dublin's premier startup community.</p>
                    
                    <div class="highlight">
                        <h3><span class="emoji">🎯</span> What's Next:</h3>
                        <p>Your registration for our <strong>${eventQuarter || 'upcoming'} ${eventYear || '2025'}</strong> event has been received. We'll be in touch soon with event details and networking opportunities.</p>
                    </div>
                    
                    ${interest ? `
                    <div class="highlight">
                        <h3><span class="emoji">💡</span> About Your Interest:</h3>
                        <p>You mentioned you're interested in: <strong>${interest}</strong></p>
                        <p>${pitchedBefore === 'Yes' ? 
                            "We see you've pitched before - great! We'd love to hear about your experience." : 
                            "New to pitching? Perfect! Our community is welcoming to founders at all stages."
                        }</p>
                    </div>
                    ` : ''}
                    
                    <div class="highlight">
                        <h3><span class="emoji">🌟</span> What to Expect:</h3>
                        <ul>
                            <li>Quarterly networking events with fellow entrepreneurs</li>
                            <li>Opportunities to practice and refine your pitch</li>
                            <li>Access to investors and industry mentors</li>
                            <li>Supportive community of Dublin-based founders</li>
                            <li>Regular updates on startup ecosystem events</li>
                        </ul>
                    </div>
                    
                    <div class="highlight">
                        <h3><span class="emoji">📧</span> Stay Connected:</h3>
                        <p>Follow us for the latest updates and community news. We'll send you event details and agenda closer to the date.</p>
                    </div>
                    
                    <p><strong>Questions?</strong> Simply reply to this email - we're here to help!</p>
                    
                    <p>Best regards,<br>
                    <strong>The Liffey Founders Club Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>This email was sent because you registered at liffeyfoundersclub.com</p>
                    <p>Event: ${eventQuarter || 'Upcoming'} ${eventYear || '2025'} | Location: Dublin, Ireland</p>
                </div>
            </div>
        </body>
        </html>`;

        const welcomeEmailText = `Welcome to Liffey Founders Club!

Hello ${name},

Thank you for registering your interest with Liffey Founders Club! We're excited to have you join Dublin's premier startup community.

What's Next:
Your registration for our ${eventQuarter || 'upcoming'} ${eventYear || '2025'} event has been received. We'll be in touch soon with event details and networking opportunities.

${interest ? `About Your Interest:
You mentioned you're interested in: ${interest}
${pitchedBefore === 'Yes' ? 
    "We see you've pitched before - great! We'd love to hear about your experience." : 
    "New to pitching? Perfect! Our community is welcoming to founders at all stages."
}

` : ''}What to Expect:
• Quarterly networking events with fellow entrepreneurs
• Opportunities to practice and refine your pitch
• Access to investors and industry mentors
• Supportive community of Dublin-based founders
• Regular updates on startup ecosystem events

Stay Connected:
Follow us for the latest updates and community news. We'll send you event details and agenda closer to the date.

Questions? Simply reply to this email - we're here to help!

Best regards,
The Liffey Founders Club Team

---
This email was sent because you registered at liffeyfoundersclub.com
Event: ${eventQuarter || 'Upcoming'} ${eventYear || '2025'} | Location: Dublin, Ireland`;

        // Send email with retry logic
        const mailOptions = {
            from: `"Liffey Founders Club" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Welcome to Liffey Founders Club - Registration Confirmed!',
            text: welcomeEmailText,
            html: welcomeEmailHTML
        };

        console.log(`📧 Attempting to send welcome email to: ${email}`);
        
        // Retry logic for SMTP timeouts
        let retries = 3;
        let lastError;
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const info = await transporter.sendMail(mailOptions);
                console.log(`✅ Welcome email sent successfully to: ${email} (${name})`);
                console.log('📧 Message ID:', info.messageId);
                
                res.json({
                    success: true,
                    message: 'Welcome email sent successfully',
                    recipient: email,
                    messageId: info.messageId
                });
                return; // Success, exit the function
                
            } catch (attemptError) {
                lastError = attemptError;
                console.log(`❌ Attempt ${attempt}/${retries} failed:`, attemptError.message);
                
                if (attempt < retries) {
                    const waitTime = attempt * 1000; // 1s, 2s, 3s delay
                    console.log(`⏳ Retrying in ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        // All retries failed
        throw lastError;

    } catch (error) {
        console.error('❌ Error sending welcome email:', error);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to send welcome email';
        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
            errorMessage = 'SMTP connection timeout - please try again later';
        } else if (error.code === 'EAUTH') {
            errorMessage = 'SMTP authentication failed';
        } else if (error.code === 'EENVELOPE') {
            errorMessage = 'Invalid email address';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            code: error.code
        });
    }
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
    if (req.method === 'OPTIONS') {
        // Handle any missed OPTIONS requests
        res.header('Access-Control-Allow-Origin', req.get('Origin') || '*');
        res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type,Accept,Origin,X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        return res.sendStatus(204);
    }
    res.status(404).json({ error: 'Endpoint not found - using Web3Forms for email' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error.message);
    console.error('📍 Stack trace:', error.stack);
    console.error('🔍 Request:', {
        method: req.method,
        url: req.url,
        origin: req.get('Origin'),
        headers: req.headers
    });
    
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log('🚀 Server starting...');
    console.log(`📧 Email server running on port ${PORT}`);
    console.log(`� Health check: http://localhost:${PORT}/health`);
    console.log(`✉️  SMTP configured: ${!!transporter}`);
    console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ Server ready to accept connections');
});