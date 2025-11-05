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

  @Post('register')
  async register(@Body() body: RegisterDto) {
    const res = await this.authService.register(body.email, body.password, body.name);
    return { success: true, data: res };
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const res = await this.authService.login(body.email, body.password);
    return { success: true, data: res };
  }

  @Get('siwe/message/:address')
  async siweMessage(@Param('address') address: string) {
    const { message } = await this.authService.getSiweMessage(address);
    return { success: true, data: { message } };
  }

  @Post('siwe/verify')
  async siweVerify(@Body() body: SiweVerifyDto) {
    const res = await this.authService.verifySiwe(body.address, body.signature);
    return { success: true, data: res };
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
    // You might want to redirect to a specific frontend route with tokens
    // For example, redirecting with tokens in query params
    res.redirect(
      `${process.env.FRONTEND_URL}/login/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`,
    );
  }

  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string) {
    const res = await this.authService.refresh(refreshToken);
    return { success: true, data: res };
  }

  @Post('logout')
  async logout(@Body('refreshToken') refreshToken: string) {
    // simple logout: remove refresh token(s) matching provided token
    const res = await this.authService.logout?.(refreshToken);
    return { success: true, data: res };
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
