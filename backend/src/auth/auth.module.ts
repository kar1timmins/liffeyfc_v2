import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SecurityMonitoringService } from './security-monitoring.service';
import { UsersModule } from '../users/users.module';
import { Web3Module } from '../web3/web3.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';
import { GoogleStrategy } from './google.strategy';

@Module({
  imports: [UsersModule, Web3Module, TypeOrmModule.forFeature([RefreshToken]), PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AuthService, JwtStrategy, GoogleStrategy, SecurityMonitoringService],
  controllers: [AuthController],
  exports: [AuthService, SecurityMonitoringService],
})
export class AuthModule {}
