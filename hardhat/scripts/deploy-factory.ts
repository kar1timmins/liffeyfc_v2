const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying EscrowFactory contract...");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("📝 Deploying with account:", deployer.address);

  // Get account balance
  const balance = await deployer.provider!.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy EscrowFactory
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ EscrowFactory deployed to:", factoryAddress);

  // Verify deployment
  const escrowCount = await factory.getEscrowCount();
  console.log("📊 Initial escrow count:", escrowCount.toString());

  console.log("\n📋 Deployment Summary:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const network = await deployer.provider!.getNetwork();
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Factory Address:", factoryAddress);
  console.log("Deployer:", deployer.address);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  console.log("\n💡 Next Steps:");
  console.log("1. Save the factory address to your backend configuration");
  console.log("2. Update ESCROW_FACTORY_ADDRESS environment variable");
  console.log("3. For Avalanche deployment, run: npx hardhat run scripts/deploy-factory.ts --network avalanche");

  return {
    factoryAddress,
    deployerAddress: deployer.address,
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
