# Bounties API Documentation

## Overview
The Bounties API provides endpoints to manage crowdfunding campaigns (bounties) tied to company wishlist items with blockchain escrow contracts.

## Base URL
```
http://localhost:3000/bounties
```

## Endpoints

### 1. Get All Bounties
**GET** `/bounties`

Retrieve all active bounties with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (`all`, `active`, `funded`, `expired`, `failed`)
- `category` (optional): Filter by category (`funding`, `talent`, `mentorship`, `partnerships`, `resources`, `technology`, `marketing`, `other`)
- `companyId` (optional): Filter by company ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Series A Funding Round",
      "description": "Looking to raise €10,000...",
      "category": "funding",
      "targetAmount": "10000",
      "raisedAmount": "7500",
      "progressPercentage": 75,
      "contributorCount": 15,
      "deadline": "2025-06-07T00:00:00.000Z",
      "status": "active",
      "company": {
        "id": "uuid",
        "name": "TechStartup Inc",
        "industry": "Software",
        "avatar": "https://example.com/logo.png"
      },
      "isEscrowActive": true,
      "ethereumEscrowAddress": "0x1234...",
      "avalancheEscrowAddress": "0x5678...",
      "createdAt": "2024-12-07T00:00:00.000Z"
    }
  ],
  "message": "Found 15 bounties"
}
```

**Example Requests:**
```bash
# Get all bounties
curl http://localhost:3000/bounties

# Get only active bounties
curl http://localhost:3000/bounties?status=active

# Get funding bounties
curl http://localhost:3000/bounties?category=funding

# Get bounties for specific company
curl http://localhost:3000/bounties?companyId=abc-123
```

---

### 2. Get Bounty by ID
**GET** `/bounties/:id`

Retrieve detailed information about a specific bounty.

**Path Parameters:**
- `id` (required): Wishlist item ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Series A Funding Round",
    "description": "Looking to raise €10,000 to expand our team...",
    "category": "funding",
    "targetAmount": "10000",
    "raisedAmount": "7500",
    "progressPercentage": 75,
    "contributorCount": 15,
    "deadline": "2025-06-07T00:00:00.000Z",
    "status": "active",
    "company": {
      "id": "uuid",
      "name": "TechStartup Inc",
      "industry": "Software",
      "avatar": "https://example.com/logo.png"
    },
    "isEscrowActive": true,
    "ethereumEscrowAddress": "0x1234...",
    "avalancheEscrowAddress": "0x5678...",
    "createdAt": "2024-12-07T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found`: Bounty doesn't exist or is not active

**Example Request:**
```bash
curl http://localhost:3000/bounties/abc-123-def-456
```

---

### 3. Create Bounty from Wishlist Item
**POST** `/bounties`

Create a new bounty from an existing wishlist item. Requires authentication.

**Authentication:** Bearer JWT token required

**Request Body:**
```json
{
  "wishlistItemId": "uuid",
  "targetAmountEur": 10000,
  "durationInDays": 180,
  "description": "Optional additional description"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Series A Funding Round",
    "description": "Looking to raise €10,000...",
    "category": "funding",
    "targetAmount": "10000",
    "raisedAmount": "0",
    "progressPercentage": 0,
    "contributorCount": 0,
    "deadline": "2025-06-07T00:00:00.000Z",
    "status": "active",
    "company": { ... },
    "isEscrowActive": true,
    "ethereumEscrowAddress": null,
    "avalancheEscrowAddress": null,
    "createdAt": "2024-12-07T00:00:00.000Z"
  },
  "message": "Bounty created successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: No valid JWT token
- `404 Not Found`: Wishlist item doesn't exist
- `409 Conflict`: Bounty already exists for this wishlist item

**Example Request:**
```bash
curl -X POST http://localhost:3000/bounties \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "wishlistItemId": "abc-123",
    "targetAmountEur": 10000,
    "durationInDays": 180
  }'
