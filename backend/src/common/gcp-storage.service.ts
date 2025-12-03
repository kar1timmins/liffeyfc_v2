import { Injectable } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GcpStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const projectId = this.configService.get<string>('GCP_PROJECT_ID');
    const keyFilename = this.configService.get<string>('GCP_KEY_FILE_PATH');

    this.storage = new Storage({
      projectId,
      keyFilename: keyFilename || undefined, // Use ADC if not provided
    });

    const bucketName = this.configService.get<string>('GCP_BUCKET_NAME');
    if (!bucketName) {
      throw new Error('GCP_BUCKET_NAME is required');
    }
    this.bucketName = bucketName;
  }

  async uploadFile(file: Express.Multer.File, filename: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const fileUpload = bucket.file(filename);

    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    });

    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', () => {
        resolve(`Uploaded ${filename}`);
      });
      stream.end(file.buffer);
    });
  }

  async deleteFile(filename: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filename);

    try {
      await file.delete();
    } catch (error) {
      // If file doesn't exist, that's fine - don't throw error
      if (error.code !== 404) {
        throw error;
      }
    }
  }

  async generateSignedUrl(filename: string, expiresIn: number = 7 * 24 * 60 * 60 * 1000): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filename);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn, // Default 7 days (GCP maximum)
    });

    return url;
  }
}