import { ethers, upgrades } from "hardhat";

async function main() {
  const proxy = process.env.FACTORY_PROXY_ADDRESS;
  if (!proxy) {
    throw new Error("Please set FACTORY_PROXY_ADDRESS env var to the proxy to upgrade");
  }

  console.log("🔁 Upgrading factory proxy:", proxy);

  const FactoryV2 = await ethers.getContractFactory("EscrowFactoryV2Upgradeable");
  const upgraded = await upgrades.upgradeProxy(proxy, FactoryV2);
  await upgraded.waitForDeployment();

  console.log("✅ Upgrade complete. New implementation attached to proxy:", proxy);

  // Call new method to verify
  try {
    const ver = await upgraded.version();
    console.log("🔍 New version() =>", ver);
  } catch (err) {
    console.warn("⚠️ version() call failed after upgrade; ensure V2 exposes it properly");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Upgrade failed:", error);
    process.exit(1);
  });
