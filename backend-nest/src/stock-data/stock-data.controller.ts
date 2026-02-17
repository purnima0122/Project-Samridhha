import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
} from '@nestjs/common';
import { StockDataService } from './stock-data.service';

@Controller('stock-data')
export class StockDataController {
    constructor(private readonly stockDataService: StockDataService) { }

    @Get('stocks')
    getStocks(@Query('all') all?: string) {
        return this.stockDataService.getStocks(all === 'true');
    }

    @Get('stocks/:symbol')
    getStock(@Param('symbol') symbol: string) {
        return this.stockDataService.getStock(symbol);
    }

    @Get('stocks/:symbol/history')
    getStockHistory(
        @Param('symbol') symbol: string,
        @Query('days') days?: string,
    ) {
        return this.stockDataService.getStockHistory(symbol, days ? +days : 50);
    }

    @Get('search')
    searchStocks(@Query('q') q?: string, @Query('sector') sector?: string) {
        return this.stockDataService.searchStocks(q, sector);
    }

    @Get('market-status')
    getMarketStatus() {
        return this.stockDataService.getMarketStatus();
    }

    @Post('alerts/check')
    checkAlert(
        @Body()
        body: {
            symbol: string;
            price_threshold_pct?: number;
            volume_threshold_multiplier?: number;
        },
    ) {
        return this.stockDataService.checkAlertThreshold(body);
    }
}
