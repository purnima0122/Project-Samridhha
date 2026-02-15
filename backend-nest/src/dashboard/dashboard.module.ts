import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Lesson, LessonSchema } from '../lesson/schemas/lesson.schema';
import {
  Progress,
  ProgressSchema,
} from '../progress/schemas/progress.schema';
import {
  StockAlert,
  StockAlertSchema,
} from './schemas/stock-alert.schema';
import {
  WatchlistItem,
  WatchlistItemSchema,
} from './schemas/watchlist-item.schema';
import { AuthGuard } from 'src/guards/auth.guard';
import { StockAlertsService } from './stock-alerts.service';
import { WatchlistService } from './watchlist.service';
import { StockAlertsController } from './stock-alerts.controller';
import { WatchlistController } from './watchlist.controller';
import { AdminGuard } from 'src/guards/admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Lesson.name, schema: LessonSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: StockAlert.name, schema: StockAlertSchema },
      { name: WatchlistItem.name, schema: WatchlistItemSchema },
    ]),
  ],
  controllers: [
    DashboardController,
    StockAlertsController,
    WatchlistController,
  ],
  providers: [
    DashboardService,
    StockAlertsService,
    WatchlistService,
    AuthGuard,
    AdminGuard,
  ],
})
export class DashboardModule {}
