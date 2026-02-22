import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ContractDeploymentHistory,
  ContractAction,
} from '../entities/contract-deployment-history.entity';

@Injectable()
export class ContractHistoryService {
  private readonly logger = new Logger(ContractHistoryService.name);

  constructor(
    @InjectRepository(ContractDeploymentHistory)
    private readonly historyRepo: Repository<ContractDeploymentHistory>,
  ) {}

  /**
   * Log a contract deployment action
   */
  async logAction(params: {
    userId: string;
    companyId: string;
    wishlistItemId: string;
    escrowDeploymentId?: string;
    contractAddress?: string;
    fromAddress: string;
    chain: string;
    network: string;
    action: ContractAction;
    transactionHash?: string;
    metadata?: Record<string, any>;
    notes?: string;
  }): Promise<void> {
    try {
      const historyEntry = this.historyRepo.create({
        userId: params.userId,
        companyId: params.companyId,
        wishlistItemId: params.wishlistItemId,
        escrowDeploymentId: params.escrowDeploymentId,
        contractAddress: params.contractAddress,
        fromAddress: params.fromAddress,
        chain: params.chain,
        network: params.network,
        action: params.action,
        transactionHash: params.transactionHash,
        metadata: params.metadata,
        notes: params.notes,
      });

      await this.historyRepo.save(historyEntry);

      this.logger.log(
        `📝 Contract history logged: ${params.action} by ${params.fromAddress} on ${params.chain}/${params.network}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to log contract history: ${error.message}`,
        error.stack,
      );
      // Don't throw - logging failures shouldn't break business logic
    }
  }

  /**
   * Get contract history for a user
   */
  async getUserHistory(userId: string): Promise<ContractDeploymentHistory[]> {
    return this.historyRepo.find({
      where: { userId },
      relations: ['company', 'wishlistItem', 'user'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get contract history for a company
   */
  async getCompanyHistory(
    companyId: string,
  ): Promise<ContractDeploymentHistory[]> {
    return this.historyRepo.find({
      where: { companyId },
      relations: ['user', 'wishlistItem', 'company'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get contract history for a specific contract address
   */
  async getContractHistory(
    contractAddress: string,
  ): Promise<ContractDeploymentHistory[]> {
    return this.historyRepo.find({
      where: { contractAddress },
      relations: ['user', 'company', 'wishlistItem'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get deployment history for a wishlist item
   */
  async getWishlistItemHistory(
    wishlistItemId: string,
  ): Promise<ContractDeploymentHistory[]> {
    return this.historyRepo.find({
      where: { wishlistItemId },
      relations: ['user', 'company', 'wishlistItem'],
      order: { createdAt: 'DESC' },
    });
  }
}
