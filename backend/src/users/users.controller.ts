import { Body, Controller, Get, Param, Post, Patch, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
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

  @Post('upload-avatar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const randomName = uuidv4();
        cb(null, `${randomName}${extname(file.originalname)}`);
      },
    }),
  }))
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    ) file: Express.Multer.File,
    @CurrentUser() currentUser: any,
  ) {
    if (!currentUser) {
      return { success: false, message: 'Unauthorized' };
    }
    
    // Construct the URL (assuming static serving is set up at /uploads)
    const photoUrl = `/uploads/avatars/${file.filename}`;
    
    const updatedUser = await this.usersService.updateProfilePhoto(currentUser.sub, photoUrl);
    
    return {
      success: true,
      data: {
        user: updatedUser,
        photoUrl,
      },
    };
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
