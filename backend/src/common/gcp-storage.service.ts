import { Injectable, Logger } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GcpStorageService {
  private storage: Storage;
  private bucketName: string;
  private readonly logger = new Logger(GcpStorageService.name);
  private isConfigured: boolean = false;

  constructor(private configService: ConfigService) {
    try {
      const projectId = this.configService.get<string>('GCP_PROJECT_ID');
      const keyFilename = this.configService.get<string>('GCP_KEY_FILE_PATH') || 
                          this.configService.get<string>('GCP_KEY_FILENAME');
      const credentialsJson = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS_JSON');
      const bucketName = this.configService.get<string>('GCP_BUCKET_NAME');

      if (!bucketName) {
        this.logger.warn('GCP_BUCKET_NAME not configured. File uploads will fail.');
        this.isConfigured = false;
        return;
      }

      this.bucketName = bucketName;

      // Priority: JSON credentials > key file > Application Default Credentials
      if (credentialsJson) {
        try {
          const credentials = JSON.parse(credentialsJson);
          this.logger.log('Using JSON credentials from environment variable');
          this.storage = new Storage({
            projectId: credentials.project_id || projectId,
            credentials,
          });
        } catch (parseError) {
          this.logger.error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON:', parseError);
          throw parseError;
        }
      } else if (keyFilename) {
        this.logger.log(`Using key file: ${keyFilename}`);
        this.storage = new Storage({
          projectId,
          keyFilename,
        });
      } else {
        this.logger.log('Using Application Default Credentials (ADC) for GCP Storage');
        this.storage = new Storage({ projectId });
      }

      this.isConfigured = true;
      this.logger.log(`GCP Storage initialized for bucket: ${this.bucketName}`);
    } catch (error) {
      this.logger.error('Failed to initialize GCP Storage:', error);
      this.isConfigured = false;
    }
  }

  async uploadFile(file: Express.Multer.File, filename: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('GCP Storage is not configured. Please check environment variables.');
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const fileUpload = bucket.file(filename);

      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
        resumable: false, // Faster for small files
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          this.logger.error(`Failed to upload ${filename}:`, error);
          reject(error);
        });
        stream.on('finish', () => {
          this.logger.log(`Successfully uploaded ${filename}`);
          resolve(`Uploaded ${filename}`);
        });
        stream.end(file.buffer);
      });
    } catch (error) {
      this.logger.error(`Upload error for ${filename}:`, error);
      throw error;
    }
  }

  async deleteFile(filename: string): Promise<void> {
    if (!this.isConfigured) {
      this.logger.warn('GCP Storage not configured, skipping file deletion');
      return;
    }

    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(filename);

    try {
      await file.delete();
      this.logger.log(`Deleted file: ${filename}`);
    } catch (error) {
      // If file doesn't exist, that's fine - don't throw error
      if (error.code === 404) {
        this.logger.debug(`File not found (already deleted): ${filename}`);
      } else {
        this.logger.error(`Failed to delete ${filename}:`, error);
        throw error;
      }
    }
  }

  async generateSignedUrl(filename: string, expiresIn: number = 7 * 24 * 60 * 60 * 1000): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('GCP Storage is not configured. Cannot generate signed URL.');
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filename);

      const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn, // Default 7 days (GCP maximum)
      });

      this.logger.debug(`Generated signed URL for: ${filename}`);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate signed URL for ${filename}:`, error);
      throw error;
    }
  }
}