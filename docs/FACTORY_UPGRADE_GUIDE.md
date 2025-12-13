# Escrow Factory Upgrade Guide

This guide shows how to deploy an upgradeable UUPS `EscrowFactory` proxy and how to perform an upgrade.

Deploy proxy (Sepolia example):

```bash
# From /hardhat
FACTORY_OWNER=<owner_address> pnpm exec hardhat run scripts/deploy-upgradeable-factory.ts --network sepolia
```

This prints the proxy address. Save it to your environment (for Sepolia, set `ETHEREUM_FACTORY_ADDRESS`; for Fuji, set `AVALANCHE_FACTORY_ADDRESS`) and to the backend config (replace the old factory address with the proxy). If deploying to Railway, update the corresponding environment variables and restart the service.

Upgrade the proxy to V2:

```bash
# Set FACTORY_PROXY_ADDRESS to the proxy address
FACTORY_PROXY_ADDRESS=<proxy> pnpm exec hardhat run scripts/upgrade-factory.ts --network sepolia
```

Testing locally:

```bash
pnpm --filter hardhat test
```

Deployed proxies (testnets):

- Sepolia: 0xb23aD57Df4193d65B0ED076D996EeE5C3e48A83B
- Fuji: 0x7Ae4f49F9de786C3A40864C52583e6D635080654

Notes:
- The proxy is a UUPS proxy and the owner (set at `initialize`) is the only address authorized to upgrade.
- For production, set the factory owner to a multisig/timelock address and do not place private keys in Railway.
