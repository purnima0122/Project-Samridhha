import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { StockAlertsService } from './stock-alerts.service';

@UseGuards(AuthGuard, AdminGuard)
@Controller('alerts')
export class StockAlertsController {
  constructor(private readonly stockAlertsService: StockAlertsService) {}

  @Get()
  findAll(@Req() req) {
    return this.stockAlertsService.findAll(req.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.stockAlertsService.findOne(req.userId, id);
  }

  @Post()
  create(
    @Req() req,
    @Body()
    body: {
      symbol: string;
      type: string;
      price: string;
      units: string;
      status?: string;
    },
  ) {
    return this.stockAlertsService.create(req.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      symbol: string;
      type: string;
      price: string;
      units: string;
      status: string;
    }>,
  ) {
    return this.stockAlertsService.update(req.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.stockAlertsService.remove(req.userId, id);
  }
}
