import { Body, Controller, Get, Param, Post, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { signJwt } from '../auth/jwt.util';

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

  @Patch('upgrade-to-investor')
  @UseGuards(AuthGuard('jwt'))
  async upgradeToInvestor(
    @Body() body: { 
      investorCompany: string; 
      investmentFocus: string; 
      linkedinUrl?: string;
      isAccredited?: boolean;
    },
    @CurrentUser() currentUser: any
  ) {
    const userId = currentUser?.sub;
    if (!userId) {
      return { success: false, message: 'Unauthorized' };
    }

    try {
      // Upgrade the user to investor role
      const updatedUser = await this.usersService.upgradeToInvestor(userId, body);
      
      if (!updatedUser) {
        return { success: false, message: 'User not found' };
      }
      
      // Generate new JWT with investor role
      const newToken = signJwt(updatedUser.id, updatedUser.role);
      
      return { 
        success: true, 
        data: { 
          user: updatedUser,
          accessToken: newToken 
        } 
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'Failed to upgrade to investor' 
      };
    }
  }
}
