const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
let nodemailer;
try {
    nodemailer = require('nodemailer');
    console.log('✅ Nodemailer loaded successfully');
    console.log('📦 Nodemailer version:', require('nodemailer/package.json').version);
    console.log('🔍 Nodemailer type:', typeof nodemailer);
    console.log('🔍 Has createTransport?', typeof nodemailer.createTransport);
    console.log('🔍 Nodemailer keys:', Object.keys(nodemailer).join(', '));
    
    // Validate that createTransport exists
    if (typeof nodemailer.createTransport !== 'function') {
        console.error('❌ createTransport not found in nodemailer object');
        console.error('Available properties:', Object.keys(nodemailer));
        process.exit(1);
    }
} catch (err) {
    console.error('❌ Failed to load nodemailer:', err.message);
    process.exit(1);
}
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

function createTransporter(config) {
    // Validation already done at module load, so we can safely use nodemailer here
    console.log('🔧 Creating transporter with config:', {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user ? '***' : 'missing'
    });
    
    const transporterConfig = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.pass
        },
        // Enhanced connection settings for reliability
        connectionTimeout: 60000, // 60 seconds
        greetingTimeout: 30000,
        socketTimeout: 60000,
        pool: true,
        maxConnections: 5,
        maxMessages: 100
    };
    
    // Gmail-specific optimizations
    if (config.host?.includes('gmail.com')) {
        console.log('🔧 Applying Gmail-specific configuration');
        transporterConfig.service = 'gmail';
        transporterConfig.tls = {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        };
        // Remove host/port when using service
        delete transporterConfig.host;
        delete transporterConfig.port;
        delete transporterConfig.secure;
    } else {
        // For other SMTP providers, use standard TLS settings
        transporterConfig.tls = {
            rejectUnauthorized: false,
            minVersion: 'TLSv1.2'
        };
    }
    
    const newTransporter = nodemailer.createTransport(transporterConfig);
    
    console.log(`📮 Using SMTP: ${config.host}:${config.port} (secure: ${config.secure})`);
    
    return newTransporter;
}

if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    // Primary SMTP configuration with smart defaults
    const port = parseInt(process.env.SMTP_PORT) || 587;
    const isGmail = process.env.SMTP_HOST?.includes('gmail.com');
    const isZoho = process.env.SMTP_HOST?.includes('zoho.com');
    
    console.log('🔍 Environment SMTP_SECURE:', process.env.SMTP_SECURE);
    console.log('🔍 SMTP_SECURE is undefined?', process.env.SMTP_SECURE === undefined);
    
    // Smart secure setting based on provider and port
    let secure;
    if (process.env.SMTP_SECURE !== undefined && process.env.SMTP_SECURE !== '') {
        secure = process.env.SMTP_SECURE === 'true';
        console.log('🔧 Using SMTP_SECURE from env:', secure);
    } else {
        // Auto-detect based on port and provider
        if (port === 465) {
            secure = true; // Always secure for port 465
        } else if (port === 587) {
            secure = false; // Use STARTTLS for port 587
        } else {
            secure = false; // Default to STARTTLS
        }
        console.log('🔧 Auto-detected secure setting for port', port, ':', secure);
    }
    
    const primaryConfig = {
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    };
    
    console.log(`📮 SMTP Configuration: ${primaryConfig.host}:${primaryConfig.port} (secure: ${primaryConfig.secure})`);
    if (isGmail) {
        console.log('📧 Gmail SMTP detected - optimizing configuration');
    } else if (isZoho) {
        console.log('📧 Zoho SMTP detected - using compatible settings');
    }
    
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

// ---------------------------------------------------------------------------
// Unified email sender: Resend HTTP API (preferred) → nodemailer SMTP fallback
// Resend uses port 443 (HTTPS) so it is never blocked on Railway or any host.
// Set RESEND_API_KEY env var to enable. SMTP is used only if the key is absent.
// ---------------------------------------------------------------------------
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function isEmailConfigured() {
    return !!(RESEND_API_KEY || transporter);
}

