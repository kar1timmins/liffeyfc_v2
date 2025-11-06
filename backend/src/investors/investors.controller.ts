import { Controller, Get, Post, Body, Param, UseGuards, Patch } from '@nestjs/common';
import { InvestorsService } from './investors.service';
import { CreateInvestorDto } from './dto/create-investor.dto';
import { UpgradeToInvestorDto } from './dto/upgrade-to-investor.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('investors')
export class InvestorsController {
  constructor(private readonly investorsService: InvestorsService) {}

  /**
   * Register a new investor
   */
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async register(@Body() createInvestorDto: CreateInvestorDto) {
    const investor = await this.investorsService.create(createInvestorDto);
    // Remove password hash from response
    const { passwordHash, ...result } = investor;
    return {
      success: true,
      data: { investor: result },
    };
  }

  /**
   * Get investor profile (protected)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Param('id') id: string) {
    const investor = await this.investorsService.findById(id);
    if (!investor) {
      return { success: false, data: null };
    }
    const { passwordHash, ...result } = investor;
    return { success: true, data: result };
  }

  /**
   * Upgrade current user to investor status (protected)
   * This endpoint allows logged-in users to upgrade their account to investor
   */
  @Patch('upgrade')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async upgradeToInvestor(
    @CurrentUser() user: any,
    @Body() upgradeData: UpgradeToInvestorDto,
  ) {
    // Only users can upgrade to investors (not staff, not already investors)
    if (user.userType !== 'user') {
      return {
        success: false,
        message: 'Only user accounts can be upgraded to investor status',
      };
    }

    const investor = await this.investorsService.upgradeUserToInvestor(
      user.sub,
      upgradeData,
    );

    const { passwordHash, ...result } = investor;
    return {
      success: true,
      message: 'Successfully upgraded to investor account',
      data: { investor: result },
    };
  }
}
