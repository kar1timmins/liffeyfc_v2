import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() body: CreateUserDto) {
    const existing = body.email ? await this.usersService.findByEmail(body.email) : null;
    if (existing) return { success: false, message: 'Email already registered' };
    const created = await this.usersService.create({ email: body.email, name: body.name, passwordHash: body.password });
    return { success: true, data: created };
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async get(@Param('id') id: string, @CurrentUser() currentUser: any) {
    // simple protection: allow request only if token subject matches the requested id
    if (!currentUser || currentUser.sub !== id) {
      return { success: false, message: 'Unauthorized' };
    }
    const user = await this.usersService.findById(id);
    return { success: !!user, data: user };
  }
}