```

---

### 4. Sync Bounty with Blockchain
**POST** `/bounties/:id/sync`

Manually sync a bounty's status with its blockchain escrow contracts.

**Path Parameters:**
- `id` (required): Bounty ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Series A Funding Round",
    "raisedAmount": "7500",
    "progressPercentage": 75,
    "contributorCount": 15,
    "status": "active",
    ...
  },
  "message": "Bounty synced with blockchain"
}
```

**Example Request:**
```bash
curl -X POST http://localhost:3000/bounties/abc-123/sync
```

---

### 5. Get Company Bounties
**GET** `/bounties/company/:companyId`

Retrieve all bounties for a specific company.

**Path Parameters:**
- `companyId` (required): Company ID (UUID)

**Response:**
```json
{
  "success": true,
  "data": [ ... ],
  "message": "Found 3 bounties for company"
}
```

**Example Request:**
```bash
curl http://localhost:3000/bounties/company/abc-123
```

---

## Status Values

| Status | Description |
|--------|-------------|
| `active` | Campaign is ongoing and accepting contributions |
| `funded` | Target amount reached, funds can be released |
| `expired` | Deadline passed without reaching target |
| `failed` | Campaign failed (blockchain status) |

## Category Values

| Category | Description |
|----------|-------------|
| `funding` | Raising capital/investment |
| `talent` | Hiring employees or contractors |
| `mentorship` | Seeking advisors or mentors |
| `partnerships` | Looking for business partnerships |
| `resources` | Equipment, office space, etc. |
| `technology` | Software, hardware, or tech services |
| `marketing` | Marketing and promotion services |
| `other` | Other needs |

---

## Integration Notes

### Frontend Integration
The frontend bounties pages expect these exact endpoint paths and response formats:
- `/bounties` - Main listing page calls this with query params
- `/bounties/:id` - Detail page calls this for individual bounty data

### Blockchain Data
Bounties automatically fetch real-time data from blockchain escrow contracts:
- `raisedAmount`: Total ETH/AVAX contributed (in wei, converted to string)
- `contributorCount`: Number of unique contributors
- `progressPercentage`: Calculated as (raisedAmount / targetAmount) * 100
- `status`: Derived from blockchain state and deadline

### Auto-refresh
Frontend pages poll the API every 30 seconds for real-time updates during active contributions.

---

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "statusCode": 404,
  "message": "Bounty not found",
  "error": "Not Found"
}
```

Common HTTP Status Codes:
- `200 OK`: Success
- `400 Bad Request`: Invalid input
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Resource doesn't exist
- `409 Conflict`: Resource already exists
- `500 Internal Server Error`: Server error

---

## Example Workflow

1. **Company creates wishlist item** (via `/companies/:id/wishlist`)
2. **Company creates bounty** from wishlist item:
   ```bash
   POST /bounties
   {
     "wishlistItemId": "wishlist-123",
     "targetAmountEur": 10000,
     "durationInDays": 180
   }
   ```
3. **Deploy escrow contracts** (via `/escrow/create`)
4. **Bounty appears** on public `/bounties` page
5. **Investors contribute** via MetaMask (frontend sends transactions directly to contract)
6. **Frontend polls** `/bounties/:id` for real-time updates
7. **Campaign completes** when target reached or deadline expires

---

## Testing

### Local Development
```bash
# Start backend
cd backend && pnpm start:dev

# Test endpoints
curl http://localhost:3000/bounties
curl http://localhost:3000/bounties/abc-123
```

### With Docker Compose
```bash
# Start all services
docker-compose up

# Backend runs on port 3000
curl http://localhost:3000/bounties
```

---

## Related Documentation
- [Smart Contract Escrow System](../hardhat/README.md)
- [EscrowContractService](./ESCROW_SERVICE.md)
- [Frontend Bounties Pages](../../frontend/src/routes/bounties/README.md)
