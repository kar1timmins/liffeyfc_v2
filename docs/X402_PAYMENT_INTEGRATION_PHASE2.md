# X402 USDC Payment Integration - Phase 2: Deployment Queue

**Status**: ✅ Complete  
**Date**: December 2025  
**Branch**: feature/x402-usdc-payment-integration

## Overview

Phase 2 implements an asynchronous job queue using BullMQ to handle contract deployments after USDC payment validation. This decouples payment validation from deployment execution, allowing instant API responses while deployments happen in the background.

## Architecture

```
User pays USDC
     ↓
PaymentsController validates payment
     ↓
Payment record created (status: CONFIRMED)
     ↓
Deployment job queued to BullMQ
     ↓
API responds immediately with jobId
     ↓
[Background] DeploymentWorker processes job
     ↓
Contracts deployed using platform wallet
     ↓
Payment record updated (status: DEPLOYED)
```

## Components

### 1. DeploymentQueueService (`backend/src/jobs/deployment-queue.service.ts`)

**Purpose**: Manages the BullMQ queue for contract deployments

**Key Methods**:
- `queueDeployment(data: DeploymentJobData)` - Add deployment to queue
- `getJobStatus(jobId: string)` - Check job status and progress
- `getQueueStats()` - Get queue statistics (waiting, active, completed, failed)
- `retryJob(jobId: string)` - Retry a failed job
- `removeJob(jobId: string)` - Remove a job from queue

**Configuration**:
- Queue name: `escrow-deployment`
- Max retry attempts: 3
- Backoff strategy: Exponential with 5s initial delay
- Job retention: Last 100 completed, last 200 failed

**Events**:
- `error` - Queue connection errors
- `waiting` - Job added to queue
- Logs all queue activities

### 2. DeploymentWorkerService (`backend/src/jobs/deployment-worker.service.ts`)

**Purpose**: Background worker that processes deployment jobs

**Key Methods**:
- `processDeployment(job: Job<DeploymentJobData>)` - Execute contract deployment
- Updates payment status throughout deployment lifecycle
- Uses `EscrowContractService.deployEscrowContracts()` with platform wallet

**Configuration**:
- Concurrency: 2 jobs at once
- Rate limiting: Max 5 jobs per minute (prevents RPC throttling)
- Auto-restart on failure

**Progress Tracking**:
- 10% - Payment status updated to "deploying"
- 30% - Starting contract deployment
- 90% - Deployment complete, updating database
- 100% - Job complete

**Error Handling**:
- Catches deployment errors
- Updates payment status to FAILED
- Stores error message in payment record
- Re-throws error to trigger BullMQ retry (up to 3 attempts)

### 3. JobsModule (`backend/src/jobs/jobs.module.ts`)

**Purpose**: NestJS module that registers queue and worker services

**Imports**:
- `ConfigModule` - Access to REDIS_URL
- `TypeOrmModule` - Access to Payment entity
- `Web3Module` - Access to EscrowContractService

**Exports**:
- `DeploymentQueueService` - Used by PaymentsModule

### 4. Updated PaymentsController

**Changes to `POST /payments/create`**:
1. Validates USDC payment (unchanged)
2. Creates payment record (unchanged)
3. **NEW**: Fetches wishlist item with company relation
4. **NEW**: Queues deployment job with BullMQ
5. Returns payment ID + job ID to client

**Response Format**:
```json
{
  "success": true,
  "message": "Payment validated successfully. Deployment queued.",
  "data": {
    "paymentId": "uuid-here",
    "jobId": "deployment-uuid-here",
    "status": "confirmed",
    "usdcAmount": 2.5,
    "chain": "ethereum",
    "confirmedAt": "2025-12-13T10:30:00Z"
  }
}
```

### 5. Updated PaymentsService

**New Method**:
- `getWishlistItemById(wishlistItemId: string)` - Fetch wishlist with company relation
- Used to extract company wallet address for deployment

## Redis Connection

Both queue and worker connect to the same Redis instance:

```typescript
const redisConfig = {
  host: 'redis.railway.app',  // From REDIS_URL parsing
  port: 6379,
  password: 'your-password',
  maxRetriesPerRequest: null,  // Required for BullMQ
  enableReadyCheck: false,     // Better for cloud Redis
};
```

**Environment Variable**:
```bash
REDIS_URL=redis://default:password@redis.railway.app:6379
```

## Job Data Schema

```typescript
interface DeploymentJobData {
  paymentId: string;              // Links job to payment record
  userId: string;                 // User who made payment
  wishlistItemId: string;         // Wishlist item being funded
  companyWalletAddress: string;   // Company child wallet (escrow beneficiary)
  masterWalletAddress: string;    // User master wallet (for lookup)
  targetAmountEth: number;        // Campaign goal in ETH
  durationInDays: number;         // Campaign duration
  chains: ('ethereum' | 'avalanche')[];  // Which chains to deploy to
  campaignName?: string;          // Optional campaign title
  campaignDescription?: string;   // Optional campaign description
}
```

