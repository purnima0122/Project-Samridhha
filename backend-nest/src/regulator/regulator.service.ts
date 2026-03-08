import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/auth/schemas/user.schema';
import { Lesson } from 'src/lesson/schemas/lesson.schema';
import { Progress, ProgressDocument } from 'src/progress/schemas/progress.schema';

type WardStat = {
  wardNumber: number;
  userCount: number;
};

type LiteracyTopicStat = {
  topic: string;
  avgScore: number;
};

@Injectable()
export class RegulatorService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Progress.name)
    private readonly progressModel: Model<ProgressDocument>,
    @InjectModel(Lesson.name) private readonly lessonModel: Model<Lesson>,
  ) {}

  async getWardCoverage() {
    const [wards, literacyTopics] = await Promise.all([
      this.getWardStats(),
      this.getLiteracyStats(),
    ]);

    const totalUsers = wards.reduce((sum, ward) => sum + ward.userCount, 0);

    return {
      metadata: {
        province: 'Bagmati',
        district: 'Kathmandu',
        municipality: 'Kathmandu Metropolitan City',
        totalUsers,
        generatedAt: new Date().toISOString(),
      },
      wards,
      literacyTopics,
    };
  }

  private async getWardStats(): Promise<WardStat[]> {
    const results = await this.userModel.aggregate([
      {
        $match: {
          wardNo: { $type: 'string', $ne: '' },
        },
      },
      {
        $project: {
          wardNoTrim: { $trim: { input: '$wardNo' } },
        },
      },
      {
        $match: {
          wardNoTrim: { $regex: '^[0-9]+$' },
        },
      },
      {
        $group: {
          _id: { $toInt: '$wardNoTrim' },
          userCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return results.map((row: { _id: number; userCount: number }) => ({
      wardNumber: row._id,
      userCount: row.userCount,
    }));
  }

  private async getLiteracyStats(): Promise<LiteracyTopicStat[]> {
    const collectionName = this.lessonModel.collection.name;
    const rows = await this.progressModel.aggregate([
      {
        $lookup: {
          from: collectionName,
          localField: 'lessonId',
          foreignField: '_id',
          as: 'lesson',
        },
      },
      { $unwind: '$lesson' },
      {
        $project: {
          module: { $ifNull: ['$lesson.module', 'General'] },
          bestScore: { $ifNull: ['$bestScore', 0] },
        },
      },
      {
        $group: {
          _id: '$module',
          avgScore: { $avg: '$bestScore' },
        },
      },
      {
        $project: {
          _id: 0,
          module: '$_id',
          avgScore: { $round: ['$avgScore', 0] },
        },
      },
    ]);

    const byTopic = new Map<string, { total: number; count: number }>();
    for (const row of rows as Array<{ module: string; avgScore: number }>) {
      const topic = this.mapModuleToTopic(row.module);
      const current = byTopic.get(topic) ?? { total: 0, count: 0 };
      byTopic.set(topic, {
        total: current.total + Number(row.avgScore || 0),
        count: current.count + 1,
      });
    }

    const preferredOrder = [
      'Risk & Volatility',
      'Diversification',
      'Long-term Investing',
      'Reading Alerts',
      'Basic Instruments',
    ];

    return Array.from(byTopic.entries())
      .map(([topic, value]) => ({
        topic,
        avgScore: Math.round(value.total / Math.max(value.count, 1)),
      }))
      .sort((a, b) => {
        const aIndex = preferredOrder.indexOf(a.topic);
        const bIndex = preferredOrder.indexOf(b.topic);
        if (aIndex === -1 && bIndex === -1) return a.topic.localeCompare(b.topic);
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
  }

  private mapModuleToTopic(moduleName: string): string {
    const normalized = String(moduleName || '').trim().toLowerCase();

    if (normalized.includes('risk') || normalized.includes('volatil')) {
      return 'Risk & Volatility';
    }
    if (normalized.includes('diversif')) {
      return 'Diversification';
    }
    if (
      normalized.includes('long-term') ||
      normalized.includes('long term') ||
      normalized.includes('longterm')
    ) {
      return 'Long-term Investing';
    }
    if (
      normalized.includes('alert') ||
      normalized.includes('signal') ||
      normalized.includes('notification')
    ) {
      return 'Reading Alerts';
    }
    if (
      normalized.includes('instrument') ||
      normalized.includes('basic') ||
      normalized.includes('foundation') ||
      normalized.includes('beginner')
    ) {
      return 'Basic Instruments';
    }

    return moduleName?.trim() || 'General';
  }
}
