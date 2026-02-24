import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import bcrypt from 'bcryptjs';
import { SetupAdminDto } from './dto/setup-admin.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { User, UserRole } from '../entities/user.entity';
import { CurrentUser } from '../auth/current-user.decorator';
import { StaffGuard } from './guards/staff.guard';
import { AdminService } from './admin.service';

/** Apply both guards on every protected route */
const StaffAuth = () => UseGuards(AuthGuard('jwt'), StaffGuard);

@Controller('admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly adminService: AdminService,
  ) {}

  // ─── One-time setup ────────────────────────────────────────────────────────

  /**
   * POST /admin/setup
   * Creates the first staff/owner account. Protected by ADMIN_SETUP_SECRET.
   * Refuses to run again once any staff user exists.
   */
  @Post('setup')
  async setup(@Body() dto: SetupAdminDto) {
    const configuredSecret = process.env.ADMIN_SETUP_SECRET;

    if (!configuredSecret) {
      throw new HttpException(
        'Admin setup is not enabled. Set ADMIN_SETUP_SECRET in the environment first.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (dto.setupSecret !== configuredSecret) {
      this.logger.warn('⛔ Invalid admin setup secret attempt');
      throw new HttpException('Invalid setup secret.', HttpStatus.FORBIDDEN);
    }

    const existing = await this.userRepo.findOne({
      where: { role: UserRole.STAFF },
    });
    if (existing) {
      throw new HttpException(
        'A platform admin account already exists. Use the standard login flow.',
        HttpStatus.CONFLICT,
      );
    }

    const emailTaken = await this.userRepo.findOne({ where: { email: dto.email } });
    if (emailTaken) {
      throw new HttpException('Email already registered.', HttpStatus.CONFLICT);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const admin = this.userRepo.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: UserRole.STAFF,
    } as any);
    const saved = await this.userRepo.save(admin as any);

    this.logger.log(`✅ Platform admin account created: ${dto.email}`);

    return {
      success: true,
      message: 'Platform admin account created. You can now log in with email/password.',
      data: {
        id: (saved as any).id,
        email: (saved as any).email,
        name: (saved as any).name,
        role: (saved as any).role,
      },
    };
  }

  // ─── Platform info ─────────────────────────────────────────────────────────

  /**
   * GET /admin/platform-info
   * Returns platform wallet addresses and fee configuration.
   */
  @Get('platform-info')
  @StaffAuth()
  platformInfo() {
    const ethReceiver = process.env.USDC_RECEIVER_ETH ?? 'not configured';
    const avaxReceiver = process.env.USDC_RECEIVER_AVAX ?? 'not configured';

    return {
      success: true,
      data: {
        platformFeeUsdc: 10,
        receiverAddresses: {
          ethereum: ethReceiver,
          avalanche: avaxReceiver,
        },
        note: 'These addresses receive the $10 USDC platform fee.',
      },
    };
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  /**
   * GET /admin/stats
   * Platform-wide overview counts.
   */
  @Get('stats')
  @StaffAuth()
  async stats() {
    const data = await this.adminService.getStats();
    return { success: true, data };
  }

  // ─── User management ───────────────────────────────────────────────────────

  /**
   * GET /admin/users?role=user|investor|staff&isActive=true&page=1&limit=20
   * Paginated list of all users with master-wallet presence flag.
   */
  @Get('users')
  @StaffAuth()
  async listUsers(
    @Query('role') role?: UserRole,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const result = await this.adminService.listUsers({
      role: role as UserRole | undefined,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });
    return { success: true, data: result };
  }

  /**
   * GET /admin/users/:id
   * Full user record including master wallet addresses, companies, and recent payments.
   */
  @Get('users/:id')
  @StaffAuth()
  async getUser(@Param('id') id: string) {
    const data = await this.adminService.getUserDetail(id);
    return { success: true, data };
  }

  /**
   * PATCH /admin/users/:id/role
   * Change a user's role (user / investor / staff).
   */
  @Patch('users/:id/role')
  @StaffAuth()
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() caller: any,
  ) {
    // Prevent staff from demoting themselves
    if (id === caller.sub && dto.role !== UserRole.STAFF) {
      throw new HttpException('You cannot change your own role.', HttpStatus.FORBIDDEN);
    }
    const data = await this.adminService.updateUserRole(id, dto.role);
    this.logger.log(`🔑 User ${id} role changed to ${dto.role} by ${caller.sub}`);
    return { success: true, data };
  }

  /**
   * PATCH /admin/users/:id/status
   * Activate or deactivate a user account.
   */
  @Patch('users/:id/status')
  @StaffAuth()
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() caller: any,
  ) {
    if (id === caller.sub) {
      throw new HttpException('You cannot deactivate your own account.', HttpStatus.FORBIDDEN);
    }
    const data = await this.adminService.setUserActive(id, dto.isActive);
    this.logger.log(`👤 User ${id} isActive=${dto.isActive} by ${caller.sub}`);
    return { success: true, data };
  }

  // ─── Master wallet listing ─────────────────────────────────────────────────

  /**
   * GET /admin/wallets?page=1&limit=20
   * All master wallets with their multi-chain addresses and owning user.
   */
  @Get('wallets')
  @StaffAuth()
  async listWallets(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const result = await this.adminService.listMasterWallets({
      page: parseInt(page, 10) || 1,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });
    return { success: true, data: result };
  }
}
