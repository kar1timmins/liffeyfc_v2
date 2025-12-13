import { ethers } from 'hardhat';

async function main() {
  const hre = await import('hardhat');
  const networkName = hre.network.name;

  let factoryAddress: string | undefined;
  if (networkName === 'fuji') {
    factoryAddress = process.env.AVALANCHE_FACTORY_ADDRESS;
  } else {
    factoryAddress = process.env.ETHEREUM_FACTORY_ADDRESS;
  }

  if (!factoryAddress) throw new Error('Factory address not set in .env for network: ' + networkName);
  console.log(`Using factory: ${factoryAddress} on network ${networkName}`);

  const Factory = await ethers.getContractAt('EscrowFactoryUpgradeable', factoryAddress);

  const latestBlock = await ethers.provider.getBlockNumber();
  const blockRange = parseInt(process.env.EVENT_QUERY_BLOCK_RANGE || '2048');
  const fromBlock = Math.max(0, latestBlock - blockRange);
  console.log(`Querying events from block ${fromBlock} to ${latestBlock}`);
  const events = await Factory.queryFilter(Factory.filters.EscrowCreated(), fromBlock, latestBlock);

  if (!events || events.length === 0) {
    console.log('No recent EscrowCreated events found on factory.');
    return;
  }

  const ev = events[events.length - 1];
  const args = ev.args!;
  const escrowAddress = args[0];
  const company = args[1];
  const targetAmount = args[2];
  const deadline = args[3];
  const timestamp = args[4];
  const campaignName = args[5];
  const campaignDescription = args[6];

  console.log('Found escrow:', escrowAddress);
  console.log('Company:', company);
  console.log('Target (wei):', targetAmount.toString());
  console.log('deadline:', deadline.toString());
  console.log('factory event timestamp:', timestamp.toString());
  console.log('campaignName:', campaignName);
  console.log('campaignDescription:', campaignDescription);

  const Escrow = await ethers.getContractAt('CompanyWishlistEscrow', escrowAddress);
  const masterWallet = await Escrow.masterWallet();
  const creator = await Escrow.creator();
  const campaignNameOnChain = await Escrow.campaignName();
  const campaignDescriptionOnChain = await Escrow.campaignDescription();

  console.log('masterWallet (onchain):', masterWallet);
  console.log('creator:', creator);
  console.log('campaignName (onchain):', campaignNameOnChain);
  console.log('campaignDescription (onchain):', campaignDescriptionOnChain);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
