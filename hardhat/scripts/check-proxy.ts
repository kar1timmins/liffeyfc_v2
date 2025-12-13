import { ethers } from "hardhat";

async function main() {
  const proxy = process.env.FACTORY_PROXY_ADDRESS || process.env.ETHEREUM_FACTORY_ADDRESS;
  if (!proxy) {
    throw new Error("Please set FACTORY_PROXY_ADDRESS or ETHEREUM_FACTORY_ADDRESS to check");
  }

  console.log("Checking factory proxy at:", proxy);

  const Factory = await ethers.getContractFactory("EscrowFactoryUpgradeable");
  const factory = Factory.attach(proxy);

  // sample params (mirrors production) — small test values
  const company = ethers.Wallet.createRandom().address;
  const master = (await ethers.getSigners())[0].address;
  const target = 1_000_000_000_000_000n; // 0.001 ETH

  try {
    const data = Factory.interface.encodeFunctionData("createEscrow", [company, master, target, 7, "test", "desc"]);
    const gas = await (await ethers.getSigners())[0].provider!.estimateGas({ to: proxy, data });
    console.log("estimateGas succeeded:", gas.toString());
  } catch (err) {
    console.error("estimateGas failed:", err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
