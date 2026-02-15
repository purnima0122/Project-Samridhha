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
import { WatchlistService } from './watchlist.service';

@UseGuards(AuthGuard, AdminGuard)
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  findAll(@Req() req) {
    return this.watchlistService.findAll(req.userId);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id') id: string) {
    return this.watchlistService.findOne(req.userId, id);
  }

  @Post()
  create(
    @Req() req,
    @Body()
    body: {
      symbol: string;
      price?: string;
      change?: string;
      alertType?: string;
      isPositive?: boolean;
    },
  ) {
    return this.watchlistService.create(req.userId, body);
  }

  @Patch(':id')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body()
    body: Partial<{
      symbol: string;
      price: string;
      change: string;
      alertType: string;
      isPositive: boolean;
    }>,
  ) {
    return this.watchlistService.update(req.userId, id, body);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.watchlistService.remove(req.userId, id);
  }
}
