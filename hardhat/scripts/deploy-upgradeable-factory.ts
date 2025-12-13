import { ethers, upgrades } from "hardhat";

async function main() {
  console.log("🚀 Deploying EscrowFactoryUpgradeable proxy...");

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("📝 Deploying with account:", deployer.address);

  const balance = await deployer.provider!.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("EscrowFactoryUpgradeable");

  // Owner for the factory can be passed via env; defaults to deployer
  const owner = process.env.FACTORY_OWNER || deployer.address;

  const instance = await upgrades.deployProxy(Factory, [owner], {
    kind: "uups",
  });

  await instance.waitForDeployment();

  const proxyAddress = await instance.getAddress();
  console.log("✅ EscrowFactoryUpgradeable proxy deployed to:", proxyAddress);

  // Sanity: call getEscrowCount
  const count = await instance.getEscrowCount();
  console.log("📊 Initial escrow count:", count.toString());

  console.log("📋 Deployment complete. Save this proxy address to your env (e.g., ESCROW_FACTORY_PROXY)");
  return { proxyAddress };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
