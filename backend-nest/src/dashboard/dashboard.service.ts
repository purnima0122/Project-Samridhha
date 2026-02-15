import { Injectable } from '@nestjs/common';
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

@Injectable()
export class DashboardService {
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
  ) {}

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

    return {
      userName: user?.name || user?.email || 'User',
      spikeAlertsEnabled: user?.spikeAlertsEnabled ?? true,
      stockAlerts,
      watchlistItems,
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
