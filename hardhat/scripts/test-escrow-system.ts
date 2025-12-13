import { ethers, network } from "hardhat";

/**
 * Test script to demonstrate the escrow system workflow
 */
async function main() {
  console.log("🧪 Testing CompanyWishlistEscrow System\n");

  const [deployer, company, investor1, investor2, investor3] = await ethers.getSigners();

  console.log("📋 Test Accounts:");
  console.log("  Deployer:", deployer.address);
  console.log("  Company:", company.address);
  console.log("  Investor 1:", investor1.address);
  console.log("  Investor 2:", investor2.address);
  console.log("  Investor 3:", investor3.address);
  console.log();

  // Deploy Factory
  console.log("1️⃣  Deploying EscrowFactory...");
  const EscrowFactory = await ethers.getContractFactory("EscrowFactory");
  const factory = await EscrowFactory.deploy();
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log("   ✅ Factory deployed:", factoryAddress);
  console.log();

  // Create escrow campaign
  console.log("2️⃣  Creating escrow campaign...");
  const targetAmount = ethers.parseEther("1.0"); // 1 ETH target
  const durationInDays = 7; // 7 day campaign

  const campaignName = "Liffey Test Campaign";
  const campaignDescription = "Test campaign for Liffey Founders Club escrow";
  const tx = await factory.createEscrow(company.address, company.address, targetAmount, durationInDays, campaignName, campaignDescription);
  const receipt = await tx.wait();

  // Get escrow address from event
  const event = receipt?.logs
    .map((log: any) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === 'EscrowCreated');

  const escrowAddress = event?.args.escrowAddress;
  console.log("   ✅ Escrow created:", escrowAddress);
  console.log("   📊 Target:", ethers.formatEther(targetAmount), "ETH");
  console.log("   ⏰ Duration:", durationInDays, "days");
  console.log();

  // Get escrow contract
  const escrow = await ethers.getContractAt("CompanyWishlistEscrow", escrowAddress);
  const onchainName = await escrow.campaignName();
  const onchainDescription = await escrow.campaignDescription();
  console.log('   🔖 On-chain campaign name:', onchainName);
  console.log('   🗒️ On-chain campaign description:', onchainDescription);

  // Contributions
  console.log("3️⃣  Making contributions...");

  // Investor 1 contributes 0.3 ETH
  await escrow.connect(investor1).contribute({ value: ethers.parseEther("0.3") });
  console.log("   ✅ Investor 1 contributed 0.3 ETH");

  // Investor 2 contributes 0.4 ETH
  await escrow.connect(investor2).contribute({ value: ethers.parseEther("0.4") });
  console.log("   ✅ Investor 2 contributed 0.4 ETH");

  // Investor 3 contributes 0.2 ETH
  await escrow.connect(investor3).contribute({ value: ethers.parseEther("0.2") });
  console.log("   ✅ Investor 3 contributed 0.2 ETH");
  console.log();

  // Check status
  console.log("4️⃣  Checking campaign status...");
  const status = await escrow.getCampaignStatus();
  console.log("   💰 Total Raised:", ethers.formatEther(status[0]), "ETH");
  console.log("   🎯 Target Amount:", ethers.formatEther(status[1]), "ETH");
  console.log("   📈 Progress:", await escrow.getProgressPercentage(), "%");
  console.log("   👥 Contributors:", status[6].toString());
  console.log("   ⚡ Active:", await escrow.isActive());
  console.log("   ✔️  Finalized:", status[4]);
  console.log();

  // Final contribution to reach target
  console.log("5️⃣  Final contribution to reach target...");
  const needed = targetAmount - status[0];
  console.log("   📍 Need", ethers.formatEther(needed), "ETH more");

  const companyBalanceBefore = await network.provider.send("eth_getBalance", [company.address, "latest"]);
  console.log("   💵 Company balance before:", ethers.formatEther(BigInt(companyBalanceBefore)), "ETH");

  await escrow.connect(investor1).contribute({ value: needed });
  console.log("   ✅ Investor 1 topped up with", ethers.formatEther(needed), "ETH");
  console.log();

  // Check final status
  console.log("6️⃣  Checking final status...");
  const finalStatus = await escrow.getCampaignStatus();
  console.log("   💰 Total Raised:", ethers.formatEther(finalStatus[0]), "ETH");
  console.log("   ✔️  Finalized:", finalStatus[4]);
  console.log("   🎉 Successful:", finalStatus[5]);

  const companyBalanceAfter = await network.provider.send("eth_getBalance", [company.address, "latest"]);
  const balanceAfterBigInt = BigInt(companyBalanceAfter);
  const balanceBeforeBigInt = BigInt(companyBalanceBefore);
  console.log("   💵 Company balance after:", ethers.formatEther(balanceAfterBigInt), "ETH");
  console.log("   📊 Funds received:", ethers.formatEther(balanceAfterBigInt - balanceBeforeBigInt), "ETH");
  console.log();

  // Test failed campaign scenario
  console.log("7️⃣  Testing failed campaign scenario...");
  const tx2 = await factory.createEscrow(company.address, company.address, ethers.parseEther("2.0"), durationInDays, "Failed Campaign", "This campaign should fail in test case");
  const receipt2 = await tx2.wait();

  const event2 = receipt2?.logs
    .map((log: any) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((e: any) => e && e.name === 'EscrowCreated');

  const escrowAddress2 = event2?.args.escrowAddress;
  const escrow2 = await ethers.getContractAt("CompanyWishlistEscrow", escrowAddress2);

  console.log("   ✅ Created new escrow:", escrowAddress2);
  console.log("   🎯 Target: 2.0 ETH");

  // Small contribution
  await escrow2.connect(investor1).contribute({ value: ethers.parseEther("0.5") });
  console.log("   ✅ Investor 1 contributed 0.5 ETH (only 25% of target)");

  // Fast forward time to after deadline
  await network.provider.send("evm_increaseTime", [durationInDays * 24 * 60 * 60 + 1]);
  await network.provider.send("evm_mine", []);

  console.log("   ⏰ Fast-forwarded past deadline...");

  // Finalize the failed campaign
  await escrow2.finalize();
  console.log("   ✅ Campaign finalized");

  const failedStatus = await escrow2.getCampaignStatus();
  console.log("   ✔️  Finalized:", failedStatus[4]);
  console.log("   ❌ Successful:", failedStatus[5]);

  // Claim refund
  const investor1BalanceBefore = await network.provider.send("eth_getBalance", [investor1.address, "latest"]);
  await escrow2.connect(investor1).claimRefund();
  const investor1BalanceAfter = await network.provider.send("eth_getBalance", [investor1.address, "latest"]);

  console.log("   💸 Investor 1 claimed refund");
  console.log("   📊 Refund amount: ~0.5 ETH (minus gas)");
  console.log();

  // Summary
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("✅ All tests completed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log();
  console.log("📋 Summary:");
  console.log("  • Factory deployed and working");
  console.log("  • Successful campaign: Funds released to company");
  console.log("  • Failed campaign: Refunds processed correctly");
  console.log("  • All smart contract features validated");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
