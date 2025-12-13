import { ethers } from "hardhat";

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS || process.env.ETHEREUM_FACTORY_ADDRESS;
  
  if (!factoryAddress) {
    console.error("❌ Usage: FACTORY_ADDRESS=<address> npx hardhat run scripts/verify-factory.ts --network <network>");
    console.error("Example: FACTORY_ADDRESS=0x83f8C96c004796816f10504aaDFE64f55361442E npx hardhat run scripts/verify-factory.ts --network sepolia");
    process.exit(1);
  }

  console.log("🔍 Verifying EscrowFactory at:", factoryAddress);

  const signers = await ethers.getSigners();
  const deployer = signers[0];
  console.log("📝 Using account:", deployer.address);

  // Get network info
  const network = await deployer.provider!.getNetwork();
  console.log("🌐 Network:", network.name);
  console.log("🔗 Chain ID:", network.chainId);

  // Check if contract exists
  const code = await deployer.provider!.getCode(factoryAddress);
  if (!code || code === '0x') {
    console.error("❌ No contract found at address:", factoryAddress);
    console.error("   The factory contract may not be deployed on this network.");
    process.exit(1);
  }

  console.log("✅ Contract exists at address");
  console.log("   Code length:", code.length, "bytes");

  // Try to interact with the factory
  try {
    const Factory = await ethers.getContractFactory("EscrowFactory");
    const factory = Factory.attach(factoryAddress);

    // Get escrow count
    const count = await factory.getEscrowCount();
    console.log("\n📊 Factory Statistics:");
    console.log("   Total escrows deployed:", count.toString());

    // Get all escrows
    if (count > 0n) {
      const allEscrows = await factory.getAllEscrows();
      console.log("\n📋 Deployed Escrows:");
      for (let i = 0; i < allEscrows.length; i++) {
        console.log(`   ${i + 1}. ${allEscrows[i]}`);
      }
    }

    console.log("\n✅ Factory contract is working correctly!");

    // Test creating an escrow (estimateGas only, won't actually deploy)
    const testCompany = "0x1111111111111111111111111111111111111111";
    const testMasterWallet = "0x2222222222222222222222222222222222222222";
    const testAmount = ethers.parseEther("1.0");
    const testDuration = 7;
    const testName = "Test Campaign";
    const testDescription = "Test Description";

    console.log("\n🧪 Testing createEscrow function...");
    try {
      const gasEstimate = await factory.createEscrow.estimateGas(
        testCompany,
        testMasterWallet,
        testAmount,
        testDuration,
        testName,
        testDescription
      );
      console.log("✅ createEscrow function is callable");
      console.log("   Estimated gas:", gasEstimate.toString());
    } catch (error: any) {
      console.error("❌ createEscrow function test failed:");
      console.error("   Error:", error?.message || error);
      if (error?.reason) {
        console.error("   Reason:", error.reason);
      }
    }

  } catch (error: any) {
    console.error("❌ Error interacting with factory:", error?.message || error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  });
