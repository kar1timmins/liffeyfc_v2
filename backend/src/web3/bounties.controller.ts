import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
  Query,
} from '@nestjs/common';
import { BountiesService } from './bounties.service';
import { UsersService } from '../users/users.service';
import { GcpStorageService } from '../common/gcp-storage.service';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateBountyDto, ManualContributionDto } from './dto/bounties-controller.dto';

@Controller('bounties')
export class BountiesController {
  private readonly logger = new Logger(BountiesController.name);

  constructor(
    private readonly bountiesService: BountiesService,
    private readonly usersService: UsersService,
    private readonly gcpStorageService: GcpStorageService,
  ) {}

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

      // For each bounty, attach owner sanitized data and signed profile photo URL where applicable
      await Promise.all(
        bounties.map(async (bounty) => {
          try {
            const ownerId = bounty.company?.ownerId;
            if (ownerId) {
              const user = await this.usersService.findById(ownerId);
              if (user) {
                let profileUrl = user.profilePhotoUrl ?? null;
                if (profileUrl && !profileUrl.startsWith('http')) {
                  try {
                    profileUrl =
                      await this.gcpStorageService.generateSignedUrl(
                        profileUrl,
                      );
                  } catch (err) {
                    // keep original path if signed url generation fails
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    this.logger.warn(
                      `Failed to generate signed URL for user ${ownerId}: ${errorMessage}`,
                    );
                  }
                }
                bounty.company.owner = {
                  id: user.id,
                  name: user.name ?? null,
                  profilePhotoUrl: profileUrl,
                } as any;
              }
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Failed to attach owner data for bounty ${bounty.id}: ${errorMessage}`,
            );
          }
        }),
      );

      return {
        success: true,
        data: bounties,
        message: `Found ${bounties.length} bounties`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounties:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch bounties';
      throw new HttpException(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get leaderboard: all public companies ranked by total raised funds across all networks (EUR) (public)
   */
  @Get('leaderboard')
  async getLeaderboard() {
    try {
      const entries = await this.bountiesService.getLeaderboard();
      return {
        success: true,
        data: entries,
        message: `Leaderboard with ${entries.length} companies`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch leaderboard:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch leaderboard';
      throw new HttpException(
        message,
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

      // Attach owner data for single bounty
      if (bounty?.company?.ownerId) {
        const owner = await this.usersService.findById(bounty.company.ownerId);
        if (owner) {
          let profileUrl = owner.profilePhotoUrl ?? null;
          if (profileUrl && !profileUrl.startsWith('http')) {
            try {
              profileUrl =
                await this.gcpStorageService.generateSignedUrl(profileUrl);
            } catch (err) {
              const errorMessage = err instanceof Error ? err.message : String(err);
              this.logger.warn(
                `Failed to generate signed URL for user ${owner.id}: ${errorMessage}`,
              );
            }
          }
          bounty.company.owner = {
            id: owner.id,
            name: owner.name ?? null,
            profilePhotoUrl: profileUrl,
          } as any;
        }
      }

      return {
        success: true,
        data: bounty,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounty:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch bounty';
      const status = (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        message,
        status,
      );
    }
  }

  /**
   * Create a bounty from wishlist item (requires authentication)
   */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createBounty(@Body() dto: CreateBountyDto, @CurrentUser() user: any) {
    try {
      const bounty = await this.bountiesService.createFromWishlistItem(
        dto.wishlistItemId,
        dto.targetAmountEur,
        dto.durationInDays,
        user.sub,
      );

      this.logger.log(`✅ Bounty created: ${bounty.id}`);

      return {
        success: true,
        data: bounty,
        message: 'Bounty created successfully',
      };
    } catch (error) {
      this.logger.error('❌ Failed to create bounty:', error);
      const message = error instanceof Error ? error.message : 'Failed to create bounty';
      const status = (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        message,
        status,
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
      const message = error instanceof Error ? error.message : 'Failed to sync bounty';
      throw new HttpException(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get contributors for a bounty
   */
  @Get(':id/contributors')
  async getBountyContributors(@Param('id') id: string) {
    try {
      const contributors = await this.bountiesService.getContributors(id);

      // Enrich each contributor with user profile (if available) and signed avatar URL
      await Promise.all(
        contributors.map(async (contributor) => {
          try {
            const user = await this.usersService.findByWallet(
              contributor.address,
            );
            if (user) {
              let profileUrl = user.profilePhotoUrl ?? null;
              if (profileUrl && !profileUrl.startsWith('http')) {
                try {
                  profileUrl =
                    await this.gcpStorageService.generateSignedUrl(profileUrl);
                } catch (err) {
                  const errorMessage = err instanceof Error ? err.message : String(err);
                  this.logger.warn(
                    `Failed to generate signed URL for contributor ${user.id}: ${errorMessage}`,
                  );
                }
              }
              contributor.user = {
                id: user.id,
                name: user.name ?? null,
                profilePhotoUrl: profileUrl,
              } as any;
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Failed to enrich contributor ${contributor.address}: ${errorMessage}`,
            );
          }
        }),
      );

