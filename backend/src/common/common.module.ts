import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GcpStorageService } from './gcp-storage.service';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule],
  providers: [GcpStorageService, EmailService],
  exports: [GcpStorageService, EmailService],
})
export class CommonModule {}
