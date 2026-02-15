import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(AuthGuard)
  @Get('me')
  getMe(@Req() req) {
    return this.usersService.getMe(req.userId);
  }

  @UseGuards(AuthGuard)
  @Put('me')
  updateMe(
    @Req() req,
    @Body()
    body: { name?: string; number?: string; address?: string; wardNo?: string },
  ) {
    return this.usersService.updateMe(req.userId, body);
  }
}
