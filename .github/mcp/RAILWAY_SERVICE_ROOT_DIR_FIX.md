# Railway Service Configuration Issue

## Problem
The `liffeyfc_form` service is building from the repository root instead of the `/email-server` directory, causing build failures.

## Current State
- ❌ `liffeyfc_form` service has incorrect Root Directory setting
- ✅ `liffeyfc_v2` service is correctly set to `/backend` directory
- ❌ Build logs show Railway detecting Node.js from repo root instead of email-server

## Solution: Update Railway Service Settings

### Via Railway Dashboard (REQUIRED)

1. **Go to Railway Project:**
   https://railway.app/project/d6533798-7ff1-49fd-ab0a-83ba7a69ebe0

2. **Click on `liffeyfc_form` service** (email server)

3. **Navigate to Settings → Source/Build**

4. **Update Root Directory:**
   - Current: (empty or `/backend` or `/`)
   - Change to: `email-server`

5. **Save and Redeploy**

## Expected Result After Fix

### Service: liffeyfc_form
- Root Directory: `email-server`
- Detects: Node.js app with `package.json`
- Builds: Email forwarding service
- Runs: `npm start` (from email-server/server.js)

### Service: liffeyfc_v2  
- Root Directory: `backend`
- Detects: Dockerfile
- Builds: NestJS API with migrations
- Runs: `./start.sh` (migrations + app)

## Current Service Configuration Summary

```
Railway Project: liffeyfc_form
├── Postgres--K3v        ✅ Running (infrastructure)
├── Redis                ✅ Running (infrastructure)
├── liffeyfc_form        ❌ NEEDS FIX (set Root Dir to: email-server)
└── liffeyfc_v2          ✅ Running (Root Dir: backend)
```

## Why This Happens

When you push code to GitHub:
1. Railway detects changes in the repo
2. Both `liffeyfc_form` and `liffeyfc_v2` services try to deploy
3. If Root Directory is not set, Railway uses the repo root
4. This causes the wrong code to be deployed

## Verification Steps After Fix

1. Push a small change to trigger deployment
2. Check `liffeyfc_form` build logs should show:
   ```
   using build driver railpack
   Detected Node
   Root Directory: email-server
   $ npm ci
   $ npm run start
   ```

3. Check `liffeyfc_v2` build logs should show:
   ```
   using build driver DOCKERFILE
   Root Directory: backend
   [Docker build stages]
   🔄 Starting migration process...
   ✅ Migrations completed
   🌟 Starting NestJS application
   ```

## If You Can't Access Railway Dashboard

Alternatively, you can disable auto-deployment for `liffeyfc_form` temporarily:
- In Railway → `liffeyfc_form` service → Settings → Deployments
- Disable "Auto Deploy"
- Only `liffeyfc_v2` will deploy on push

Then manually set Root Directory when you have access to the dashboard.
