import { expect } from 'chai';
import { ethers } from 'hardhat';
import type { JsonRpcProvider } from 'ethers';
import { Web3Service } from '../../backend/src/web3/web3.service';
import { SupportedChain } from '../../backend/src/web3/interfaces/wallet.interface';

describe('Web3Service (Hardhat suite)', function () {
  let service: Web3Service;
  before(function () {
    const overrides = new Map<string, JsonRpcProvider>();
    const provider = ethers.provider as JsonRpcProvider;
    overrides.set(SupportedChain.ETHEREUM_MAINNET, provider);
    overrides.set(SupportedChain.AVALANCHE_MAINNET, provider);
    service = new Web3Service(overrides);
  });

  it('exposes available chains for Ethereum and Avalanche', function () {
    const chains = service.getSupportedChains();
    expect(chains.map(chain => chain.chainId)).to.include.members([
      SupportedChain.ETHEREUM_MAINNET,
      SupportedChain.AVALANCHE_MAINNET,
    ]);
  });

  it('validates addresses correctly', function () {
    const wallet = ethers.Wallet.createRandom();
    expect(service.isValidAddress(wallet.address)).to.be.true;
    expect(service.isValidAddress('0x123')).to.be.false;
  });

  it('connects a signer and returns its balance', async function () {
    const [signer] = await ethers.getSigners();
    const address = await signer.getAddress();

    const connection = await service.connectWallet({
      address,
      chainId: SupportedChain.ETHEREUM_MAINNET,
    });

    expect(connection.chainName).to.equal('Ethereum Mainnet');

    const balance = await service.getBalance(address, SupportedChain.ETHEREUM_MAINNET);

    expect(balance.address).to.equal(address);
    expect(Number(balance.formattedBalance)).to.be.greaterThan(0);
  });

  it('connects a random wallet address', async function () {
    const wallet = ethers.Wallet.createRandom();
    const connection = await service.connectWallet({
      address: wallet.address,
      chainId: SupportedChain.ETHEREUM_MAINNET,
    });
    expect(connection.address).to.equal(wallet.address);
    expect(connection.chainName).to.equal('Ethereum Mainnet');
  });

  it('throws when an unsupported chain is requested', async function () {
    let caughtError: Error | null = null;
    try {
      await service.connectWallet({
        address: ethers.Wallet.createRandom().address,
        chainId: '0x9999',
      });
    } catch (error: any) {
      caughtError = error;
    }

    expect(caughtError).to.not.be.null;
    expect(caughtError?.message).to.include('Chain ID 0x9999 is not supported');
  });
});
