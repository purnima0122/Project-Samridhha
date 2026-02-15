import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  WatchlistItem,
  WatchlistItemDocument,
} from './schemas/watchlist-item.schema';

@Injectable()
export class WatchlistService {
  constructor(
    @InjectModel(WatchlistItem.name)
    private readonly watchlistModel: Model<WatchlistItemDocument>,
  ) {}

  async create(
    userId: string,
    data: {
      symbol: string;
      price?: string;
      change?: string;
      alertType?: string;
      isPositive?: boolean;
    },
  ) {
    return this.watchlistModel.create({
      userId: new Types.ObjectId(userId),
      symbol: data.symbol,
      price: data.price,
      change: data.change,
      alertType: data.alertType,
      isPositive: data.isPositive ?? true,
    });
  }

  async findAll(userId: string) {
    return this.watchlistModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(userId: string, id: string) {
    const item = await this.watchlistModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!item) {
      throw new NotFoundException('Watchlist item not found');
    }

    return item;
  }

  async update(
    userId: string,
    id: string,
    data: Partial<{
      symbol: string;
      price: string;
      change: string;
      alertType: string;
      isPositive: boolean;
    }>,
  ) {
    const item = await this.watchlistModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        { $set: data },
        { new: true },
      )
      .exec();

    if (!item) {
      throw new NotFoundException('Watchlist item not found');
    }

    return item;
  }

  async remove(userId: string, id: string) {
    const item = await this.watchlistModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!item) {
      throw new NotFoundException('Watchlist item not found');
    }

    return { deleted: true };
  }
}
