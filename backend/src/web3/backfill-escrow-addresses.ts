import { DataSource } from 'typeorm';
import { WishlistItem } from '../entities/wishlist-item.entity';
import { EscrowDeployment } from '../entities/escrow-deployment.entity';

const isDev = process.env.NODE_ENV !== 'production';
const devLog = (msg: string, ...args: any[]) => isDev && console.log(msg, ...args);

/**
 * One-time script to backfill wishlist items with escrow contract addresses
 * from existing escrow_deployments records
 */
export async function backfillEscrowAddresses(dataSource: DataSource) {
  const wishlistRepo = dataSource.getRepository(WishlistItem);
  const escrowRepo = dataSource.getRepository(EscrowDeployment);

  devLog('🔄 Starting escrow address backfill...');

  // Get all escrow deployments
  const deployments = await escrowRepo.find({
    relations: ['wishlistItem'],
  });

  devLog(`Found ${deployments.length} escrow deployments`);

  const updates: Map<string, { eth?: string; avax?: string; deadline?: Date; duration?: number }> = new Map();

  // Group deployments by wishlist item
  for (const deployment of deployments) {
    const itemId = deployment.wishlistItemId;
    
    if (!updates.has(itemId)) {
      updates.set(itemId, {});
    }

    const update = updates.get(itemId)!;

    if (deployment.chain === 'ethereum') {
      update.eth = deployment.contractAddress;
      update.deadline = deployment.deadline;
      update.duration = deployment.durationInDays;
    } else if (deployment.chain === 'avalanche') {
      update.avax = deployment.contractAddress;
      update.deadline = deployment.deadline;
      update.duration = deployment.durationInDays;
    }
  }

  devLog(`Updating ${updates.size} wishlist items...`);

  let updatedCount = 0;

  // Update wishlist items
  for (const [itemId, data] of updates.entries()) {
    const item = await wishlistRepo.findOne({ where: { id: itemId } });
    
    if (!item) {
      console.warn(`⚠️  Wishlist item ${itemId} not found, skipping`);
      continue;
    }

    let changed = false;

    if (data.eth && !item.ethereumEscrowAddress) {
      item.ethereumEscrowAddress = data.eth;
      changed = true;
    }

    if (data.avax && !item.avalancheEscrowAddress) {
      item.avalancheEscrowAddress = data.avax;
      changed = true;
    }

    if (data.deadline && !item.campaignDeadline) {
      item.campaignDeadline = data.deadline;
      changed = true;
    }

    if (data.duration && !item.campaignDurationDays) {
      item.campaignDurationDays = data.duration;
      changed = true;
    }

    if (changed && !item.isEscrowActive) {
      item.isEscrowActive = true;
    }

    if (changed) {
      await wishlistRepo.save(item);
      updatedCount++;
      devLog(`✅ Updated wishlist item ${itemId} (ETH: ${data.eth || 'N/A'}, AVAX: ${data.avax || 'N/A'})`);
    }
  }

  devLog(`✨ Backfill complete! Updated ${updatedCount} wishlist items.`);
}
