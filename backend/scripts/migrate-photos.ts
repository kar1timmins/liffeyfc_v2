import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { UsersService } from '../src/users/users.service';
import { GcpStorageService } from '../src/common/gcp-storage.service';
import * as fs from 'fs';
import * as path from 'path';

async function migratePhotos() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const gcpStorageService = app.get(GcpStorageService);

  console.log('Starting photo migration to GCP...');

  try {
    // Get all users with local profile photos
    const users = await usersService.findUsersWithLocalPhotos();

    for (const user of users) {
      if (user.profilePhotoUrl && user.profilePhotoUrl.startsWith('/uploads/avatars/')) {
        const filename = path.basename(user.profilePhotoUrl);
        const filePath = path.join(__dirname, '../uploads/avatars', filename);

        if (fs.existsSync(filePath)) {
          console.log(`Migrating photo for user ${user.id}: ${filename}`);

          // Read file
          const fileBuffer = fs.readFileSync(filePath);
          const file = {
            buffer: fileBuffer,
            originalname: filename,
            mimetype: 'image/' + path.extname(filename).slice(1),
          } as Express.Multer.File;

          // Upload to GCP
          await gcpStorageService.uploadFile(file, `avatars/${filename}`);

          // Generate signed URL
          const signedUrl = await gcpStorageService.generateSignedUrl(`avatars/${filename}`);

          // Update user
          await usersService.updateProfilePhoto(user.id, signedUrl);

          console.log(`Migrated ${filename} for user ${user.id}`);
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await app.close();
  }
}

migratePhotos();