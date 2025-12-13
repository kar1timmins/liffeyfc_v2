import { ethers } from 'hardhat';

async function main() {
  const hre = await import('hardhat');
  const networkName = hre.network.name;

  // Select factory and required API key based on network
  let factoryAddress: string | undefined;
  if (networkName === 'fuji') {
    factoryAddress = process.env.AVALANCHE_FACTORY_ADDRESS;
    if (!process.env.SNOWTRACE_API_KEY) {
      throw new Error('SNOWTRACE_API_KEY not set in .env — verification on Fuji requires a Snowtrace API key');
    }
  } else {
    factoryAddress = process.env.ETHEREUM_FACTORY_ADDRESS;
    if (!process.env.ETHERSCAN_API_KEY) {
      throw new Error('ETHERSCAN_API_KEY not set in .env — verification on Etherscan requires an Etherscan API key');
    }
  }

  if (!factoryAddress) throw new Error('Factory address not set in .env for network: ' + networkName);

  console.log(`Using factory: ${factoryAddress} on network ${networkName}`);

  const Factory = await ethers.getContractAt('EscrowFactoryUpgradeable', factoryAddress);

  console.log('Querying EscrowCreated events on factory (recent)...');
  const latestBlock = await ethers.provider.getBlockNumber();
  const blockRange = parseInt(process.env.EVENT_QUERY_BLOCK_RANGE || '2048');
  const fromBlock = Math.max(0, latestBlock - blockRange);
  console.log(`Querying events from block ${fromBlock} to ${latestBlock}`);
  const events = await Factory.queryFilter(Factory.filters.EscrowCreated(), fromBlock, latestBlock);

  if (!events || events.length === 0) {
    console.log('No recent EscrowCreated events found on factory. Try expanding the block range or provide an escrow address directly.');
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
  console.log('Deadline:', deadline.toString());
  console.log('Event timestamp:', timestamp.toString());

  // Derive durationInDays from deadline - timestamp (handle BigNumber/BigInt)
  const durationSeconds = Number(deadline.toString()) - Number(timestamp.toString());
  const durationDays = Math.round(durationSeconds / 86400);
  console.log('Derived durationDays:', durationDays);

  // Read masterWallet from the deployed escrow contract
  const Escrow = await ethers.getContractAt('CompanyWishlistEscrow', escrowAddress);
  const masterWallet = await Escrow.masterWallet();
  console.log('Master wallet from escrow:', masterWallet);

  // Prepare constructor args: company, masterWallet, targetAmountWei, durationDays, campaignName, campaignDescription
  const constructorArguments = [company, masterWallet, targetAmount.toString(), durationDays, campaignName, campaignDescription];

  console.log('Running verification with constructor args:');
  console.log(constructorArguments);

  try {
    // Use Hardhat verify task
    await (await import('hardhat')).run('verify:verify', {
      address: escrowAddress,
      constructorArguments,
    });
    console.log('✅ Verification submitted successfully.');
  } catch (err: any) {
    console.error('❌ Verification failed:', err.message || err);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