async function sendEmail({ from, to, subject, html, text, replyTo }) {
    if (RESEND_API_KEY) {
        const body = {
            from,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
            text
        };
        if (replyTo) body.reply_to = replyTo;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(`Resend API error ${response.status}: ${err.message || response.statusText}`);
        }

        const data = await response.json();
        console.log(`📧 Resend: email sent — id ${data.id}`);
        return { messageId: data.id };
    }

    if (transporter) {
        const info = await transporter.sendMail({ from, to, subject, html, text, replyTo });
        return { messageId: info.messageId };
    }

    throw new Error('No email transport configured (set RESEND_API_KEY or SMTP_HOST/USER/PASS)');
}

console.log(`📧 Email transport: ${RESEND_API_KEY ? 'Resend HTTP API ✅' : transporter ? 'SMTP nodemailer' : 'none ⚠️'}`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        message: 'Email server running - Web3Forms integration active',
        email_transport: RESEND_API_KEY ? 'resend' : transporter ? 'smtp' : 'none',
        email_configured: isEmailConfigured(),
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

        // Check if email sending is configured
        if (!isEmailConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email not configured - set RESEND_API_KEY or SMTP credentials'
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
        const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;
        const fromName = process.env.FROM_NAME || "Liffey Founders Club";
        
        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to: email,
            subject: 'Welcome to Liffey Founders Club - Registration Confirmed!',
            text: welcomeEmailText,
            html: welcomeEmailHTML,
            // Optional: Set reply-to if different from from address
            replyTo: process.env.REPLY_TO_EMAIL || fromAddress
        };

        console.log(`📧 Attempting to send welcome email to: ${email}`);

        const info = await sendEmail(mailOptions);
        console.log(`✅ Welcome email sent successfully to: ${email} (${name}) — ${info.messageId}`);

        res.json({
            success: true,
            message: 'Welcome email sent successfully',
            recipient: email,
            messageId: info.messageId
        });

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

// Registration welcome email endpoint
// Called by backend after a new user account is created
app.post('/send-registration-welcome', [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().isLength({ min: 1, max: 100 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        if (!isEmailConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email not configured - set RESEND_API_KEY or SMTP credentials'
            });
        }

        const { email, name } = req.body;
        const dashboardUrl = `${process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com'}/dashboard`;
        const companiesUrl = `${process.env.FRONTEND_URL || 'https://liffeyfoundersclub.com'}/companies`;

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f0f1a; color: #e0e0e0; }
                .wrapper { max-width: 620px; margin: 0 auto; padding: 24px 16px; }
                .card { background: #1a1a2e; border-radius: 16px; overflow: hidden; border: 1px solid #2a2a4a; }
                .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 40px 32px 32px; text-align: center; }
                .header h1 { color: #fff; font-size: 26px; font-weight: 700; margin-bottom: 8px; }
                .header p { color: #c4b5fd; font-size: 15px; }
                .body { padding: 32px; }
                .greeting { font-size: 17px; color: #e0e0e0; margin-bottom: 20px; line-height: 1.6; }
                .section { background: #0f0f1a; border-radius: 12px; padding: 20px; margin: 20px 0; border-left: 4px solid #4f46e5; }
                .section h3 { color: #a78bfa; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }
                .section ul { list-style: none; padding: 0; }
                .section ul li { color: #c4b5fd; font-size: 14px; padding: 6px 0; padding-left: 20px; position: relative; line-height: 1.5; }
                .section ul li::before { content: "→"; position: absolute; left: 0; color: #4f46e5; }
                .event-box { background: linear-gradient(135deg, #1e1b4b 0%, #2e1065 100%); border-radius: 12px; padding: 24px; margin: 20px 0; border: 1px solid #4f46e5; text-align: center; }
                .event-box .label { color: #a78bfa; font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 8px; }
                .event-box .event-name { color: #fff; font-size: 20px; font-weight: 700; margin-bottom: 6px; }
                .event-box .event-sub { color: #c4b5fd; font-size: 14px; margin-bottom: 16px; }
                .event-detail { display: inline-block; background: #0f0f1a; border-radius: 8px; padding: 8px 16px; margin: 4px; font-size: 13px; color: #e0e0e0; }
                .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px auto 8px; display: block; text-align: center; }
                .footer { background: #0a0a12; padding: 20px 32px; text-align: center; font-size: 12px; color: #555; border-top: 1px solid #2a2a4a; }
                .footer a { color: #7c3aed; text-decoration: none; }
            </style>
        </head>
        <body>
            <div class="wrapper">
                <div class="card">
                    <div class="header">
                        <h1>Welcome to Liffey Founders Club!</h1>
                        <p>Dublin's Premier Startup & Founders Community</p>
                    </div>

                    <div class="body">
                        <p class="greeting">Hi <strong>${name}</strong>,<br><br>
                        Your account is ready. You're now part of Liffey Founders Club — a community built for founders, investors, and builders across Dublin and beyond. We're thrilled to have you on board.</p>

                        <div class="event-box">
                            <div class="label">Next LFC Event</div>
                            <div class="event-name">Liffey Founders Club — Pitch Night</div>
                            <div class="event-sub">Quarterly founders pitch event &amp; networking evening</div>
                            <span class="event-detail">📅 Q2 2026</span>
                            <span class="event-detail">📍 Dublin City Centre</span>
                            <span class="event-detail">🎤 Live Pitches</span>
                            <span class="event-detail">🤝 Investor Networking</span>
                        </div>

                        <div class="section">
                            <h3>What to Expect at Events</h3>
                            <ul>
                                <li>Founder pitches — 5 minutes on stage with live Q&amp;A from investors</li>
                                <li>Investor introductions — meet active angels and VCs</li>
                                <li>Open networking — connect with founders, builders, and mentors</li>
                                <li>Panel discussions — insights from successful Irish founders</li>
                                <li>Startup showcase — demo tables and product displays</li>
                            </ul>
                        </div>

                        <div class="section">
                            <h3>Get Started on the Platform</h3>
                            <ul>
                                <li>Create or claim your company profile</li>
                                <li>Add wishlist items and crowdfund via blockchain bounties</li>
                                <li>Browse other companies and connect with the community</li>
                                <li>Connect your Web3 wallet for full platform access</li>
                            </ul>
                        </div>

                        <a href="${dashboardUrl}" class="btn">Go to Your Dashboard →</a>

                        <p style="text-align:center; color:#555; font-size:13px; margin-top:12px;">
                            Or browse the <a href="${companiesUrl}" style="color:#7c3aed; text-decoration:none;">companies directory</a>
                        </p>

                        <p style="margin-top:28px; font-size:14px; color:#888; line-height:1.6;">
                            Questions? Reply to this email and we'll get back to you.<br><br>
                            See you at the next event,<br>
                            <strong style="color:#c4b5fd;">The Liffey Founders Club Team</strong>
                        </p>
                    </div>

                    <div class="footer">
                        <p>You received this because you registered at <a href="https://liffeyfoundersclub.com">liffeyfoundersclub.com</a></p>
                        <p style="margin-top:6px;">Liffey Founders Club · Dublin, Ireland</p>
                    </div>
                </div>
            </div>
        </body>
        </html>`;

        const text = `Welcome to Liffey Founders Club!

Hi ${name},

Your account is ready. You're now part of Liffey Founders Club — a community built for founders, investors, and builders across Dublin and beyond.

--- NEXT EVENT ---
Liffey Founders Club — Pitch Night
Quarterly founders pitch event & networking evening
Date: Q2 2026 | Location: Dublin City Centre

What to Expect:
→ Founder pitches (5 min on stage + live Q&A from investors)
→ Investor introductions — meet active angels and VCs
→ Open networking with founders, builders, and mentors
→ Panel discussions from successful Irish founders
→ Startup showcase and demo tables

Get Started on the Platform:
→ Create or claim your company profile
→ Add wishlist items and crowdfund via blockchain bounties
→ Browse companies and connect with the community
→ Connect your Web3 wallet for full platform access

Go to your dashboard: ${dashboardUrl}

Questions? Reply to this email.
See you at the next event,
The Liffey Founders Club Team

---
Liffey Founders Club · Dublin, Ireland · liffeyfoundersclub.com`;

        const fromAddress = process.env.FROM_EMAIL || process.env.SMTP_USER;
        const fromName = process.env.FROM_NAME || 'Liffey Founders Club';

        const mailOptions = {
            from: `"${fromName}" <${fromAddress}>`,
            to: email,
            subject: '🎉 Welcome to Liffey Founders Club — You\'re In!',
            text,
            html,
            replyTo: process.env.REPLY_TO_EMAIL || fromAddress
        };

        console.log(`📧 Sending registration welcome email to: ${email}`);

        const info = await sendEmail(mailOptions);
        console.log(`✅ Registration welcome sent to ${email} (${name}) — ${info.messageId}`);
        return res.json({ success: true, message: 'Welcome email sent', messageId: info.messageId });

    } catch (error) {
        console.error('❌ Error sending registration welcome:', error);
        res.status(500).json({ success: false, message: 'Failed to send welcome email', error: error.message });
    }
});

// Password reset email endpoint
app.post('/send-password-reset', [
    body('to').isEmail().normalizeEmail(),
    body('resetUrl').trim().isLength({ min: 10, max: 500 })
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

        // Check if email sending is configured
        if (!isEmailConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Email not configured - set RESEND_API_KEY or SMTP credentials'
            });
        }

        const { to, resetUrl } = req.body;

        // Create password reset email content
        const resetEmailHTML = `
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
                .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
                .footer { background: #333; color: #ccc; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
                .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin: 15px 0; }
                .code { font-family: 'Courier New', monospace; background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 Password Reset Request</h1>
                    <p>Liffey Founders Club</p>
                </div>
                
                <div class="content">
                    <p>Hello,</p>
                    
                    <p>We received a request to reset your password for your Liffey Founders Club account.</p>
                    
                    <div class="highlight">
                        <p style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Your Password</a>
                        </p>
                        <p style="text-align: center; font-size: 12px; color: #666;">
                            Or copy and paste this link into your browser:<br>
                            <span class="code">${resetUrl}</span>
                        </p>
                    </div>
                    
                    <div class="warning">
                        <h3>⏰ Time Limit:</h3>
                        <p>This password reset link will expire in <strong>1 hour</strong> for security reasons.</p>
                    </div>
                    
                    <div class="warning">
                        <h3>🔒 Security Notice:</h3>
                        <p>If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
                        <p>If you're concerned about your account security, please contact us immediately.</p>
                    </div>
                    
                    <p>Best regards,<br>
                    <strong>The Liffey Founders Club Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>This email was sent because a password reset was requested for this account</p>
                    <p>liffeyfoundersclub.com | Dublin, Ireland</p>
                </div>
            </div>
        </body>
        </html>`;

        const resetEmailText = `Password Reset Request - Liffey Founders Club

Hello,

We received a request to reset your password for your Liffey Founders Club account.

To reset your password, click the link below or copy and paste it into your browser:

${resetUrl}

Time Limit:
This password reset link will expire in 1 hour for security reasons.

Security Notice:
If you didn't request this password reset, please ignore this email. Your password will remain unchanged.

If you're concerned about your account security, please contact us immediately.

Best regards,
The Liffey Founders Club Team

---
This email was sent because a password reset was requested for this account
liffeyfoundersclub.com | Dublin, Ireland`;

        const mailOptions = {
            from: `"Liffey Founders Club" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: to,
            subject: '🔐 Password Reset Request - Liffey Founders Club',
            text: resetEmailText,
            html: resetEmailHTML
        };

        const info = await sendEmail(mailOptions);

        console.log('✅ Password reset email sent:', {
            messageId: info.messageId,
            to: to,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Password reset email sent successfully',
            messageId: info.messageId
        });
    } catch (error) {
        console.error('❌ Failed to send password reset email:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send email',
            error: error.message
        });
    }
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
    console.log(`✉️  Email transport: ${RESEND_API_KEY ? 'Resend HTTP API' : transporter ? 'SMTP' : 'none (unconfigured)'}`);
    console.log(`🌐 CORS origins: ${allowedOrigins.join(', ')}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('✅ Server ready to accept connections');
});