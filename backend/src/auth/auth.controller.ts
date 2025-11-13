import { Body, Controller, Get, Param, Post, UseGuards, Req, Res, HttpException, HttpStatus, Ip } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { SecurityMonitoringService, SecurityEventType } from './security-monitoring.service';
import { TokenCleanupService } from './token-cleanup.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SiweVerifyDto } from './dto/siwe-verify.dto';
import { AuthGuard } from '@nestjs/passport';
import { CookieSecurityConfig } from '../config/cookie-security.config';
import type { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  // inject UsersService to resolve the current user for /me
  constructor(
    private authService: AuthService, 
    private usersService: UsersService,
    private securityMonitoring: SecurityMonitoringService,
    private tokenCleanupService: TokenCleanupService,
  ) {
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.securityMonitoring.cleanupOldEntries();
    }, 10 * 60 * 1000);
  }

  /**
   * Temporary storage for OAuth tokens (one-time use codes)
   * Key: random code, Value: { accessToken, expiresAt }
   * In production, use Redis for multi-instance deployments
   */
  private oauthTokenExchange = new Map<string, { accessToken: string; expiresAt: number }>();

  /**
   * Helper method to set refresh token as httpOnly cookie
   * Uses centralized cookie security configuration
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const config = CookieSecurityConfig.refreshToken;
    res.cookie(config.name, refreshToken, {
      httpOnly: config.httpOnly,
      secure: config.secure,
      sameSite: config.sameSite,
      maxAge: config.maxAge,
      path: config.path,
      domain: config.domain,
    });
  }

  /**
   * Helper method to clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', { path: '/auth' });
  }

  /**
   * Generate a one-time code for OAuth token exchange
   */
  private generateOAuthCode(accessToken: string): string {
    const crypto = require('crypto');
    const code = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 60000; // 60 seconds expiry
    this.oauthTokenExchange.set(code, { accessToken, expiresAt });
    
    // Clean up expired codes (simple cleanup on each generation)
    for (const [key, value] of this.oauthTokenExchange.entries()) {
      if (value.expiresAt < Date.now()) {
        this.oauthTokenExchange.delete(key);
      }
    }
    
    return code;
  }

  /**
   * Exchange one-time code for access token (used by OAuth callback)
   */
  private consumeOAuthCode(code: string): string | null {
    const entry = this.oauthTokenExchange.get(code);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.oauthTokenExchange.delete(code);
      return null;
    }
    // One-time use: delete after consuming
    this.oauthTokenExchange.delete(code);
    return entry.accessToken;
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 registrations per hour
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response, @Ip() ip: string, @Req() req: Request) {
    try {
      const result = await this.authService.register(body.email, body.password, body.name);
      // Set refresh token in httpOnly cookie
      this.setRefreshTokenCookie(res, result.refreshToken);
      
      // Log successful registration
      this.securityMonitoring.logEvent({
        type: SecurityEventType.REGISTRATION_SUCCESS,
        userId: result.user.id,
        email: body.email,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      });
      
      // Return user and access token (not refresh token)
      return { success: true, data: { user: result.user, accessToken: result.accessToken } };
    } catch (error) {
      // Log failed registration
      this.securityMonitoring.logEvent({
        type: SecurityEventType.REGISTRATION_FAILED,
        email: body.email,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: error.message },
      });
      throw error;
    }
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response, @Ip() ip: string, @Req() req: Request) {
    // Check if account is locked
    if (this.securityMonitoring.isAccountLocked(body.email)) {
      const remaining = this.securityMonitoring.getLockoutRemaining(body.email);
      this.securityMonitoring.logEvent({
        type: SecurityEventType.ACCOUNT_LOCKED,
        email: body.email,
        ip,
        timestamp: new Date(),
        details: { remainingSeconds: remaining },
      });
      throw new HttpException(
        {
          success: false,
          message: `Account temporarily locked due to multiple failed login attempts. Try again in ${Math.ceil(remaining / 60)} minutes.`,
          remainingSeconds: remaining,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    try {
      const result = await this.authService.login(body.email, body.password);
      // Set refresh token in httpOnly cookie
      this.setRefreshTokenCookie(res, result.refreshToken);
      
      // Reset failed attempts on successful login
      this.securityMonitoring.resetFailedAttempts(body.email);
      this.securityMonitoring.resetFailedAttempts(ip);
      
      // Log successful login
      this.securityMonitoring.logEvent({
        type: SecurityEventType.LOGIN_SUCCESS,
        userId: result.user.id,
        email: body.email,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
      });
      
      // Return user and access token (not refresh token)
      return { success: true, data: { user: result.user, accessToken: result.accessToken } };
    } catch (error) {
      // Record failed login attempt
      const shouldLock = this.securityMonitoring.recordFailedLogin(body.email);
      this.securityMonitoring.recordFailedLogin(ip);
      
      // Log failed login
      this.securityMonitoring.logEvent({
        type: SecurityEventType.LOGIN_FAILED,
        email: body.email,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: {
          error: error.message,
          attemptCount: this.securityMonitoring.getFailedAttemptCount(body.email),
          locked: shouldLock,
        },
      });
      
      throw new HttpException(
        {
          success: false,
          message: 'Invalid email or password',
          attemptsRemaining: shouldLock ? 0 : (5 - this.securityMonitoring.getFailedAttemptCount(body.email)),
        },
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  @Get('siwe/message/:address')
  @SkipThrottle() // Message generation is cheap, no need to throttle
  async siweMessage(@Param('address') address: string) {
    const { message } = await this.authService.getSiweMessage(address);
    return { success: true, data: { message } };
  }

  @Post('siwe/verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 SIWE attempts per minute
  async siweVerify(@Body() body: SiweVerifyDto, @Res({ passthrough: true }) res: Response, @Ip() ip: string, @Req() req: Request) {
    try {
      const result = await this.authService.verifySiwe(body.address, body.signature);
      
      // Log successful SIWE login
      this.securityMonitoring.logEvent({
        type: SecurityEventType.LOGIN_SUCCESS,
        userId: result.user.id,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { method: 'SIWE', address: body.address },
      });
      
      // SIWE currently returns { user, token } without refresh token
      // For consistency with other auth methods, we should generate a refresh token
      // For now, just return the token (JWT access token)
      return { success: true, data: { user: result.user, accessToken: result.token } };
    } catch (error) {
      // Log failed SIWE attempt
      this.securityMonitoring.logEvent({
        type: SecurityEventType.SIWE_FAILED,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: error.message, address: body.address },
      });
      throw error;
    }
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  @SkipThrottle() // OAuth provider handles rate limiting
  async googleAuth(@Req() req) {
    // The Google strategy will redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 OAuth callbacks per minute
  async googleAuthRedirect(@Req() req, @Res() res: Response, @Ip() ip: string) {
    try {
      const { accessToken, refreshToken } = req.user;
      
      if (!accessToken || !refreshToken) {
        throw new Error('Missing tokens from OAuth provider');
      }
      
      // Set refresh token in httpOnly cookie
      this.setRefreshTokenCookie(res, refreshToken);
      
      // Generate one-time code for access token exchange (valid for 60 seconds)
      const code = this.generateOAuthCode(accessToken);
      
      // Get frontend URL with fallback
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.liffeyfoundersclub.com';
      
      // Redirect with only the one-time code (no tokens in URL)
      res.redirect(
        `${frontendUrl}/login/callback?code=${code}`,
      );
    } catch (error) {
      console.error('❌ Google OAuth callback error:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'https://www.liffeyfoundersclub.com';
      res.redirect(`${frontendUrl}/auth?error=oauth_failed`);
    }
  }

  /**
   * Exchange OAuth one-time code for access token
   * Called by frontend after OAuth redirect
   */
  @Post('oauth/exchange')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 exchanges per minute
  async exchangeOAuthCode(@Body('code') code: string, @Ip() ip: string, @Req() req: Request) {
    if (!code) {
      this.securityMonitoring.logEvent({
        type: SecurityEventType.OAUTH_FAILED,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: 'No code provided' },
      });
      throw new HttpException('No code provided', HttpStatus.BAD_REQUEST);
    }
    
    const accessToken = this.consumeOAuthCode(code);
    if (!accessToken) {
      this.securityMonitoring.logEvent({
        type: SecurityEventType.OAUTH_FAILED,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: 'Invalid or expired code' },
      });
      throw new HttpException('Invalid or expired code', HttpStatus.UNAUTHORIZED);
    }
    
    return { success: true, data: { accessToken } };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refreshes per minute
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Ip() ip: string) {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      this.securityMonitoring.logEvent({
        type: SecurityEventType.REFRESH_TOKEN_INVALID,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: 'No refresh token provided' },
      });
      throw new HttpException('No refresh token provided', HttpStatus.UNAUTHORIZED);
    }
    
    try {
      const result = await this.authService.refresh(refreshToken);
      // Set new refresh token in cookie (token rotation)
      this.setRefreshTokenCookie(res, result.refreshToken);
      // Return new access token
      return { success: true, data: { accessToken: result.accessToken } };
    } catch (error) {
      // Log failed refresh attempt (could indicate token reuse)
      this.securityMonitoring.logEvent({
        type: SecurityEventType.REFRESH_TOKEN_INVALID,
        ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        details: { error: error.message },
      });
      throw new HttpException('Invalid refresh token', HttpStatus.UNAUTHORIZED);
    }
  }

  @Post('logout')
  @SkipThrottle() // Allow unlimited logout requests
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // Revoke the refresh token in the database
      await this.authService.logout?.(refreshToken);
    }
    // Clear the refresh token cookie
    this.clearRefreshTokenCookie(res);
    return { success: true, data: { message: 'Logged out successfully' } };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle() // Authenticated requests, no need for strict rate limiting
  async me(@Req() req) {
    // JwtAuthGuard attaches payload to req.user with { sub: userId, userType }
    const userId = req.user?.sub;
    const userType = req.user?.userType || 'user';
    
    if (!userId) return { success: false, data: null };
    
    // Query unified users table (single table with roles)
    const user = await this.usersService.findById(userId);
    
    if (!user) {
      return { 
        success: false, 
        data: null, 
        message: 'User not found. Your account may have been upgraded. Please log in again.' 
      };
    }
    
    // Remove sensitive data
    const { passwordHash, ...userData } = user;
    
    // Add userType to the response (from user.role for consistency)
    return { success: true, data: { ...userData, userType: user.role } };
  }

  /**
   * Manually trigger token cleanup
   * Useful for testing or emergency cleanup
   * 
   * In production, consider protecting this with admin authentication
   */
  @Post('admin/cleanup-tokens')
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute
  async cleanupTokens() {
    const result = await this.tokenCleanupService.cleanupTokens();
    return {
      success: true,
      data: {
        message: 'Token cleanup completed',
        deletedExpired: result.deletedExpired,
        deletedRevoked: result.deletedRevoked,
        total: result.deletedExpired + result.deletedRevoked,
      },
    };
  }

  /**
   * Get token statistics
   * Useful for monitoring token accumulation
   * 
   * In production, consider protecting this with admin authentication
   */
  @Get('admin/token-stats')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async getTokenStats() {
    const stats = await this.tokenCleanupService.getTokenStats();
    return {
      success: true,
      data: stats,
    };
  }
}

