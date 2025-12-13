import { ethers } from "hardhat";

async function main() {
  const proxy = process.env.FACTORY_PROXY_ADDRESS;
  if (!proxy) throw new Error("set FACTORY_PROXY_ADDRESS to check version");
  const factory = await ethers.getContractAt("EscrowFactoryV2Upgradeable", proxy);
  try {
    const v = await factory.version();
    console.log("version():", v);
  } catch (err) {
    console.error("version() call failed:", err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
