import { Module } from '@nestjs/common';
import { StockDataService } from './stock-data.service';
import { StockDataController } from './stock-data.controller';

@Module({
    controllers: [StockDataController],
    providers: [StockDataService],
    exports: [StockDataService],
})
export class StockDataModule { }
