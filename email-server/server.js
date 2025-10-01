const express = require('express');
const { Resend } = require('resend'); // Changed from nodemailer
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Trust proxy for Railway (needed for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4173', 'https://liffeyfoundersclub.com'],
    methods: ['POST'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: { error: 'Too many form submissions, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/contact/submit', limiter); // Apply limiter only to the submit endpoint

app.use(express.json({ limit: '10kb' }));

// The nodemailer 'createTransporter' function has been removed.

// Verify reCAPTCHA
const verifyRecaptcha = async (token) => {
    try {
        if (!process.env.RECAPTCHA_SECRET_KEY) {
            console.error('RECAPTCHA_SECRET_KEY environment variable is not set');
            return false;
        }

        const response = await axios.post('https://www.google.com/recaptcha/api/siteverify', null, {
            params: {
                secret: process.env.RECAPTCHA_SECRET_KEY,
                response: token
            }
        });
        
        console.log('reCAPTCHA verification response:', response.data);
        
        if (!response.data.success || (response.data.score !== undefined && response.data.score < 0.5)) {
            console.error('reCAPTCHA verification failed:', response.data['error-codes'] || `Low score: ${response.data.score}`);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('reCAPTCHA verification failed:', error);
        return false;
    }
};

// Validation middleware
const validateContactForm = [
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('pitchedBefore').isIn(['Yes', 'No']),
    body('interest').isIn(['Attending', 'Pitching my business', 'Investing / Partnering']),
    body('message').optional().trim().isLength({ max: 1000 }).escape(),
    body('event_year').isInt({ min: 2024, max: 2030 }),
    body('event_quarter').isIn(['Q1', 'Q2', 'Q3', 'Q4']),
    body('consent').isBoolean().equals('true'),
    body('recaptchaToken').notEmpty()
];

// Contact form endpoint
app.post('/api/contact/submit', validateContactForm, async (req, res) => {
    try {
        // Validation
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'validation_failed',
                errors: errors.array().reduce((acc, err) => ({...acc, [err.path]: err.msg }), {})
            });
        }

        const { name, email, pitchedBefore, interest, message, event_year, event_quarter, recaptchaToken } = req.body;

        // reCAPTCHA Verification
        if (!await verifyRecaptcha(recaptchaToken)) {
            return res.status(400).json({ error: 'reCAPTCHA verification failed' });
        }
        
        // Define email properties
        // IMPORTANT: The domain in fromEmail must be verified in your Resend account.
        const fromEmail = 'Liffey Founders Club <noreply@liffeyfoundersclub.com>';
        const adminRecipient = 'karl@liffeyfoundersclub.com';

        // HTML content for the admin notification email
        const adminEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">New Contact Form Submission</h2>
                
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Personal Information</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Interest Details</h3>
                    <p><strong>Have you pitched before:</strong> ${pitchedBefore}</p>
                    <p><strong>What interests you:</strong> ${interest}</p>
                    ${message ? `<p><strong>Additional Message:</strong> ${message}</p>` : ''}
                </div>

                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Event Information</h3>
                    <p><strong>Event Year:</strong> ${event_year}</p>
                    <p><strong>Event Quarter:</strong> ${event_quarter}</p>
                </div>

                <div style="background: #ecfdf5; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0; color: #065f46;"><strong>✓ Consent Given:</strong> Yes</p>
                    <p style="margin: 5px 0 0 0; color: #065f46;"><strong>✓ reCAPTCHA Verified:</strong> Yes</p>
                    <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 14px;">Submitted: ${new Date().toISOString()}</p>
                </div>

                <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                <p style="color: #6b7280; font-size: 12px;">This email was sent via the Liffey FC website contact form.</p>
            </div>
        `;

        // HTML content for the user auto-reply email
        const autoReplyHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 24px;">Thank you, ${name}!</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9;">We're excited about your interest in Liffey Founders Club</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <p>Hi ${name},</p>
                    
                    <p>Thank you for registering your interest in Liffey Founders Club! We're excited that you want to <strong>${interest.toLowerCase()}</strong>.</p>
                    
                    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 25px 0; border-left: 4px solid #2563eb;">
                        <h3 style="margin: 0 0 15px 0; color: #1e40af;">What happens next:</h3>
                        <p style="margin: 8px 0;">🗓️ Our next event is scheduled for <strong>${event_quarter} ${event_year}</strong></p>
                        <p style="margin: 8px 0;">📧 We'll send you event details and updates closer to the date</p>
                        <p style="margin: 8px 0;">🤝 You'll be among the first to know about registration opening</p>
                    </div>

                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 25px 0;">
                        <h3 style="margin: 0 0 15px 0; color: #374151;">Your submission details:</h3>
                        <p style="margin: 5px 0;"><strong>Interest:</strong> ${interest}</p>
                        ${message ? `<p style="margin: 5px 0;"><strong>Your message:</strong> "${message}"</p>` : ''}
                    </div>

                    <p>We look forward to seeing you at our upcoming event! If you have any questions in the meantime, feel free to reply to this email.</p>
                    
                    <p style="margin-top: 30px;">
                        Best regards,<br>
                        <strong>The Liffey Founders Club Team</strong>
                    </p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    <p style="color: #6b7280; font-size: 12px;">
                        This is an automated response. For questions, contact us at 
                        <a href="mailto:${adminRecipient}" style="color: #2563eb;">${adminRecipient}</a>
                    </p>
                </div>
            </div>
        `;
        
        // Send emails using Resend
        const [adminResult, userResult] = await Promise.all([
            resend.emails.send({
                from: fromEmail,
                to: adminRecipient,
                reply_to: email,
                subject: `New Interest Form Submission from ${name}`,
                html: adminEmailHtml,
            }),
            resend.emails.send({
                from: fromEmail,
                to: email,
                subject: `Thank you for your interest in Liffey Founders Club, ${name}!`,
                html: autoReplyHtml,
            })
        ]);

        // Check for errors
        if (adminResult.error) {
            console.error('Failed to send admin email:', adminResult.error);
            throw new Error('Failed to send notification email.');
        }
        if (userResult.error) {
            // Log the error for the auto-reply but don't fail the request,
            // as the primary notification to admin was successful.
            console.warn('Failed to send auto-reply to user:', userResult.error);
        }

        console.log('Admin email sent successfully. ID:', adminResult.data?.id);

        res.json({ 
            success: true, 
            message: 'Form submitted successfully. Check your email for confirmation.' 
        });

    } catch (error) {
        console.error('An error occurred in the contact form endpoint:', error);
        res.status(500).json({ 
            error: 'Failed to process your request. Please try again later.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '2.0.0' // Version updated for Resend integration
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`📧 Email server (using Resend) running on port ${PORT}`);
    console.log(`🚀 Health check: http://localhost:${PORT}/health`);
});
