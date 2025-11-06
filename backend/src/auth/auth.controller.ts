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
   * Helper method to set refresh token as httpOnly cookie
   */
  private setRefreshTokenCookie(res: Response, refreshToken: string) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction, // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000, // 1 day in milliseconds
      path: '/auth', // Only send cookie to auth routes
    });
  }

  /**
   * Helper method to clear refresh token cookie
   */
  private clearRefreshTokenCookie(res: Response) {
    res.clearCookie('refreshToken', { path: '/auth' });
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
    // Redirect with only access token in URL (temporary, until frontend uses cookie-based refresh)
    // TODO: Eventually remove accessToken from URL once frontend stores it in memory only
    res.redirect(
      `${process.env.FRONTEND_URL}/login/callback?accessToken=${accessToken}`,
    );
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
