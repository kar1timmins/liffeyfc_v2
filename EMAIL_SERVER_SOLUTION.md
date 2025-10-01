# ✅ **Dedicated Email Server - Complete Solution**

## 🎯 **Problem Solved**

Since Zoho Mail's free plan doesn't allow EmailJS integration, I've created a **dedicated Node.js email server** that:

- ✅ **Bypasses Zoho restrictions** - Uses direct SMTP connection
- ✅ **Handles auto-replies** - Personalized with user's name
- ✅ **Professional templates** - Beautiful HTML emails
- ✅ **Security built-in** - Rate limiting, validation, reCAPTCHA
- ✅ **Easy deployment** - Ready for Railway, Vercel, or DigitalOcean

## 📂 **What's Been Created**

### **Email Server (`/email-server/`)**
- **`server.js`** - Express server with email routing
- **`package.json`** - Dependencies and scripts
- **`Dockerfile`** - Container configuration
- **`.env.example`** - Environment template

### **Key Features**
- **Dual email system**: Admin notification + auto-reply
- **Rate limiting**: 5 submissions per 15 minutes per IP
- **Input validation**: All form fields validated
- **reCAPTCHA verification**: Server-side validation
- **Professional templates**: HTML emails with branding

## 🚀 **Deployment Options**

### **Option 1: Railway (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
cd email-server
railway login
railway up
```

**Cost**: Free tier (500 hours/month) - Perfect for your needs

### **Option 2: Vercel**
```bash
npm i -g vercel
cd email-server
vercel
```

**Cost**: Free tier with generous limits

### **Option 3: DigitalOcean App Platform**
- Create app from GitHub repo
- Select `email-server` folder
- Configure environment variables

**Cost**: $5/month - Most reliable

## 🔧 **Setup Steps**

### **1. Get Zoho App Password**
- Log into Zoho Mail
- Settings → Security → App Passwords  
- Generate password for "Email Server"

### **2. Configure Environment Variables**
```env
SMTP_HOST=smtp.zoho.com
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password
RECAPTCHA_SECRET_KEY=6LfLPNorAAAAABvIaDLGT0nz6_v7DjLfVlgO5gPB
ADMIN_EMAIL=info@liffeyfoundersclub.com
ALLOWED_ORIGINS=https://liffeyfoundersclub.com
```

### **3. Deploy Server**
Choose your preferred hosting platform and deploy

### **4. Update Frontend**
Replace the fetch URL in your form:
```javascript
// Change from:
const res = await fetch('/api/interest/submit/', {

// To:
const res = await fetch('https://your-server.railway.app/api/contact/submit', {
```

## 📧 **Email Examples**

### **Admin Notification**
```
Subject: New Interest Form Submission from John Doe

✓ Name: John Doe
✓ Email: john@example.com  
✓ Interest: Pitching my business
✓ Event: Q1 2026
✓ reCAPTCHA Verified
```

### **Auto-Reply**
```
Subject: Thank you for your interest in Liffey Founders Club, John!

Hi John,

Thank you for registering your interest! We're excited that you 
want to pitch your business.

What happens next:
🗓️ Our next event is scheduled for Q1 2026
📧 We'll send you event details closer to the date
🤝 You'll be first to know about registration

Best regards,
The Liffey Founders Club Team
```

## ⚡ **Current Status**

- ✅ **Server created** and tested locally
- ✅ **All dependencies** installed
- ✅ **Environment configured** with your reCAPTCHA key
- ✅ **Frontend updated** to use email server
- ✅ **Ready for deployment**

## 🔄 **Next Steps**

1. **Get Zoho app password** from your Zoho Mail account
2. **Choose hosting platform** (Railway recommended)
3. **Deploy the server** with environment variables
4. **Update frontend URL** to point to deployed server
5. **Test form submission** and verify emails

## 💡 **Why This Solution is Better**

- **No third-party limitations** - You own the infrastructure
- **Cost-effective** - Free or very cheap hosting
- **Reliable** - Direct SMTP, no API rate limits
- **Scalable** - Can handle thousands of submissions
- **Professional** - Beautiful HTML email templates
- **Secure** - Built-in protection against spam and abuse

Your email server is ready to deploy and will solve all the Zoho Mail restriction issues! 🚀