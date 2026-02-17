import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { Lesson, LessonDocument } from '../lesson/schemas/lesson.schema';
import {
  Progress,
  ProgressDocument,
} from '../progress/schemas/progress.schema';
import {
  StockAlert,
  StockAlertDocument,
} from './schemas/stock-alert.schema';
import {
  WatchlistItem,
  WatchlistItemDocument,
} from './schemas/watchlist-item.schema';
import { StockDataService } from '../stock-data/stock-data.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(Progress.name)
    private readonly progressModel: Model<ProgressDocument>,
    @InjectModel(StockAlert.name)
    private readonly stockAlertModel: Model<StockAlertDocument>,
    @InjectModel(WatchlistItem.name)
    private readonly watchlistModel: Model<WatchlistItemDocument>,
    private readonly stockDataService: StockDataService,
  ) { }

  async getSummary() {
    const [
      totalUsers,
      totalLessons,
      publishedLessons,
      totalProgress,
      completedLessons,
    ] = await Promise.all([
      this.userModel.countDocuments().exec(),
      this.lessonModel.countDocuments().exec(),
      this.lessonModel.countDocuments({ isPublished: true }).exec(),
      this.progressModel.countDocuments().exec(),
      this.progressModel
        .countDocuments({ completed: true })
        .exec(),
    ]);

    return {
      totalUsers,
      totalLessons,
      publishedLessons,
      totalProgress,
      completedLessons,
    };
  }

  async getUserDashboard(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const [user, stockAlerts, watchlistItems] = await Promise.all([
      this.userModel
        .findById(userObjectId)
        .select('name email spikeAlertsEnabled')
        .exec(),
      this.stockAlertModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .exec(),
      this.watchlistModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .exec(),
    ]);

    // Enrich watchlist items with live prices from Data-Server
    let enrichedWatchlist: any[] = watchlistItems.map((item) => item.toObject());
    try {
      const symbols = watchlistItems
        .map((item) => item.symbol)
        .filter(Boolean);
      if (symbols.length > 0) {
        const livePrices =
          await this.stockDataService.getLivePrices(symbols);
        enrichedWatchlist = enrichedWatchlist.map((item) => {
          const live = livePrices[item.symbol?.toUpperCase()];
          if (live) {
            return {
              ...item,
              price: `NPR ${live.price.toFixed(2)}`,
              change: `${live.change_pct >= 0 ? '+' : ''}${live.change_pct.toFixed(2)}%`,
              isPositive: live.change_pct >= 0,
            };
          }
          return item;
        });
      }
    } catch (error) {
      this.logger.warn('Could not fetch live prices from Data-Server', error);
    }

    return {
      userName: user?.name || user?.email || 'User',
      spikeAlertsEnabled: user?.spikeAlertsEnabled ?? true,
      stockAlerts,
      watchlistItems: enrichedWatchlist,
    };
  }

  async updateSettings(userId: string, spikeAlertsEnabled: boolean) {
    const userObjectId = new Types.ObjectId(userId);
    await this.userModel.findByIdAndUpdate(
      userObjectId,
      { spikeAlertsEnabled: Boolean(spikeAlertsEnabled) },
      { new: true },
    );

    return { spikeAlertsEnabled: Boolean(spikeAlertsEnabled) };
  }
}
