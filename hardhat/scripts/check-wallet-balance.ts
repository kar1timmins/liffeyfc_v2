import { ethers } from "hardhat";

async function main() {
  const address = "0xb0cd333843a1b9efd6aafc879b79bf5d9c4d83a8";
  const provider = ethers.provider;
  
  console.log("🔍 Checking wallet balance on Sepolia testnet");
  console.log("📍 Address:", address);
  
  const balance = await provider.getBalance(address);
  console.log("\n💰 Balance:", ethers.formatEther(balance), "ETH");
  console.log("   Balance (wei):", balance.toString());
  
  const minRequired = ethers.parseEther("0.001");
  console.log("\n✅ Minimum required for deployment: 0.001 ETH");
  
  if (balance < minRequired) {
    console.log("❌ INSUFFICIENT BALANCE!");
    console.log("   You need at least 0.001 ETH to deploy contracts");
    console.log("   Get testnet ETH from:");
    console.log("   - https://sepoliafaucet.com/");
    console.log("   - https://www.alchemy.com/faucets/ethereum-sepolia");
  } else {
    console.log("✅ Wallet has sufficient balance for deployment");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
