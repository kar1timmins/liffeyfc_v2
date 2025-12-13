import AppDataSource from '../src/data-source';
import { ContractDeploymentHistory, ContractAction } from '../src/entities/contract-deployment-history.entity';

async function main() {
  console.log('Initializing datasource...');
  await AppDataSource.initialize();
  console.log('Initialized');

  const repo = AppDataSource.getRepository(ContractDeploymentHistory);
  console.log('Repository obtained');

  const entry = repo.create({
    userId: '00000000-0000-0000-0000-000000000000',
    companyId: '00000000-0000-0000-0000-000000000000',
    wishlistItemId: '00000000-0000-0000-0000-000000000000',
    fromAddress: '0x0000000000000000000000000000000000000000',
    chain: 'ethereum',
    network: 'sepolia',
    action: ContractAction.DEPLOYED,
  });

  const saved = await repo.save(entry);
  console.log('Saved entry id:', saved.id);

  await AppDataSource.destroy();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});