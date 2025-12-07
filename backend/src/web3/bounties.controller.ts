import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';

class CreateBountyDto {
  wishlistItemId: string;
  targetAmountEur: number;
  durationInDays: number;
  description?: string;
}

@Controller('bounties')
export class BountiesController {
  private readonly logger = new Logger(BountiesController.name);

  constructor(private readonly bountiesService: BountiesService) {}

  /**
   * Get all active bounties (public)
   */
  @Get()
  async getAllBounties(
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('companyId') companyId?: string,
  ) {
    try {
      const bounties = await this.bountiesService.findAll({
        status,
        category,
        companyId,
      });

      return {
        success: true,
        data: bounties,
        message: `Found ${bounties.length} bounties`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounties:', error);
      throw new HttpException(
        error.message || 'Failed to fetch bounties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific bounty by ID (public)
   */
  @Get(':id')
  async getBountyById(@Param('id') id: string) {
    try {
      const bounty = await this.bountiesService.findById(id);

      if (!bounty) {
        throw new HttpException('Bounty not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: bounty,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounty:', error);
      throw new HttpException(
        error.message || 'Failed to fetch bounty',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a bounty from wishlist item (requires authentication)
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createBounty(
    @Body() dto: CreateBountyDto,
    @CurrentUser() user: any,
  ) {
    try {
      const bounty = await this.bountiesService.createFromWishlistItem(
        dto.wishlistItemId,
        dto.targetAmountEur,
        dto.durationInDays,
        user.id,
      );

      this.logger.log(`✅ Bounty created: ${bounty.id}`);

      return {
        success: true,
        data: bounty,
        message: 'Bounty created successfully',
      };
    } catch (error) {
      this.logger.error('❌ Failed to create bounty:', error);
      throw new HttpException(
        error.message || 'Failed to create bounty',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Sync bounty status with blockchain
   */
  @Post(':id/sync')
  async syncBounty(@Param('id') id: string) {
    try {
      const bounty = await this.bountiesService.syncWithBlockchain(id);

      return {
        success: true,
        data: bounty,
        message: 'Bounty synced with blockchain',
      };
    } catch (error) {
      this.logger.error('❌ Failed to sync bounty:', error);
      throw new HttpException(
        error.message || 'Failed to sync bounty',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get bounties for a specific company
   */
  @Get('company/:companyId')
  async getCompanyBounties(@Param('companyId') companyId: string) {
    try {
      const bounties = await this.bountiesService.findByCompany(companyId);

      return {
        success: true,
        data: bounties,
        message: `Found ${bounties.length} bounties for company`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch company bounties:', error);
      throw new HttpException(
        error.message || 'Failed to fetch company bounties',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
