# RPC Configuration & Troubleshooting Guide

## Overview

The Liffey Founders Club backend now has **automatic RPC fallback** for deploying smart contracts to Ethereum Sepolia and Avalanche Fuji testnets. This ensures contract deployments don't fail due to a single RPC provider being temporarily unavailable.

## How It Works

### Fallback Mechanism
When you attempt to deploy a contract, the service will:

1. **Try the primary RPC endpoint** configured in `ETHEREUM_RPC_URL` or `AVALANCHE_RPC_URL`
2. **If it fails**, automatically iterate through hardcoded fallback endpoints
3. **Use the first working endpoint** and remember it for future calls
4. **Log the switch** so you can see which RPC is being used

### Available Fallbacks

#### Ethereum Sepolia Fallbacks
The service will try these endpoints in order if your primary fails:
```
1. https://sepolia.drpc.org
2. https://sepolia-rpc.publicnode.com
3. https://ethereum-sepolia.publicnode.com
4. https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161
5. https://rpc.sepolia.org
```

#### Avalanche Fuji Fallbacks
The service will try these endpoints in order if your primary fails:
```
1. https://api.avax-test.network/ext/bc/C/rpc (official)
2. https://avalanche-fuji-c-chain.publicnode.com
3. https://avalanche-fuji.drpc.org
```

## Configuration

### Development Environment
For local development with docker-compose, the `.env` file already contains defaults:

```bash
# Ethereum Sepolia
ETHEREUM_RPC_URL=https://sepolia.drpc.org
ETHEREUM_FACTORY_ADDRESS=0x...

# Avalanche Fuji
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
AVALANCHE_FACTORY_ADDRESS=0x...
```

### Smart Contract Factory Addresses (REQUIRED FOR DEPLOYMENTS)

**⚠️ CRITICAL**: Before you can deploy escrow contracts, you must:

1. Deploy the `EscrowFactory.sol` contract to both networks
2. Set the resulting contract addresses in environment variables

#### Deploy Factory Contracts

```bash
cd hardhat

# Deploy to Ethereum Sepolia
npx hardhat run scripts/deploy-factory.ts --network sepolia
# Note the deployed factory address

# Deploy to Avalanche Fuji
npx hardhat run scripts/deploy-factory.ts --network fuji
# Note the deployed factory address
```

#### Configure Factory Addresses

```bash
# In your .env file
ETHEREUM_FACTORY_ADDRESS=0x<address_from_sepolia_deployment>
AVALANCHE_FACTORY_ADDRESS=0x<address_from_fuji_deployment>
```

**What happens if factory addresses aren't set:**
- Users will see error: "Smart contract deployment is not yet configured on this network"
- Frontend will show "Contracts are being deployed..." with no contract addresses
- Deployments will be silently skipped and return empty transaction hashes

### Troubleshooting Factory Configuration

**"Smart contract deployment is not yet configured on this network"**
- ✅ Deploy EscrowFactory.sol to your networks
- ✅ Set `ETHEREUM_FACTORY_ADDRESS` and/or `AVALANCHE_FACTORY_ADDRESS`
- ✅ Restart the backend

**Empty transaction hashes in response**
- Check that factory addresses are set in `.env`
- Verify factory addresses are correct (should be 42-character addresses starting with 0x)
- Check backend logs: `docker-compose logs backend | grep -i factory`


### Production Configuration

For production deployments, we **strongly recommend** using dedicated RPC endpoints:

#### **Option 1: Infura (Recommended)**
- **Cost**: Free tier (10M calls/day), paid plans available
- **Setup**: 
  1. Sign up at https://infura.io
  2. Create a new project
  3. Get your Project ID
  
```bash
# Ethereum Sepolia
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/<YOUR_PROJECT_ID>

# Ethereum Mainnet (when ready)
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<YOUR_PROJECT_ID>
```

#### **Option 2: Alchemy (Recommended)**
- **Cost**: Free tier (300M CU/month), paid plans available
- **Setup**:
  1. Sign up at https://www.alchemy.com/
  2. Create a new app
  3. Get your API key

```bash
# Ethereum Sepolia
ETHEREUM_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<YOUR_API_KEY>

# Ethereum Mainnet (when ready)
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/<YOUR_API_KEY>
```

#### **Option 3: QuickNode**
- **Cost**: Free tier available, generous limits
- **Setup**:
  1. Sign up at https://www.quicknode.com/
  2. Create a new endpoint
  3. Get your endpoint URL

```bash
# Ethereum Sepolia
ETHEREUM_RPC_URL=https://weathered-aged-frog.ethereum-sepolia.quiknode.pro/<YOUR_TOKEN>/

# Avalanche Fuji
AVALANCHE_RPC_URL=https://ava-fuji.quiknode.pro/<YOUR_TOKEN>/ext/bc/C/rpc
```

## Troubleshooting

### Issue: "Blockchain service temporarily unavailable"

**This message appears when:**
- All RPC endpoints (primary + fallbacks) are unreachable
- Network connectivity is down
- All RPC services are experiencing outages

