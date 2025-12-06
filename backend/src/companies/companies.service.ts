import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company, CompanyStage, FundingStage } from '../entities/company.entity';
import { WishlistItem, WishlistCategory, WishlistPriority } from '../entities/wishlist-item.entity';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';

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
    return companies.map(c => this.sanitizeCompany(c));
  }

  async createCompany(userId: string, data: CreateCompanyDto): Promise<Company> {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const company = this.companiesRepo.create({
      ...data,
      ownerId: userId,
      owner: user,
    });

    return this.companiesRepo.save(company);
  }

  async updateCompany(companyId: string, userId: string, data: UpdateCompanyDto): Promise<Company | null> {
    const company = await this.companiesRepo.findOne({ 
      where: { id: companyId, ownerId: userId } 
    });

    if (!company) {
      return null;
    }

    Object.assign(company, data);
    return this.companiesRepo.save(company);
  }

  async getCompanyById(id: string, includeWishlist = false): Promise<Company | null> {
    const relations = includeWishlist ? ['wishlistItems', 'owner'] : ['owner'];
    const company = await this.companiesRepo.findOne({ 
      where: { id, isActive: true },
      relations 
    });
    
    if (!company) return null;
    
    // Sanitize owner data before returning
    return this.sanitizeCompany(company);
  }

  async getCompaniesByUser(userId: string): Promise<Company[]> {
    return this.companiesRepo.find({ 
      where: { ownerId: userId },
      relations: ['wishlistItems'],
      order: { createdAt: 'DESC' }
    });
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
      query.andWhere('company.industry = :industry', { industry: filters.industry });
    }

    if (filters?.stage) {
      query.andWhere('company.stage = :stage', { stage: filters.stage });
    }

    if (filters?.fundingStage) {
      query.andWhere('company.fundingStage = :fundingStage', { fundingStage: filters.fundingStage });
    }

    if (filters?.tags && filters.tags.length > 0) {
      query.andWhere('company.tags && :tags', { tags: filters.tags });
    }

    const companies = await query.orderBy('company.createdAt', 'DESC').getMany();
    
    // Sanitize owner data for all companies
    return this.sanitizeCompanies(companies);
  }

  async deleteCompany(companyId: string, userId: string): Promise<boolean> {
    const result = await this.companiesRepo.delete({ 
      id: companyId, 
      ownerId: userId 
    });
    return result.affected ? result.affected > 0 : false;
  }

  // Wishlist methods
  async addWishlistItem(companyId: string, userId: string, data: CreateWishlistItemDto): Promise<WishlistItem | null> {
    const company = await this.companiesRepo.findOne({ 
      where: { id: companyId, ownerId: userId } 
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

  async updateWishlistItem(itemId: string, companyId: string, userId: string, data: Partial<CreateWishlistItemDto> & { isFulfilled?: boolean }): Promise<WishlistItem | null> {
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

  async deleteWishlistItem(itemId: string, companyId: string, userId: string): Promise<boolean> {
    const item = await this.wishlistRepo.findOne({
      where: { id: itemId, companyId },
      relations: ['company'],
    });

    if (!item || item.company.ownerId !== userId) {
      return false;
    }

    const result = await this.wishlistRepo.delete(itemId);
    return result.affected ? result.affected > 0 : false;
  }

  async getCompanyWishlist(companyId: string): Promise<WishlistItem[]> {
    return this.wishlistRepo.find({
      where: { companyId },
      order: { priority: 'DESC', createdAt: 'DESC' }
    });
  }
}
