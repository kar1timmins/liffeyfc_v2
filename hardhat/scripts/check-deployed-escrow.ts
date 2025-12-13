import { ethers } from "hardhat";

async function main() {
  // Check one of the deployed escrows
  const escrowAddress = "0x86049ed59f55D338d2dB0d141c627fF1bb5d0C80";
  const [signer] = await ethers.getSigners();
  const provider = signer.provider;
  
  console.log("🔍 Checking deployed escrow contract");
  console.log("📍 Address:", escrowAddress);
  
  const code = await provider.getCode(escrowAddress);
  console.log("\n📝 Contract code length:", code.length, "bytes");
  
  // Try to interact with it using the ABI
  const escrowABI = [
    "function company() external view returns (address)",
    "function masterWallet() external view returns (address)",
    "function targetAmount() external view returns (uint256)",
    "function totalRaised() external view returns (uint256)",
  ];
  
  const escrow = new ethers.Contract(escrowAddress, escrowABI, provider);
  
  try {
    console.log("\n📋 Reading contract state:");
    const company = await escrow.company();
    console.log("   ✅ Company:", company);
    
    try {
      const target = await escrow.targetAmount();
      console.log("   ✅ Target Amount:", ethers.formatEther(target), "ETH");
    } catch (e: any) {
      console.log("   ❌ Target Amount: Failed -", e.message.substring(0, 80));
    }
    
    try {
      const raised = await escrow.totalRaised();
      console.log("   ✅ Total Raised:", ethers.formatEther(raised), "ETH");
    } catch (e: any) {
      console.log("   ❌ Total Raised: Failed -", e.message.substring(0, 80));
    }
    
    console.log("\n✅ Contract exists and can be queried!");
  } catch (error: any) {
    console.error("❌ Error reading contract:");
    console.error("   Message:", error.message);
    console.error("   Code:", error.code);
    
    // Try to see if it's a contract at all
    if (code === "0x") {
      console.error("\n⚠️  No contract code at this address!");
    } else {
      console.error("\n⚠️  Contract exists but calls are failing");
      console.error("   This might indicate:");
      console.error("   - ABI mismatch");
      console.error("   - Contract self-destructed");
      console.error("   - Proxy contract issue");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
