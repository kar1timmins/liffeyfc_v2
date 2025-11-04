import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SiweVerifyDto } from './dto/siwe-verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
}