## Payment Status Flow

1. **PENDING** - Payment submitted but not validated (not used in Phase 1-2)
2. **CONFIRMED** - USDC payment validated on-chain
3. **[Queued]** - Deployment job in BullMQ queue (not stored in DB)
4. **DEPLOYED** - Contracts deployed successfully
5. **FAILED** - Deployment failed after retries

## Testing the Queue

### 1. Check Queue Stats
```bash
# Add endpoint to PaymentsController:
GET /payments/queue/stats

# Response:
{
  "waiting": 2,
  "active": 1,
  "completed": 45,
  "failed": 3,
  "delayed": 0
}
```

### 2. Check Job Status
```bash
# Add endpoint to PaymentsController:
GET /payments/jobs/:jobId

# Response:
{
  "status": "active",
  "progress": 30,
  "data": null
}
```

### 3. Monitor Logs
```bash
cd backend && pnpm start:dev

# Look for:
# ✅ Deployment queue initialized
# ✅ Deployment worker started
# 📝 Queuing deployment for payment: uuid
# ✅ Job queued successfully: deployment-uuid
# 🚀 Processing deployment job: deployment-uuid
# ✅ Deployment completed successfully
```

## Error Scenarios

### Scenario 1: RPC Endpoint Down
- Worker fails after 3 attempts
- Job marked as failed in BullMQ
- Payment status updated to FAILED
- Error message stored: "RPC connection failed"

### Scenario 2: Insufficient Gas
- Worker catches error during deployment
- Job marked as failed
- Payment status updated to FAILED
- Error message stored: "Insufficient gas balance"

### Scenario 3: Redis Connection Lost
- Queue/Worker throw connection errors
- Logged as errors but don't crash app
- Reconnect automatically when Redis is back

## Dependencies

**New Package**:
```json
{
  "bullmq": "^5.66.0"
}
```

**BullMQ Dependencies** (auto-installed):
- `ioredis` - Redis client
- `msgpackr` - Fast serialization
- Other BullMQ internal deps

## Next Steps (Phase 3)

1. **Database Migration**:
   - Start docker-compose (postgres + redis)
   - Generate migration for Payment entity
   - Run migration to create payments table

2. **Platform Wallet Service**:
   - Create `PlatformWalletService` to manage platform wallets
   - Add methods to deploy contracts using platform private keys
   - Update `EscrowContractService` to use platform wallet instead of user wallet

3. **Frontend Integration**:
   - Add USDC payment UI to wishlist creation flow
   - Display payment instructions (USDC amount, platform address)
   - Poll job status endpoint to show deployment progress
   - Show success message with contract addresses

4. **Cost Estimation**:
   - Calculate gas costs for deployments
   - Convert gas cost to USDC equivalent
   - Display USDC amount required before payment

5. **Refund Mechanism**:
   - Add refund endpoint
   - Verify deployment failed
   - Return USDC to user (minus processing fee)

## Files Changed

### Created Files
- `backend/src/jobs/deployment-queue.service.ts` (166 lines)
- `backend/src/jobs/deployment-worker.service.ts` (151 lines)
- `backend/src/jobs/jobs.module.ts` (18 lines)

### Modified Files
- `backend/src/app.module.ts` (added JobsModule import)
- `backend/src/payments/payments.module.ts` (added JobsModule import)
- `backend/src/payments/payments.controller.ts` (added queue integration)
- `backend/src/payments/payments.service.ts` (added getWishlistItemById method)
- `backend/.env.example` (updated Redis config comments)
- `backend/package.json` (added bullmq dependency)

## Commit Message

```
feat: Phase 2 - Deployment Queue with BullMQ

- Add DeploymentQueueService for managing deployment jobs
- Add DeploymentWorkerService for processing deployments
- Integrate BullMQ with existing Railway Redis
- Update PaymentsController to queue deployments after payment validation
- Add getWishlistItemById method to PaymentsService
- Configure queue with retry strategy and rate limiting
- Add comprehensive logging and error handling
- Update .env.example with Redis usage documentation

Phase 2 decouples payment validation from deployment execution,
allowing instant API responses while deployments happen in background.

Related: X402 USDC payment integration
```

## Build Status

✅ TypeScript compilation successful  
✅ No linting errors  
✅ All imports resolved

---

**Documentation**: See `X402_QUICK_REFERENCE.md` for full implementation overview  
**Previous Phase**: `X402_PAYMENT_INTEGRATION_PHASE1.md`  
**Next Phase**: Database migration and platform wallet service
