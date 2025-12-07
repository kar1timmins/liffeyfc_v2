#!/bin/bash

# 🚀 Escrow System Deployment Helper Script
# This script helps deploy the escrow factory contracts to testnets

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Escrow System Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if we're in the hardhat directory
if [ ! -f "hardhat.config.ts" ]; then
    echo "❌ Error: This script must be run from the hardhat directory"
    echo "   cd hardhat && ./deploy-escrow.sh"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "📝 Creating .env from template..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Created .env file from .env.example"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env and add your:"
        echo "   - PRIVATE_KEY (without 0x prefix)"
        echo "   - ETHEREUM_RPC_URL"
        echo "   - AVALANCHE_RPC_URL"
        echo "   - ETHERSCAN_API_KEY (optional, for verification)"
        echo "   - SNOWTRACE_API_KEY (optional, for verification)"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo "❌ .env.example not found. Cannot create .env file."
        exit 1
    fi
fi

# Source .env
source .env

# Check for required variables
MISSING_VARS=()

if [ -z "$PRIVATE_KEY" ]; then
    MISSING_VARS+=("PRIVATE_KEY")
fi

if [ "${#MISSING_VARS[@]}" -ne 0 ]; then
    echo "❌ Missing required environment variables in .env:"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "Please add these variables to your .env file and try again."
    exit 1
fi

echo "✅ Environment configuration validated"
echo ""

# Show deployment options
echo "📋 Deployment Options:"
echo "   1) Sepolia (Ethereum Testnet)"
echo "   2) Fuji (Avalanche Testnet)"
echo "   3) Both Testnets"
echo "   4) Ethereum Mainnet (⚠️  Real ETH)"
echo "   5) Avalanche Mainnet (⚠️  Real AVAX)"
echo ""
read -p "Select option (1-5): " OPTION

case $OPTION in
    1)
        NETWORKS=("sepolia")
        ;;
    2)
        NETWORKS=("fuji")
        ;;
    3)
        NETWORKS=("sepolia" "fuji")
        ;;
    4)
        echo ""
        echo "⚠️  WARNING: You are about to deploy to ETHEREUM MAINNET"
        echo "   This will use REAL ETH and cannot be undone."
        echo ""
        read -p "Type 'CONFIRM' to proceed: " CONFIRM
        if [ "$CONFIRM" != "CONFIRM" ]; then
            echo "❌ Deployment cancelled"
            exit 0
        fi
        NETWORKS=("ethereum")
        ;;
    5)
        echo ""
        echo "⚠️  WARNING: You are about to deploy to AVALANCHE MAINNET"
        echo "   This will use REAL AVAX and cannot be undone."
        echo ""
        read -p "Type 'CONFIRM' to proceed: " CONFIRM
        if [ "$CONFIRM" != "CONFIRM" ]; then
            echo "❌ Deployment cancelled"
            exit 0
        fi
        NETWORKS=("avalanche")
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Starting Deployment..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Track deployed addresses
declare -A DEPLOYED_ADDRESSES

# Deploy to each network
for NETWORK in "${NETWORKS[@]}"; do
    echo "📡 Deploying to $NETWORK..."
    echo ""
    
    # Run deployment
    DEPLOY_OUTPUT=$(npx hardhat run scripts/deploy-factory.ts --network "$NETWORK" 2>&1)
    DEPLOY_EXIT_CODE=$?
    
    if [ $DEPLOY_EXIT_CODE -ne 0 ]; then
        echo "❌ Deployment to $NETWORK failed:"
        echo "$DEPLOY_OUTPUT"
        echo ""
        continue
    fi
    
    echo "$DEPLOY_OUTPUT"
    echo ""
    
    # Extract address from output
    ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oP 'Factory deployed to: \K0x[a-fA-F0-9]{40}')
    
    if [ -n "$ADDRESS" ]; then
        DEPLOYED_ADDRESSES[$NETWORK]=$ADDRESS
        echo "✅ Successfully deployed to $NETWORK: $ADDRESS"
    else
        echo "⚠️  Could not extract address from output"
    fi
    
    echo ""
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Deployment Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ${#DEPLOYED_ADDRESSES[@]} -eq 0 ]; then
    echo "❌ No successful deployments"
    exit 1
fi

echo "✅ Successfully deployed to ${#DEPLOYED_ADDRESSES[@]} network(s):"
echo ""

for NETWORK in "${!DEPLOYED_ADDRESSES[@]}"; do
    ADDRESS="${DEPLOYED_ADDRESSES[$NETWORK]}"
    echo "   $NETWORK: $ADDRESS"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Next Steps"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Add these addresses to your backend .env file:"
echo ""

for NETWORK in "${!DEPLOYED_ADDRESSES[@]}"; do
    ADDRESS="${DEPLOYED_ADDRESSES[$NETWORK]}"
    case $NETWORK in
        sepolia|ethereum)
            echo "   ETHEREUM_FACTORY_ADDRESS=$ADDRESS"
            ;;
        fuji|avalanche)
            echo "   AVALANCHE_FACTORY_ADDRESS=$ADDRESS"
            ;;
    esac
done

echo ""
echo "2. Restart your backend service to load the new addresses"
echo ""
echo "3. Verify the configuration:"
echo "   curl http://localhost:3000/escrow/health"
echo ""
echo "4. (Optional) Verify contracts on block explorer:"
echo ""

for NETWORK in "${!DEPLOYED_ADDRESSES[@]}"; do
    ADDRESS="${DEPLOYED_ADDRESSES[$NETWORK]}"
    case $NETWORK in
        sepolia)
            echo "   npx hardhat verify --network sepolia $ADDRESS"
            echo "   https://sepolia.etherscan.io/address/$ADDRESS"
            ;;
        ethereum)
            echo "   npx hardhat verify --network ethereum $ADDRESS"
            echo "   https://etherscan.io/address/$ADDRESS"
            ;;
        fuji)
            echo "   npx hardhat verify --network fuji $ADDRESS"
            echo "   https://testnet.snowtrace.io/address/$ADDRESS"
            ;;
        avalanche)
            echo "   npx hardhat verify --network avalanche $ADDRESS"
            echo "   https://snowtrace.io/address/$ADDRESS"
            ;;
    esac
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
