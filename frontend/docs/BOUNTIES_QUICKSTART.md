# Bounties System Quick Start Guide

## Prerequisites
- Node.js 18+ and pnpm installed
- PostgreSQL running (docker-compose or local)
- Redis running (docker-compose or local)
- MetaMask browser extension

## Option 1: Docker Compose (Recommended)

### 1. Start All Services
```bash
# From project root
docker-compose up
```

This starts:
- PostgreSQL on port 5433
- Redis on port 6379
- Backend on port 3000
- Frontend on port 5173

### 2. Access the Application
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Bounties page: http://localhost:5173/bounties

### 3. Test the API
```bash
# Get all bounties
curl http://localhost:3000/bounties

# Get specific bounty (replace with real ID)
curl http://localhost:3000/bounties/YOUR_BOUNTY_ID
```

## Option 2: Manual Setup

### 1. Start Database Services
```bash
# Start PostgreSQL and Redis separately, or use docker-compose for just DB:
docker-compose up postgres redis
```

### 2. Start Backend
```bash
cd backend

# Install dependencies (if not done)
pnpm install

# Start in development mode
pnpm start:dev
```

Backend will be available at http://localhost:3000

### 3. Start Frontend
```bash
cd frontend

# Install dependencies (if not done)
pnpm install

# Start development server
pnpm dev
```

Frontend will be available at http://localhost:5173

## Testing the Bounties System

### Step 1: Create a Test Company and Wishlist Item
Since bounties are created from wishlist items, you'll need:

1. **Register a user** (if not already done):
   ```bash
   curl -X POST http://localhost:3000/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!",
       "firstName": "Test",
       "lastName": "User",
       "userType": "company"
     }'
   ```

2. **Login to get JWT token**:
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "Test123!"
     }'
   ```
   
   Save the `access_token` from the response.

3. **Create a company**:
   ```bash
   curl -X POST http://localhost:3000/companies \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "TechStartup Inc",
       "description": "Building the future of AI",
       "industry": "Software",
       "stage": "early_stage",
       "fundingStage": "seed",
       "employeeCount": 5
     }'
   ```
   
   Save the `id` from the response (this is your `companyId`).

4. **Add a wishlist item**:
   ```bash
   curl -X POST http://localhost:3000/companies/YOUR_COMPANY_ID/wishlist \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Series A Funding Round",
       "description": "Looking to raise €10,000 to expand our engineering team",
       "category": "funding",
       "priority": "high",
       "value": 10000
     }'
   ```
   
   Save the wishlist item `id` (this is your `wishlistItemId`).

### Step 2: Create a Bounty
```bash
curl -X POST http://localhost:3000/bounties \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wishlistItemId": "YOUR_WISHLIST_ITEM_ID",
    "targetAmountEur": 10000,
    "durationInDays": 180
  }'
```

This marks the wishlist item as an active bounty!

### Step 3: Deploy Escrow Contracts
To enable blockchain contributions, deploy escrow contracts:

```bash
curl -X POST http://localhost:3000/escrow/create \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wishlistItemId": "YOUR_WISHLIST_ITEM_ID",
    "targetAmountEur": 10000,
    "durationInDays": 180
  }'
```

This deploys contracts to both Ethereum Sepolia and Avalanche Fuji testnets.

### Step 4: View Bounties

#### Via Frontend
1. Open http://localhost:5173/bounties
2. You should see your bounty in the grid
3. Click "View Details" to see the full page

#### Via API
```bash
# List all bounties
curl http://localhost:3000/bounties

# Get your specific bounty
curl http://localhost:3000/bounties/YOUR_WISHLIST_ITEM_ID

# Filter by status
curl http://localhost:3000/bounties?status=active

