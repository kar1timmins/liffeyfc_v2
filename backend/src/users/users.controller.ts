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
    const user = await this.usersService.findById(id);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Generate fresh signed URL for profile photo if it exists
    if (user.profilePhotoUrl && !user.profilePhotoUrl.startsWith('http')) {
      try {
        const freshUrl = await this.gcpStorageService.generateSignedUrl(user.profilePhotoUrl);
        user.profilePhotoUrl = freshUrl;
      } catch (error) {
        console.error('Failed to generate fresh signed URL:', error);
        // Keep the existing URL if regeneration fails
      }
    }

    // If user is requesting their own profile, return full data
    if (currentUser && currentUser.sub === id) {
      const fullProfile = this.usersService.getFullProfile(user);
      return { success: true, data: fullProfile };
    }

    // Otherwise, return sanitized public data only
    const sanitized = this.usersService.sanitizeUser(user);
    return { success: true, data: sanitized };
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

      // Delete old photo from GCP if it exists
      if (currentUserData.profilePhotoUrl) {
        try {
          // Extract the file path from either signed URL or direct path
          let oldFilePath = currentUserData.profilePhotoUrl;
          
          // If it's a signed URL, extract the path from the URL
          if (oldFilePath.startsWith('http')) {
            const url = new URL(oldFilePath);
            // GCS signed URLs have the path after the bucket name
            const pathMatch = url.pathname.match(/\/[^\/]+\/(.*?)(\?|$)/);
            if (pathMatch) {
              oldFilePath = decodeURIComponent(pathMatch[1]);
            }
          }
          
          await this.gcpStorageService.deleteFile(oldFilePath);
        } catch (deleteError) {
          // Log but don't fail upload if deletion fails
          console.error('Failed to delete old photo:', deleteError);
        }
      }

      // Generate unique filename with user-specific folder
      const userId = currentUser.sub;
      const randomName = uuidv4();
      const filename = `${randomName}${extname(file.originalname)}`;
      const filePath = `avatars/${userId}/${filename}`;

      // Upload to GCP with user-specific path
      await this.gcpStorageService.uploadFile(file, filePath);
      
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

  @Post('attach-wallet')
  @UseGuards(AuthGuard('jwt'))
  async attachWallet(
    @Body() body: { address: string; chainId?: string },
    @CurrentUser() currentUser: any
  ) {
    const userId = currentUser?.sub;
    if (!userId) {
      return { success: false, message: 'Unauthorized' };
    }

    try {
      const updatedUser = await this.usersService.attachWallet(userId, body.address, body.chainId);
      
      if (!updatedUser) {
        return { success: false, message: 'User not found' };
      }
      
      return { 
        success: true, 
        data: updatedUser
      };
    } catch (error) {
      return { 
        success: false, 
        message: error.message || 'Failed to attach wallet' 
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
