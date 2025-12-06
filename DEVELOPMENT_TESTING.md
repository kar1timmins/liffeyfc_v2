# Local Development Testing Guide

Quick steps to verify your development environment is working correctly.

## Step 1: Start the Backend

```bash
cd backend

# Make sure you have .env file
ls -la .env

# Start development server
pnpm start:dev
```

You should see:
```
🔐 Validating security configuration...
🚀 Backend server is running on port 3000
🌍 CORS enabled in DEVELOPMENT mode
📡 Allowed origins: http://localhost:5173, http://localhost:3000, ...
```

**Test backend is running:**
```bash
curl http://localhost:3000/health  # Should return OK or similar
```

## Step 2: Start the Frontend

In a new terminal:

```bash
cd frontend

# Make sure you have .env.local file
ls -la .env.local

# Start dev server
pnpm dev
```

You should see:
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

## Step 3: Test Login Flow

1. Open http://localhost:5173 in browser
2. Click "Sign in" or go to /auth
3. Try logging in with test credentials
4. Open browser DevTools (F12) → Console
5. You should NOT see `ERR_ACCESS_DENIED` errors

**Expected flow:**
- Network tab shows `POST /auth/login` request
- Request goes to `http://localhost:3000/auth/login` (via Vite proxy)
- No CORS errors in console
- Response shows success or auth error (not CORS error)

## Step 4: Verify API Requests Work

Test a few endpoints:

```bash
# Test login endpoint
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Test companies endpoint  
curl http://localhost:3000/companies

# Test users endpoint (requires auth token)
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/users/me
```

## Step 5: Check Environment Variables

**Frontend (.env.local):**
```bash
echo "Backend API URL: $(grep PUBLIC_API_URL frontend/.env.local)"
```
Should show: `Backend API URL: PUBLIC_API_URL=http://localhost:3000`

**Backend (.env):**
```bash
echo "Port: $(grep '^PORT=' backend/.env)"
echo "Node Env: $(grep '^NODE_ENV=' backend/.env)"
echo "JWT Configured: $(grep '^JWT_SECRET=' backend/.env | wc -l)"
```

## Troubleshooting

### Issue: "ERR_ACCESS_DENIED" on login

**Check 1: Backend running?**
```bash
curl -i http://localhost:3000/health
# Should return 200 OK
```

**Check 2: CORS enabled?**
```bash
curl -i -X OPTIONS http://localhost:3000/auth/login \
  -H "Origin: http://localhost:5173"
# Should see Access-Control headers in response
```

**Check 3: Frontend proxy working?**
```bash
# From browser console, test via proxy
fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test@example.com', password: 'test' })
}).then(r => r.json()).then(console.log)
```

### Issue: Database connection error

```bash
# Check DATABASE_URL in .env
grep DATABASE_URL backend/.env

# Test connection
psql postgres://user:pass@localhost:5432/lfc_db -c "SELECT 1"
```

### Issue: Redis connection error

```bash
# Check REDIS_URL in .env
grep REDIS_URL backend/.env

# Test Redis connection
redis-cli -u redis://localhost:6379 ping
# Should return: PONG
```

### Issue: Port already in use

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

## Next Steps

Once everything works:
1. Run backend tests: `cd backend && pnpm test`
2. Test specific features in browser
3. Check console for any warnings
4. Review network tab for slow requests
5. Check application tab for storage/cookies

## Production Deployment Check

Before deploying to production:

1. **Environment Variables Set:**
   - [ ] Railway has all required backend env vars
   - [ ] Frontend build has `PUBLIC_API_URL` set correctly
   - [ ] Production database URL configured
   - [ ] JWT secrets are strong (64+ char hex)

2. **Database Ready:**
   - [ ] Production database created
   - [ ] All migrations run: `pnpm run migration:run`
   - [ ] Redis instance available
   - [ ] GCP bucket configured (if using)

3. **Security Checks:**
   - [ ] CORS restricted to production domain
   - [ ] TYPEORM_SYNCHRONIZE set to `false`
   - [ ] NODE_ENV set to `production`
   - [ ] Debug logs disabled (`ENABLE_API_LOGS=0`)

4. **Email Service:**
   - [ ] Resend API key set
   - [ ] Domain verified on Resend
   - [ ] EMAIL_FROM uses verified domain

5. **Frontend Build:**
   - [ ] Build succeeds: `pnpm build`
   - [ ] No TypeScript errors
   - [ ] All env vars substituted correctly

## Common Commands

```bash
# Terminal 1: Backend
cd backend && pnpm start:dev

# Terminal 2: Frontend  
cd frontend && pnpm dev

# View logs in real-time
docker-compose logs -f backend
docker-compose logs -f frontend

# Run migrations
cd backend && pnpm run migration:generate -- src/migrations/name
cd backend && pnpm run migration:run

# Test backend
cd backend && pnpm test
cd backend && pnpm test:watch

# Build for production
cd frontend && pnpm build
cd backend && pnpm build
```

---

For detailed setup, see `ENV_SETUP.md`
