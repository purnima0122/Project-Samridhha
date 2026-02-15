import { Body, Controller, Get, Patch, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @UseGuards(AuthGuard)
  @Get()
  getSummary() {
    return this.dashboardService.getSummary();
  }

  @UseGuards(AuthGuard)
  @Get('me')
  getMyDashboard(@Req() req) {
    return this.dashboardService.getUserDashboard(req.userId);
  }

  @UseGuards(AuthGuard)
  @Patch('settings')
  updateSettings(@Req() req, @Body('spikeAlertsEnabled') spikeAlertsEnabled: boolean) {
    return this.dashboardService.updateSettings(req.userId, spikeAlertsEnabled);
  }
}
