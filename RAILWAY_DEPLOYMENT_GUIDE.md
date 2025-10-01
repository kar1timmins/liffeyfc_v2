# 🚀 Railway Deployment Guide - Email Server

## Why Email Server (Not NestJS) for Railway

### **Resource Efficiency:**
- **Email Server**: ~15MB bundle, ~50MB RAM usage
- **NestJS Backend**: ~50MB+ bundle, ~150MB+ RAM usage
- **Railway Cost**: Email server uses 3x fewer resources

### **Performance Benefits:**
- ⚡ **Faster cold starts** (important for Railway's sleep/wake cycle)
- 🔧 **Purpose-built** for contact form handling
- 📦 **Smaller deployments** (faster CI/CD)

## 🚀 Railway Deployment Steps

### **Step 1: Prepare Email Server for Railway**

1. **Add railway.json configuration:**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "nixpacks"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 300
  }
}
```

### **Step 2: Deploy to Railway**

#### **Option A: Railway CLI (Recommended)**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to email server
cd email-server

# Initialize and deploy
railway up
```

#### **Option B: GitHub Integration**
1. **Push to GitHub** (your repo is already connected)
2. **Create new Railway project**
3. **Connect GitHub repo**
4. **Set root directory**: `/email-server`
5. **Deploy automatically**

### **Step 3: Configure Environment Variables**

In Railway dashboard, add these environment variables:

```env
# Zoho Mail Configuration
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=your_zoho_app_specific_password

# Email Settings
ADMIN_EMAIL=info@liffeyfoundersclub.com

# reCAPTCHA
RECAPTCHA_SECRET_KEY=6LfLPNorAAAAABvIaDLGT0nz6_v7DjLfVlgO5gPB

# Security
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com

# Railway will set PORT automatically
```

### **Step 4: Update Frontend**

Once deployed, Railway will give you a URL like: `https://your-app-name.railway.app`

Update your frontend form:

```javascript
// In /frontend/src/routes/learnMore/+page.svelte
const res = await fetch('https://your-app-name.railway.app/api/contact/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
});
```

## 📊 **Railway Resource Usage**

### **Email Server (Recommended):**
- **CPU**: ~0.1 vCPU average
- **Memory**: ~50MB average  
- **Network**: Minimal
- **Cost**: Within free tier easily

### **NestJS Backend:**
- **CPU**: ~0.2-0.3 vCPU average
- **Memory**: ~150MB+ average
- **Network**: Higher overhead
- **Cost**: May exceed free tier faster

## 🔍 **Why Not NestJS for This Use Case?**

1. **Overkill**: NestJS is designed for complex APIs with multiple modules, authentication, database integrations, etc.

2. **Resource Heavy**: The framework overhead isn't justified for a simple email service

3. **Cold Start Penalty**: Railway puts inactive services to sleep - NestJS takes longer to wake up

4. **Maintenance Complexity**: More dependencies, more potential issues

## ✅ **Email Server Advantages**

1. **Lean & Fast**: Built specifically for your email needs
2. **Railway Optimized**: Designed for serverless/container deployment
3. **Cost Effective**: Uses minimal resources
4. **Easy Debugging**: Simple Express server, easy to troubleshoot
5. **Auto-scaling**: Handles traffic spikes efficiently

## 🎯 **Deployment Decision Matrix**

| Need | Email Server | NestJS Backend |
|------|-------------|----------------|
| **Simple contact form** | ✅ Perfect fit | ❌ Overkill |
| **Multiple API endpoints** | ❌ Limited | ✅ Great choice |
| **Database integration** | ❌ Basic | ✅ Excellent |
| **Authentication system** | ❌ Not designed for it | ✅ Built-in |
| **Railway deployment** | ✅ Ideal | ⚠️ Resource heavy |
| **Cost efficiency** | ✅ Minimal usage | ❌ Higher usage |

## 🚀 **Recommendation**

**Use the standalone email server for Railway deployment** because:

- ✅ **Perfect for your current needs** (contact form only)
- ✅ **Railway optimized** (fast, lean, cost-effective)
- ✅ **Already built and tested**
- ✅ **Easy to maintain and debug**

**Consider NestJS later if you add:**
- User authentication
- Database operations  
- Multiple API endpoints
- Complex business logic

For now, the email server is the optimal choice for Railway deployment! 🎯