      return {
        success: true,
        data: contributors,
        message: `Found ${contributors.length} contributors`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch contributors:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch contributors';
      throw new HttpException(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get deployment and contribution history for a bounty
   */
  @Get(':id/history')
  async getBountyHistory(@Param('id') id: string) {
    try {
      const history = await this.bountiesService.getBountyHistory(id);

      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch bounty history:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch bounty history';
      throw new HttpException(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Record a manual (off-chain) contribution for a non-EVM chain.
   * The investor sends SOL / XLM / BTC directly to the company's child wallet
   * and then reports it here with the transaction hash.
   */
  @Post(':id/contributions/manual')
  @UseGuards(AuthGuard('jwt'))
  async recordManualContribution(
    @Param('id') id: string,
    @Body() dto: ManualContributionDto,
    @CurrentUser() user: any,
  ) {
    try {
      await this.bountiesService.recordManualContribution(
        id,
        dto.chain as 'solana' | 'stellar' | 'bitcoin',
        dto.nativeAmount,
        dto.transactionHash,
        user.sub,
      );
      return { success: true, message: 'Contribution recorded successfully' };
    } catch (error) {
      this.logger.error('❌ Failed to record manual contribution:', error);
      const message = error instanceof Error ? error.message : 'Failed to record contribution';
      const status = (error as any)?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(
        message,
        status,
      );
    }
  }

  /**
   * Get contributions made by the authenticated user
   */
  @Get('contributions/user')
  @UseGuards(AuthGuard('jwt'))
  async getMyContributions(@CurrentUser() user: any) {
    try {
      const contributions = await this.bountiesService.getUserContributions(
        user.sub,
      );
      return { success: true, data: contributions };
    } catch (error) {
      this.logger.error('❌ Failed to fetch user contributions:', error);
      const message =
        error instanceof Error ? error.message : 'Failed to fetch contributions';
      throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Reset a stuck/failed deployment (no contracts saved) so the owner can retry.
   */
  @Delete('wishlist/:wishlistItemId/failed-deployment')
  @UseGuards(AuthGuard('jwt'))
  async resetFailedDeployment(
    @Param('wishlistItemId') wishlistItemId: string,
    @CurrentUser() user: any,
  ) {
    try {
      await this.bountiesService.resetFailedDeployment(wishlistItemId, user.userId);
      return { success: true, message: 'Deployment reset — you can now retry.' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset deployment';
      const status =
        error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
      throw new HttpException(message, status);
    }
  }

  /**
   * Get bounties for a specific company
   */
  @Get('company/:companyId')
  async getCompanyBounties(@Param('companyId') companyId: string) {
    try {
      const bounties = await this.bountiesService.findByCompany(companyId);

      // Attach owner data for each bounty similar to /bounties endpoint
      await Promise.all(
        bounties.map(async (bounty) => {
          try {
            const ownerId = bounty.company?.ownerId;
            if (ownerId) {
              const user = await this.usersService.findById(ownerId);
              if (user) {
                let profileUrl = user.profilePhotoUrl ?? null;
                if (profileUrl && !profileUrl.startsWith('http')) {
                  try {
                    profileUrl =
                      await this.gcpStorageService.generateSignedUrl(
                        profileUrl,
                      );
                  } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    this.logger.warn(
                      `Failed to generate signed URL for user ${ownerId}: ${errorMessage}`,
                    );
                  }
                }
                bounty.company.owner = {
                  id: user.id,
                  name: user.name ?? null,
                  profilePhotoUrl: profileUrl,
                } as any;
              }
            }
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Failed to attach owner data for bounty ${bounty.id}: ${errorMessage}`,
            );
          }
        }),
      );

      return {
        success: true,
        data: bounties,
        message: `Found ${bounties.length} bounties for company`,
      };
    } catch (error) {
      this.logger.error('❌ Failed to fetch company bounties:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch company bounties';
      throw new HttpException(
        message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
