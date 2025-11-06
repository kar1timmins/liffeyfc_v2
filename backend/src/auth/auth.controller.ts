import { Body, Controller, Get, Param, Post, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SiweVerifyDto } from './dto/siwe-verify.dto';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

@Controller('auth')
export class AuthController {
  // inject UsersService to resolve the current user for /me
  constructor(private authService: AuthService, private usersService: UsersService) {}

  /**
   * Temporary storage for OAuth tokens (one-time use codes)
   * Key: random code, Value: { accessToken, expiresAt }
   * In production, use Redis for multi-instance deployments
   */
  private oauthTokenExchange = new Map<string, { accessToken: string; expiresAt: number }>();

  /**
   * Helper method to set refresh token as httpOnly cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
      path: '/auth', // Only send cookie to auth routes
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
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(body.email, body.password, body.name);
    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);
    // Return user and access token (not refresh token)
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(body.email, body.password);
    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, result.refreshToken);
    // Return user and access token (not refresh token)
    return { success: true, data: { user: result.user, accessToken: result.accessToken } };
  }

  @Get('siwe/message/:address')
  async siweMessage(@Param('address') address: string) {
    const { message } = await this.authService.getSiweMessage(address);
    return { success: true, data: { message } };
  }

  @Post('siwe/verify')
  async siweVerify(@Body() body: SiweVerifyDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.verifySiwe(body.address, body.signature);
    // SIWE currently returns { user, token } without refresh token
    // For consistency with other auth methods, we should generate a refresh token
    // For now, just return the token (JWT access token)
    return { success: true, data: { user: result.user, accessToken: result.token } };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req) {
    // The Google strategy will redirect
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req, @Res() res: Response) {
    const { accessToken, refreshToken } = req.user;
    // Set refresh token in httpOnly cookie
    this.setRefreshTokenCookie(res, refreshToken);
    // Generate one-time code for access token exchange (valid for 60 seconds)
    const code = this.generateOAuthCode(accessToken);
    // Redirect with only the one-time code (no tokens in URL)
    res.redirect(
      `${process.env.FRONTEND_URL}/login/callback?code=${code}`,
    );
  }

  /**
   * Exchange OAuth one-time code for access token
   * Called by frontend after OAuth redirect
   */
  @Post('oauth/exchange')
  async exchangeOAuthCode(@Body('code') code: string) {
    if (!code) {
      throw new Error('No code provided');
    }
    const accessToken = this.consumeOAuthCode(code);
    if (!accessToken) {
      throw new Error('Invalid or expired code');
    }
    return { success: true, data: { accessToken } };
  }

  @Post('refresh')
  async refresh(@Req() req, @Res({ passthrough: true }) res: Response) {
    // Read refresh token from httpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new Error('No refresh token provided');
    }
    const result = await this.authService.refresh(refreshToken);
    // Set new refresh token in cookie (token rotation)
    this.setRefreshTokenCookie(res, result.refreshToken);
    // Return new access token
    return { success: true, data: { accessToken: result.accessToken } };
  }

  @Post('logout')
  async logout(@Req() req, @Res({ passthrough: true }) res: Response) {
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
  async me(@Req() req) {
    // JwtAuthGuard attaches payload to req.user with { sub: userId }
    const userId = req.user?.sub;
    if (!userId) return { success: false, data: null };
    const user = await this.usersService.findById(userId);
    return { success: true, data: user };
  }
}
