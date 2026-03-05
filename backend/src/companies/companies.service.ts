import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Company,
  CompanyStage,
  FundingStage,
} from '../entities/company.entity';
import {
  WishlistItem,
  WishlistCategory,
  WishlistPriority,
} from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';
import { WalletGenerationService } from '../web3/wallet-generation.service';

export interface CreateCompanyDto {
  name: string;
  description: string;
  industry?: string;
  website?: string;
  employeeCount?: number;
  stage?: CompanyStage;
  fundingStage?: FundingStage;
  location?: string;
  foundedDate?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  ethAddress?: string;
  avaxAddress?: string;
  tags?: string[];
}

export interface UpdateCompanyDto extends Partial<CreateCompanyDto> {
  isPublic?: boolean;
  isActive?: boolean;
  logoUrl?: string;
}

export interface CreateWishlistItemDto {
  title: string;
  description?: string;
  value?: number;
  category?: WishlistCategory;
  priority?: WishlistPriority;
}

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepo: Repository<Company>,
    @InjectRepository(WishlistItem)
    private wishlistRepo: Repository<WishlistItem>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private usersService: UsersService,
    private walletService: WalletGenerationService,
  ) {}

  /**
   * Sanitize company data by removing sensitive owner information
   */
  private sanitizeCompany(company: Company): Company {
    if (company.owner) {
      // Replace full user object with sanitized version
      company.owner = this.usersService.sanitizeUser(company.owner) as any;
    }
    return company;
  }

  /**
   * Sanitize array of companies
   */
  private sanitizeCompanies(companies: Company[]): Company[] {
    return companies.map((c) => this.sanitizeCompany(c));
  }

  /**
   * Remove internal fields from company for owner's view
   * Owner doesn't need to see ownerId (they know it's theirs)
   */
  private sanitizeOwnCompany(company: Company): Partial<Company> {
    const { ownerId, owner, isActive, ...cleanCompany } = company;
    return cleanCompany;
  }

  /**
   * Sanitize array of owned companies
   */
  private sanitizeOwnCompanies(companies: Company[]): Partial<Company>[] {
    return companies.map((c) => this.sanitizeOwnCompany(c));
  }

  async createCompany(
    userId: string,
    data: CreateCompanyDto,
  ): Promise<Company> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // prevent duplicate company names for the same user (case‑insensitive)
    const existing = await this.companiesRepo.findOne({
      where: { ownerId: userId, name: data.name },
    });
    if (existing) {
      throw new Error('You already have a company registered with that name');
    }

    const company = this.companiesRepo.create({
      ...data,
      ownerId: userId,
      owner: user,
    });

    const savedCompany = await this.companiesRepo.save(company);
    const isDev = process.env.NODE_ENV !== 'production';
    if (isDev)
      console.log('[Company Creation] Company saved:', savedCompany.id);

    // Auto-generate company wallet if user has a master wallet
    try {
      const hasMasterWallet = await this.walletService.hasMasterWallet(userId);
      if (isDev)
        console.log(
          '[Company Creation] User has master wallet:',
          hasMasterWallet,
        );

      if (hasMasterWallet) {
        if (isDev)
          console.log(
            '[Company Creation] Starting wallet generation for company:',
            savedCompany.id,
          );
        try {
          const walletResult = await this.walletService.generateCompanyWallet(
            userId,
            savedCompany.id,
          );
          if (isDev)
            console.log(
              '[Company Creation] Generated company wallet:',
              walletResult,
            );
        } catch (walletError) {
          if (isDev)
            console.error(
              '[Company Creation] Wallet generation error:',
              walletError.message,
              walletError.stack,
            );
          throw walletError;
        }
      } else {
        if (isDev)
          console.log(
            '[Company Creation] User does not have master wallet, skipping wallet generation',
          );
      }
    } catch (error) {
      // Log but don't fail company creation if wallet generation fails
      console.error(
        '[Company Creation] Failed to generate company wallet:',
        error.message,
      );
    }

    // Fetch the company again to get the updated wallet addresses
    // Use a raw query to ensure fresh data from database
    const updatedCompany = await this.companiesRepo.findOne({
      where: { id: savedCompany.id },
      relations: ['owner'],
    });

    if (isDev)
      console.log('[Company Creation] Final company state:', {
        id: updatedCompany?.id,
        ethAddress: updatedCompany?.ethAddress,
        avaxAddress: updatedCompany?.avaxAddress,
      });

    return updatedCompany || savedCompany;
  }

  async updateCompany(
    companyId: string,
    userId: string,
    data: UpdateCompanyDto,
  ): Promise<Company | null> {
    const company = await this.companiesRepo.findOne({
      where: { id: companyId, ownerId: userId },
    });

    if (!company) {
      return null;
    }

    Object.assign(company, data);
    return this.companiesRepo.save(company);
  }

  async getCompanyById(
    id: string,
    includeWishlist = false,
  ): Promise<Company | null> {
    const relations = includeWishlist ? ['wishlistItems', 'owner'] : ['owner'];
    const company = await this.companiesRepo.findOne({
      where: { id, isActive: true },
      relations,
    });

    if (!company) return null;

    // Sanitize owner data before returning
    return this.sanitizeCompany(company);
  }

  async getCompaniesByUser(userId: string): Promise<Partial<Company>[]> {
    const companies = await this.companiesRepo.find({
      where: { ownerId: userId },
      relations: ['wishlistItems'],
      order: { createdAt: 'DESC' },
    });

    // Remove internal fields for owner's view
    return this.sanitizeOwnCompanies(companies);
  }

  async getAllPublicCompanies(filters?: {
    industry?: string;
    stage?: CompanyStage;
    fundingStage?: FundingStage;
    tags?: string[];
  }): Promise<Company[]> {
    const query = this.companiesRepo
      .createQueryBuilder('company')
      .leftJoinAndSelect('company.owner', 'owner')
      .leftJoinAndSelect('company.wishlistItems', 'wishlist')
      .where('company.isPublic = :isPublic', { isPublic: true })
      .andWhere('company.isActive = :isActive', { isActive: true });

    if (filters?.industry) {
      query.andWhere('company.industry = :industry', {
        industry: filters.industry,
      });
    }

    if (filters?.stage) {
      query.andWhere('company.stage = :stage', { stage: filters.stage });
    }

    if (filters?.fundingStage) {
      query.andWhere('company.fundingStage = :fundingStage', {
        fundingStage: filters.fundingStage,
      });
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.andWhere('company.tags && :tags', { tags: filters.tags });
    }

    const companies = await query
      .orderBy('company.createdAt', 'DESC')
      .getMany();

    // Sanitize owner data for all companies
    return this.sanitizeCompanies(companies);
  }

  async deleteCompany(companyId: string, userId: string): Promise<boolean> {
    const result = await this.companiesRepo.delete({
      id: companyId,
      ownerId: userId,
    });
    return result.affected ? result.affected > 0 : false;
  }

  // Wishlist methods
  async addWishlistItem(
    companyId: string,
    userId: string,
    data: CreateWishlistItemDto,
  ): Promise<WishlistItem | null> {
    const company = await this.companiesRepo.findOne({
      where: { id: companyId, ownerId: userId },
    });

    if (!company) {
      return null;
    }

    const item = this.wishlistRepo.create({
      ...data,
      companyId,
      company,
    });

    return this.wishlistRepo.save(item);
  }

  async updateWishlistItem(
    itemId: string,
    companyId: string,
    userId: string,
    data: Partial<CreateWishlistItemDto> & { isFulfilled?: boolean },
  ): Promise<WishlistItem | null> {
    const item = await this.wishlistRepo.findOne({
      where: { id: itemId, companyId },
      relations: ['company'],
    });

    if (!item || item.company.ownerId !== userId) {
      return null;
    }

    Object.assign(item, data);
    return this.wishlistRepo.save(item);
  }

  async deleteWishlistItem(
    itemId: string,
    companyId: string,
    userId: string,
  ): Promise<boolean> {
    const item = await this.wishlistRepo.findOne({
      where: { id: itemId, companyId },
      relations: ['company', 'escrowDeployments'],
    });

    if (!item || item.company.ownerId !== userId) {
      return false;
    }

    // Prevent deletion if escrow contracts are deployed for this wishlist item
    if (item.escrowDeployments && item.escrowDeployments.length > 0) {
      // Check if any deployments are active (not failed or expired)
      const activeDeployments = item.escrowDeployments.filter(
        (deployment) => deployment.status === 'active',
      );

      if (activeDeployments.length > 0) {
        throw new Error(
          'Cannot delete wishlist item with active escrow contracts. Please finalize or expire contracts first.',
        );
      }
    }

    const result = await this.wishlistRepo.delete(itemId);
    return result.affected ? result.affected > 0 : false;
  }

  async getCompanyWishlist(companyId: string): Promise<WishlistItem[]> {
    return this.wishlistRepo.find({
      where: { companyId },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async addDonationToWishlistItem(
    itemId: string,
    companyId: string,
    userId: string,
    amount: number,
  ): Promise<WishlistItem | null> {
    const item = await this.wishlistRepo.findOne({
      where: { id: itemId, companyId },
      relations: ['company'],
    });

    if (!item) {
      return null;
    }

    // Prevent owners from donating to their own company
    if (item.company.ownerId === userId) {
      return null;
    }

    // Update amountRaised
    const currentAmount = parseFloat(item.amountRaised?.toString() || '0');
    const newAmount = currentAmount + amount;
    item.amountRaised = newAmount;

    // Auto-fulfill if goal is reached
    if (item.value && newAmount >= item.value) {
      item.isFulfilled = true;
    }

    return this.wishlistRepo.save(item);
  }
}