# Filter by category
curl http://localhost:3000/bounties?category=funding
```

### Step 5: Test Web3 Contribution (Frontend Only)

1. **Open bounty detail page**: http://localhost:5173/bounties/YOUR_WISHLIST_ITEM_ID
2. **Connect MetaMask**:
   - Make sure you have MetaMask installed
   - Switch to Sepolia testnet (or Fuji for Avalanche)
   - Get testnet ETH from faucet if needed
3. **Select network**: Choose Ethereum or Avalanche
4. **Enter amount**: e.g., 0.1 ETH
5. **Click "Contribute Now"**
6. **Approve MetaMask transaction**
7. **Wait for confirmation**
8. **See progress update automatically**

## Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is already in use
lsof -i :3000

# Check PostgreSQL connection
psql -h localhost -p 5433 -U lfc_user -d lfc_db
```

### Frontend won't start
```bash
# Check if port 5173 is already in use
lsof -i :5173

# Rebuild frontend
cd frontend && pnpm build
```

### Database connection errors
Make sure PostgreSQL is running and `.env` file has correct settings:
```bash
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
POSTGRES_USER=lfc_user
POSTGRES_PASSWORD=lfc_pass
POSTGRES_DB=lfc_db
DATABASE_URL=postgres://lfc_user:lfc_pass@localhost:5433/lfc_db
```

### "No bounties found"
This is expected if:
- No wishlist items have `isEscrowActive = true`
- You haven't created any bounties yet
- Database is empty

Solution: Follow Step 1-3 above to create test data.

### MetaMask errors
- **"Wrong network"**: Click the network toggle to switch
- **"Insufficient funds"**: Get testnet ETH/AVAX from faucets:
  - Sepolia: https://sepoliafaucet.com/
  - Fuji: https://core.app/tools/testnet-faucet/
- **"Transaction failed"**: Check contract address is correct and has code deployed

### TypeScript errors
```bash
# Backend
cd backend && pnpm run build

# Frontend
cd frontend && pnpm run check
```

## API Testing with Examples

### Get all active funding bounties
```bash
curl "http://localhost:3000/bounties?status=active&category=funding"
```

### Get bounties for specific company
```bash
curl "http://localhost:3000/bounties?companyId=YOUR_COMPANY_ID"
```

### Sync bounty with blockchain
```bash
curl -X POST http://localhost:3000/bounties/YOUR_BOUNTY_ID/sync
```

### Get company's bounties
```bash
curl http://localhost:3000/bounties/company/YOUR_COMPANY_ID
```

## Next Steps After Testing

1. **Add Navigation Link**: Update main nav to include "Bounties"
2. **Add "Create Bounty" UI**: Button on company wishlist page
3. **Test on Testnet**: Deploy real contracts and test contributions
4. **Monitor Progress**: Check if auto-refresh works (30s polling)
5. **Test Status Changes**: Wait for deadline to see "expired" status
6. **Test Success Case**: Contribute full amount to see "funded" status

## Environment Variables Reference

### Backend (.env)
```bash
# Database
DATABASE_URL=postgres://lfc_user:lfc_pass@localhost:5433/lfc_db
TYPEORM_SYNCHRONIZE=true

# Redis (for nonces)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Blockchain RPC URLs
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc

# Private key for contract deployment
DEPLOYER_PRIVATE_KEY=your-private-key
```

### Frontend (.env or .env.local)
```bash
PUBLIC_API_URL=http://localhost:3000
PUBLIC_RECAPTCHA_SITE_KEY=your-recaptcha-key
```

## Useful Commands

### Backend
```bash
cd backend

# Development
pnpm start:dev

# Production build
pnpm build
pnpm start:prod

# Run tests
pnpm test

# Type check
pnpm run build
```

### Frontend
```bash
cd frontend

# Development
pnpm dev

# Production build
pnpm build

# Preview build
pnpm preview

# Type check
pnpm run check
```

### Docker Compose
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart
docker-compose up --build
```

## Support

For issues or questions:
1. Check `BOUNTIES_IMPLEMENTATION.md` for detailed documentation
2. Check `backend/docs/BOUNTIES_API.md` for API reference
3. Review TypeScript errors with `pnpm run build`
4. Check Docker logs: `docker-compose logs backend`
5. Check browser console for frontend errors

---

**Happy testing! 🎉**
