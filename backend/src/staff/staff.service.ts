import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from '../entities/staff.entity';
import { CreateStaffDto } from './dto/create-staff.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(Staff)
    private staffRepository: Repository<Staff>,
  ) {}

  /**
   * Create a new staff member
   * This should be restricted to admin users only
   */
  async create(createStaffDto: CreateStaffDto): Promise<Staff> {
    const { email, password, ...rest } = createStaffDto;

    // Check if staff member already exists
    const existing = await this.staffRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Staff member with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const staff = this.staffRepository.create({
      email,
      passwordHash,
      role: rest.role || 'staff',
      isActive: rest.isActive !== undefined ? rest.isActive : true,
      ...rest,
    });

    return this.staffRepository.save(staff);
  }

  /**
   * Find staff member by ID
   */
  async findById(id: string): Promise<Staff | null> {
    return this.staffRepository.findOne({
      where: { id },
    });
  }

  /**
   * Find staff member by email
   */
  async findByEmail(email: string): Promise<Staff | null> {
    return this.staffRepository.findOne({
      where: { email },
    });
  }

  /**
   * Find all staff members
   * This should be restricted to admin users only
   */
  async findAll(): Promise<Staff[]> {
    return this.staffRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Update staff member
   */
  async update(id: string, updateData: Partial<Staff>): Promise<Staff> {
    const staff = await this.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    Object.assign(staff, updateData);
    return this.staffRepository.save(staff);
  }

  /**
   * Deactivate staff member (soft delete)
   */
  async deactivate(id: string): Promise<Staff> {
    const staff = await this.findById(id);
    if (!staff) {
      throw new NotFoundException('Staff member not found');
    }

    staff.isActive = false;
    return this.staffRepository.save(staff);
  }

  /**
   * Delete staff member (hard delete)
   */
  async remove(id: string): Promise<void> {
    await this.staffRepository.delete(id);
  }
}
