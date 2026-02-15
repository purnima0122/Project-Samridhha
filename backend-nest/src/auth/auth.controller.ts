import { Body, Controller, Get, Post, Put, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { signupDto } from './dtos/signup.dto';
import { loginDto } from './dtos/login.dto';
import { RefreshToken } from './schemas/refresh.token.schema';
import { RefreshTokenDto } from './dtos/refresh-tokens.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { AuthGuard as JwtAuthGuard } from 'src/guards/auth.guard';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { decodeRedirectState, isAllowedRedirect } from './utils/redirects';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService:AuthService){}

  
  //post signup
  @Post('signup')//api endpoint: auth/signup
  async signUp(@Body() signupData: signupDto) {
    return this.authService.signup(signupData)
  }

  //post logout
  @Post('login')
  async login(@Body() credentials: loginDto)
  {
    return this.authService.login(credentials)
  }

  //refresh
  @Post('refresh')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto){
    return this.authService.refreshTokens(refreshTokenDto.refreshToken)
  }

  //POST change password
  //we need this protected
  @UseGuards(JwtAuthGuard)
  @Put('change-password')
  async changePassword(@Body()changePasswordDto: ChangePasswordDto, @Req() req,){
    return this.authService.changePassword(
      req.userId,
      changePasswordDto.oldPassword,changePasswordDto.newPassword);
  }

  //POST forgot password
  @Post('forgot-password')
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto)
  {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  //  Redirect user to Google
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth() {
    // Google handles this
  }

  // Google redirects back here
  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Req() req, @Res() res: Response) {
    const tokens = await this.authService.loginWithGoogle(req.user);
    const stateValue = typeof req.query?.state === 'string' ? req.query.state : null;
    const redirectFromState = decodeRedirectState(stateValue);
    const redirectBase =
      isAllowedRedirect(redirectFromState) ?? process.env.MOBILE_REDIRECT_URI;

    if (redirectBase) {
      const redirectUrl = new URL(redirectBase);
      redirectUrl.searchParams.set('accessToken', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.RefreshToken);
      redirectUrl.searchParams.set('userId', String(tokens.userId));
      if (req.user?.email) {
        redirectUrl.searchParams.set('email', req.user.email);
      }
      if (req.user?.name) {
        redirectUrl.searchParams.set('name', req.user.name);
      }
      return res.redirect(redirectUrl.toString());
    }

    return res.json(tokens);
  }

  //Reset Password
  @Put('reset-password')
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto,
  ){
    return this.authService.resetPassword(
      resetPasswordDto.newPassword,
      resetPasswordDto.resetToken,
    )
  }
  
}
