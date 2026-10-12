import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { LoginDto } from './auth.dto';
import { AuthContext, Public } from './auth.guard';
import { AuthService } from './auth.service';

type Req_ = { auth: AuthContext; ip?: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: { ip?: string }) {
    return this.auth.login(dto.username, dto.password, dto.deviceName ?? 'unknown', req.ip);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Req_) {
    await this.auth.logout(req.auth, req.ip);
  }

  @Get('me')
  me(@Req() req: Req_) {
    return this.auth.me(req.auth);
  }
}
