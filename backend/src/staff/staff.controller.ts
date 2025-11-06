import { Controller, Get, Post, Body, Param, Patch, UseGuards } from '@nestjs/common';
import { StaffService } from './staff.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  /**
   * Create a new staff member
   * TODO: Add admin-only guard
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async create(@Body() createStaffDto: CreateStaffDto) {
    const staff = await this.staffService.create(createStaffDto);
    // Remove password hash from response
    const { passwordHash, ...result } = staff;
    return {
      success: true,
      data: { staff: result },
    };
  }

  /**
   * Get all staff members
   * TODO: Add admin-only guard
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    const staff = await this.staffService.findAll();
    const results = staff.map(({ passwordHash, ...rest }) => rest);
    return { success: true, data: results };
  }

  /**
   * Get staff member by ID
   * TODO: Add admin-only or self-access guard
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    const staff = await this.staffService.findById(id);
    if (!staff) {
      return { success: false, data: null };
    }
    const { passwordHash, ...result } = staff;
    return { success: true, data: result };
  }

  /**
   * Deactivate staff member
   * TODO: Add admin-only guard
   */
  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  async deactivate(@Param('id') id: string) {
    const staff = await this.staffService.deactivate(id);
    const { passwordHash, ...result } = staff;
    return { success: true, data: result };
  }
}
