import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CompaniesService } from './companies.service';
import type { CreateCompanyDto, UpdateCompanyDto, CreateWishlistItemDto } from './companies.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { CompanyStage, FundingStage } from '../entities/company.entity';

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createCompany(
    @Body() data: CreateCompanyDto,
    @CurrentUser() currentUser: any,
  ) {
    try {
      const company = await this.companiesService.createCompany(currentUser.sub, data);
      return { success: true, data: company };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to create company' };
    }
  }

  @Get()
  async getAllPublicCompanies(
    @Query('industry') industry?: string,
    @Query('stage') stage?: CompanyStage,
    @Query('fundingStage') fundingStage?: FundingStage,
    @Query('tags') tags?: string,
  ) {
    try {
      const filters = {
        industry,
        stage,
        fundingStage,
        tags: tags ? tags.split(',') : undefined,
      };

      const companies = await this.companiesService.getAllPublicCompanies(filters);
      return { success: true, data: companies };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to fetch companies' };
    }
  }

  @Get('my-companies')
  @UseGuards(AuthGuard('jwt'))
  async getMyCompanies(@CurrentUser() currentUser: any) {
    try {
      const companies = await this.companiesService.getCompaniesByUser(currentUser.sub);
      return { success: true, data: companies };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to fetch companies' };
    }
  }

  @Get(':id')
  async getCompanyById(
    @Param('id') id: string,
    @Query('includeWishlist') includeWishlist?: string,
  ) {
    try {
      const company = await this.companiesService.getCompanyById(
        id,
        includeWishlist === 'true'
      );

      if (!company) {
        return { success: false, message: 'Company not found' };
      }

      return { success: true, data: company };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to fetch company' };
    }
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateCompany(
    @Param('id') id: string,
    @Body() data: UpdateCompanyDto,
    @CurrentUser() currentUser: any,
  ) {
    try {
      const company = await this.companiesService.updateCompany(id, currentUser.sub, data);
      
      if (!company) {
        return { success: false, message: 'Company not found or unauthorized' };
      }

      return { success: true, data: company };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to update company' };
    }
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteCompany(
    @Param('id') id: string,
    @CurrentUser() currentUser: any,
  ) {
    try {
      const deleted = await this.companiesService.deleteCompany(id, currentUser.sub);
      
      if (!deleted) {
        return { success: false, message: 'Company not found or unauthorized' };
      }

      return { success: true, message: 'Company deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to delete company' };
    }
  }

  // Wishlist endpoints
  @Post(':id/wishlist')
  @UseGuards(AuthGuard('jwt'))
  async addWishlistItem(
    @Param('id') companyId: string,
    @Body() data: CreateWishlistItemDto,
    @CurrentUser() currentUser: any,
  ) {
    try {
      const item = await this.companiesService.addWishlistItem(companyId, currentUser.sub, data);
      
      if (!item) {
        return { success: false, message: 'Company not found or unauthorized' };
      }

      return { success: true, data: item };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to add wishlist item' };
    }
  }

  @Get(':id/wishlist')
  async getCompanyWishlist(@Param('id') companyId: string) {
    try {
      const items = await this.companiesService.getCompanyWishlist(companyId);
      return { success: true, data: items };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to fetch wishlist' };
    }
  }

  @Patch(':companyId/wishlist/:itemId')
  @UseGuards(AuthGuard('jwt'))
  async updateWishlistItem(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @Body() data: Partial<CreateWishlistItemDto> & { isFulfilled?: boolean },
    @CurrentUser() currentUser: any,
  ) {
    try {
      const item = await this.companiesService.updateWishlistItem(
        itemId,
        companyId,
        currentUser.sub,
        data
      );
      
      if (!item) {
        return { success: false, message: 'Wishlist item not found or unauthorized' };
      }

      return { success: true, data: item };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to update wishlist item' };
    }
  }

  @Delete(':companyId/wishlist/:itemId')
  @UseGuards(AuthGuard('jwt'))
  async deleteWishlistItem(
    @Param('companyId') companyId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() currentUser: any,
  ) {
    try {
      const deleted = await this.companiesService.deleteWishlistItem(
        itemId,
        companyId,
        currentUser.sub
      );
      
      if (!deleted) {
        return { success: false, message: 'Wishlist item not found or unauthorized' };
      }

      return { success: true, message: 'Wishlist item deleted successfully' };
    } catch (error) {
      return { success: false, message: error.message || 'Failed to delete wishlist item' };
    }
  }
}
