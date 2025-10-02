# Deployment Checklist - Email Server Enhancement

## ✅ Pre-Deployment Setup

- [x] Email server enhanced with welcome email functionality
- [x] Frontend updated to call Railway email service
- [x] Environment variables configured (.env file ready)
- [x] SMTP configuration verified (Zoho Mail)
- [x] Professional email template created

## 🚀 Railway Deployment Steps

### 1. Deploy Email Server
```bash
cd email-server
railway login
railway link [your-project-id]
railway up
```

### 2. Set Environment Variables in Railway
```bash
# Navigate to Railway dashboard and set:
SMTP_HOST=smtp.zoho.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=info@liffeyfoundersclub.com
SMTP_PASS=[your-zoho-app-password]
PORT=3001
NODE_ENV=production
ALLOWED_ORIGINS=https://liffeyfoundersclub.com,https://www.liffeyfoundersclub.com
```

### 3. Update Frontend URL
- In `frontend/src/routes/learnMore/+page.svelte`
- Replace `https://your-railway-email-server.railway.app` with your actual Railway domain
- Line ~244: Update the fetch URL

### 4. Test Deployment
```bash
# Test health endpoint
curl https://your-railway-domain.railway.app/health

# Test welcome email
curl -X POST https://your-railway-domain.railway.app/send-welcome \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","name":"Test User","interest":"Testing"}'
```

## 📧 Email Flow Verification

1. **Form Submission Test:**
   - Go to liffeyfoundersclub.com/learnMore
   - Fill out the complete registration form
   - Submit and verify success message

2. **Admin Email Check:**
   - Check info@liffeyfoundersclub.com for admin notification
   - Verify all form data is included correctly

3. **Welcome Email Check:**
   - Check the registrant's email for welcome message
   - Verify professional formatting and correct personalization

## 🔧 Post-Deployment

- [ ] Update Railway domain in frontend code
- [ ] Test complete registration flow
- [ ] Verify welcome emails are being sent
- [ ] Monitor Railway logs for any errors
- [ ] Update DNS/deployment as needed

## 📝 Notes

- Web3Forms continues to handle admin notifications (working perfectly)
- Railway email server now handles welcome emails (new functionality)
- Both services work together for complete registration experience
- Fallback: If Railway email fails, form submission still succeeds via Web3Forms

## 🛟 Rollback Plan

If issues occur:
1. Comment out welcome email code in frontend (lines ~244-265)
2. Registration will continue working via Web3Forms only
3. Fix Railway deployment and re-enable welcome emails