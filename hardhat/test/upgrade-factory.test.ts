import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("EscrowFactory upgradeability", function () {
  it("deploys proxy, creates escrow, upgrades and preserves state", async function () {
    const [deployer, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("EscrowFactoryUpgradeable");
    const proxy = await upgrades.deployProxy(Factory, [deployer.address], { kind: "uups" });
    await proxy.waitForDeployment();

    // initially zero
    expect((await proxy.getEscrowCount()).toString()).to.equal("0");

    // create an escrow
    const tx = await proxy.createEscrow(
      other.address, // company
      deployer.address, // master
      1_000_000_000_000_000n, // target (wei)
      1, // duration days
      "Test",
      "desc"
    );
    await tx.wait();

    expect((await proxy.getEscrowCount()).toString()).to.equal("1");

    // Upgrade to V2
    const FactoryV2 = await ethers.getContractFactory("EscrowFactoryV2Upgradeable");
    const upgraded = await upgrades.upgradeProxy(await proxy.getAddress(), FactoryV2);
    await upgraded.waitForDeployment();

    // state preserved
    expect((await upgraded.getEscrowCount()).toString()).to.equal("1");

    // new method present
    expect(await upgraded.version()).to.equal("v2");
  });
});
