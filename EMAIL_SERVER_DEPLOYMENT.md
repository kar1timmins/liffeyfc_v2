# 🚀 Dedicated Email Server Deployment Guide

## 📧 **Why a Dedicated Email Server?**

- ✅ **Bypasses Zoho Mail restrictions** on free plans
- ✅ **Full control** over email routing and templates  
- ✅ **Auto-reply functionality** with personalized messages
- ✅ **Better reliability** than third-party services
- ✅ **Cost-effective** hosting options

## 🛠 **Quick Setup Options**

### **Option 1: Railway (Recommended - Free Tier)**

1. **Sign up at Railway.app**
2. **Connect your GitHub repo**
3. **Deploy the email-server folder**
4. **Add environment variables**:
   ```
   SMTP_HOST=smtp.zoho.com
   SMTP_USER=info@liffeyfoundersclub.com
   SMTP_PASS=your_app_specific_password
   RECAPTCHA_SECRET_KEY=your_secret_key
   ADMIN_EMAIL=info@liffeyfoundersclub.com
   ALLOWED_ORIGINS=https://liffeyfoundersclub.com
   ```

### **Option 2: Vercel (Serverless)**

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Deploy**: `cd email-server && vercel`
3. **Add environment variables** in Vercel dashboard

### **Option 3: DigitalOcean App Platform**

1. **Create new app** from GitHub repo
2. **Select email-server folder**
3. **Configure environment variables**
4. **Deploy**

## 🔧 **Local Development Setup**

1. **Install dependencies**:
   ```bash
   cd email-server
   npm install
   ```

2. **Create .env file**:
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

3. **Start the server**:
   ```bash
   npm run dev
   ```

4. **Test health endpoint**:
   ```bash
   curl http://localhost:3001/health
   ```

## 📝 **Environment Variables Required**

```env
# Zoho Mail Configuration
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_password

# Email Settings
ADMIN_EMAIL=info@liffeyfoundersclub.com

# reCAPTCHA
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key

# Security
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com

# Server
PORT=3001
```

## 🔐 **Security Features**

- ✅ **Rate limiting**: 5 requests per 15 minutes per IP
- ✅ **CORS protection**: Only allowed origins
- ✅ **Input validation**: All form fields validated
- ✅ **reCAPTCHA verification**: Server-side validation
- ✅ **Helmet.js**: Security headers
- ✅ **Request size limits**: 10KB max payload

## 📧 **Email Features**

### **Admin Notification Email**:
- Beautiful HTML template
- All form data organized
- Reply-to set to user's email
- reCAPTCHA verification status

### **Auto-Reply Email**:
- Personalized with user's name
- Dynamic content based on interest
- Event information included
- Professional branding

## 🌐 **Frontend Integration**

Your form now points to: `http://localhost:3001/api/contact/submit`

For production, update to your deployed server URL:
```javascript
const res = await fetch('https://your-email-server.railway.app/api/contact/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});
```

## 🚀 **Deployment Steps**

### **1. Get Zoho App Password**
- Log into Zoho Mail
- Settings → Security → App Passwords
- Generate password for "Email Server"

### **2. Deploy to Railway (Easiest)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
cd email-server
railway up
```

### **3. Configure Environment Variables**
Add all required env vars in Railway dashboard

### **4. Update Frontend URL**
Replace `localhost:3001` with your Railway app URL

### **5. Test Everything**
- Submit form
- Check admin email arrives
- Check user gets auto-reply

## 💰 **Cost Estimates**

- **Railway**: Free tier (500 hours/month) - Perfect for your needs
- **Vercel**: Free tier (100GB bandwidth) - Good for serverless
- **DigitalOcean**: $5/month - Most reliable

## 🔍 **Monitoring & Logs**

- **Health check**: `GET /health`
- **Logs**: Available in hosting platform dashboard
- **Error tracking**: Built-in error handling

## 🎯 **Benefits of This Approach**

1. **No EmailJS limitations** - Full control
2. **No Zoho restrictions** - Bypasses free plan limits
3. **Better deliverability** - Direct SMTP connection
4. **Professional emails** - Beautiful HTML templates
5. **Reliable scaling** - Modern hosting platforms

Your dedicated email server is ready to deploy! 🚀