**Solutions:**
1. **Check your internet connection**
   ```bash
   ping google.com
   ```

2. **Verify RPC endpoint status**
   - Infura Status: https://status.infura.io/
   - Alchemy Status: https://status.alchemy.com/
   - drpc Status: https://status.drpc.org/

3. **Check backend logs**
   ```bash
   # With docker-compose
   docker-compose logs backend | tail -50
   
   # Or if running locally
   npm run start:dev 2>&1 | grep -A5 "RPC\|escrow"
   ```

4. **Manually test the RPC endpoint**
   ```bash
   curl -X POST https://sepolia.drpc.org \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
   ```

5. **Switch to a different RPC provider**
   - Update `ETHEREUM_RPC_URL` in `.env`
   - Restart the backend
   - Try the deployment again

### Issue: "Invalid wallet address"

**Causes:**
- Company wallet address is not set or is malformed
- Wallet address format is incorrect

**Solutions:**
1. **Verify wallet address format**
   - Ethereum addresses start with `0x` and are 42 characters long
   - Example: `0x742d35Cc6634C0532925a3b844Bc9e7595f42e0`

2. **Check company wallet configuration**
   ```bash
   # In the database or backend logs
   # Look for company's ethAddress or avaxAddress fields
   ```

3. **Update company wallet**
   - Go to company profile
   - Add/update wallet address
   - Try deployment again

### Issue: "Insufficient funds in wallet"

**Causes:**
- Wallet doesn't have enough ETH/AVAX for gas fees
- Testnet tokens haven't been claimed yet

**Solutions:**
1. **Get testnet tokens**
   - **Ethereum Sepolia**: https://faucet.quicknode.com/ethereum/sepolia
   - **Avalanche Fuji**: https://faucet.avax.network/

2. **Check wallet balance**
   - **Sepolia Etherscan**: https://sepolia.etherscan.io/
   - **Fuji SnowTrace**: https://testnet.snowtrace.io/
   - Enter your wallet address to check balance

3. **Ensure funds are in the correct network**
   - Sepolia = Ethereum testnet
   - Fuji = Avalanche testnet
   - Each has separate tokens

### Issue: "Transaction ordering issue" (nonce error)

**Causes:**
- Multiple transactions sent in quick succession
- Previous transaction not yet confirmed
- Wallet nonce is out of sync

**Solutions:**
1. **Wait for previous transaction**
   - Check etherscan/snowtrace for pending transactions
   - Wait for confirmation

2. **Restart the backend**
   ```bash
   docker-compose restart backend
   # or
   npm run start:dev
   ```

3. **Check transaction queue**
   - Inspect blockchain explorer for stuck transactions
   - Consider using a transaction acceleration service if needed

## Monitoring & Debugging

### View Backend Logs with RPC Details

```bash
# Docker compose
docker-compose logs -f backend | grep -E "RPC|escrow|provider"

# Local development
npm run start:dev 2>&1 | grep -E "RPC|escrow|provider"
```

### Example Log Output
```
[EscrowContractService] 📡 Using Ethereum RPC: https://sepolia.drpc.org
[EscrowContractService] 📡 Using Avalanche RPC: https://api.avax-test.network/ext/bc/C/rpc
[EscrowContractService] ✅ Successfully switched to Ethereum RPC: https://sepolia-rpc.publicnode.com
[EscrowContractService] ✅ Ethereum escrow deployed: 0x1234...
```

### Test RPC Endpoint Directly

```bash
# Test Ethereum Sepolia
curl -X POST https://sepolia.drpc.org \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": ["0x742d35Cc6634C0532925a3b844Bc9e7595f42e0", "latest"],
    "id": 1
  }'

# Test Avalanche Fuji
curl -X POST https://api.avax-test.network/ext/bc/C/rpc \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": ["0x742d35Cc6634C0532925a3b844Bc9e7595f42e0", "latest"],
    "id": 1
  }'
```

## Best Practices

1. **Use a dedicated RPC service in production**
   - Free public RPC endpoints can be rate-limited or unreliable
   - Infura/Alchemy/QuickNode are recommended

2. **Monitor your RPC usage**
   - Check your API quota regularly
   - Set up alerts for approaching limits

3. **Test deployments on testnet first**
   - Always test on Sepolia/Fuji before mainnet
   - Ensure gas estimation is accurate

4. **Keep fallback RPC URLs updated**
   - Public RPC endpoints may change
   - Test endpoints regularly
   - Update hardcoded fallbacks if needed

## Related Documentation

- [Backend README](../backend/README.md) - Complete backend setup
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Production deployment steps
- [Escrow Integration Summary](./ESCROW_INTEGRATION_SUMMARY.md) - Escrow contract details
- [Smart Contracts](../hardhat/README.md) - Contract deployment instructions

## Need Help?

If you're still experiencing issues:

1. Check the logs above
2. Verify your RPC endpoint is working
3. Ensure wallet has sufficient testnet balance
4. Review the backend error message (shown in user-friendly format)
5. Check [Status Pages](#troubleshooting) for service outages
