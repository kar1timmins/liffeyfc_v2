import { ethers } from 'hardhat';

async function main() {
  // Example values (replace with the ones you want to encode)
  const company = process.env.COMPANY || '0x6A61249c538b2EAA5A9dc49D0B696AA5f5CB0da3';
  const masterWallet = process.env.MASTER_WALLET || '0xb0cd333843a1b9efD6aaFc879b79Bf5d9C4D83a8';
  const targetWei = process.env.TARGET_WEI || '759900000000000000';
  const durationDays = process.env.DURATION_DAYS || '7';
  const campaignName = process.env.CAMPAIGN_NAME || 'Electricity';
  const campaignDescription = process.env.CAMPAIGN_DESCRIPTION || 'We are expanding and require extra cashflow.';

  const types = ['address', 'address', 'uint256', 'uint256', 'string', 'string'];
  const values = [company, masterWallet, targetWei, durationDays, campaignName, campaignDescription];

  // Use ethers to ABI-encode the constructor args
  // In ethers v6, use `ethers.formatBytes32String` etc., but defaultAbiCoder is available via `ethers` utilities
  // Use ethers AbiCoder directly
  const { AbiCoder } = await import('ethers');
  const abi = new AbiCoder();
  const encoded = abi.encode(types, values);

  // Remove leading 0x if present
  const hex = encoded.startsWith('0x') ? encoded.slice(2) : encoded;

  console.log('Constructor ABI-encoded args (hex):');
  console.log(hex);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});