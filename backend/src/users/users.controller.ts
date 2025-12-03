import { Body, Controller, Get, Param, Post, Patch, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../auth/current-user.decorator';
import { signJwt } from '../auth/jwt.util';
import { GcpStorageService } from '../common/gcp-storage.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly gcpStorageService: GcpStorageService,
  ) {}

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
    
    // Generate fresh signed URL for profile photo if it exists
    if (user && user.profilePhotoUrl && !user.profilePhotoUrl.startsWith('http')) {
      try {
        const freshUrl = await this.gcpStorageService.generateSignedUrl(user.profilePhotoUrl);
        user.profilePhotoUrl = freshUrl;
      } catch (error) {
        console.error('Failed to generate fresh signed URL:', error);
        // Keep the existing URL if regeneration fails
      }
    }
    
    return { success: !!user, data: user };
  }

  @Post('upload-avatar')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (req, file, cb) => {
      // Validate file type
      const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Only JPEG, PNG, and WebP images are allowed.`), false);
      }
    },
  }))
  async uploadAvatar(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
        ],
      }),
    ) file: Express.Multer.File,
    @CurrentUser() currentUser: any,
  ) {
    if (!currentUser) {
      return { success: false, message: 'Unauthorized' };
    }

    try {
      // Get current user to check for existing photo
      const currentUserData = await this.usersService.findById(currentUser.sub);
      if (!currentUserData) {
        return { success: false, message: 'User not found' };
      }

      // Delete old photo from GCP if it exists and is a file path (not signed URL)
      if (currentUserData.profilePhotoUrl && !currentUserData.profilePhotoUrl.startsWith('http')) {
        await this.gcpStorageService.deleteFile(currentUserData.profilePhotoUrl);
      }

      // Generate unique filename
      const randomName = uuidv4();
      const filename = `${randomName}${extname(file.originalname)}`;

      // Upload to GCP
      await this.gcpStorageService.uploadFile(file, `profiles_users/avatars/${filename}`);

      // Store the file path (not signed URL) in database
      const filePath = `profiles_users/avatars/${filename}`;
      
      // Generate signed URL for immediate response
      const photoUrl = await this.gcpStorageService.generateSignedUrl(filePath);

      // Update user profile with file path
      const updatedUser = await this.usersService.updateProfilePhoto(currentUser.sub, filePath);
      
      if (!updatedUser) {
        throw new Error('Failed to update user profile');
      }
      
      // Return fresh signed URL to user
      updatedUser.profilePhotoUrl = photoUrl;

      return {
        success: true,
        data: {
          profilePhotoUrl: photoUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to upload avatar',
      };
    }
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
