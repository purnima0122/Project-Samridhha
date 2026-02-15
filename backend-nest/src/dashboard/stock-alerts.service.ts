import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StockAlert,
  StockAlertDocument,
} from './schemas/stock-alert.schema';

@Injectable()
export class StockAlertsService {
  constructor(
    @InjectModel(StockAlert.name)
    private readonly stockAlertModel: Model<StockAlertDocument>,
  ) {}

  async create(
    userId: string,
    data: {
      symbol: string;
      type: string;
      price: string;
      units: string;
      status?: string;
    },
  ) {
    return this.stockAlertModel.create({
      userId: new Types.ObjectId(userId),
      symbol: data.symbol,
      type: data.type,
      price: data.price,
      units: data.units,
      status: data.status ?? 'active',
    });
  }

  async findAll(userId: string) {
    return this.stockAlertModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(userId: string, id: string) {
    const alert = await this.stockAlertModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async update(
    userId: string,
    id: string,
    data: Partial<{
      symbol: string;
      type: string;
      price: string;
      units: string;
      status: string;
    }>,
  ) {
    const alert = await this.stockAlertModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(id),
          userId: new Types.ObjectId(userId),
        },
        {
          $set: data,
        },
        { new: true },
      )
      .exec();

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async remove(userId: string, id: string) {
    const alert = await this.stockAlertModel
      .findOneAndDelete({
        _id: new Types.ObjectId(id),
        userId: new Types.ObjectId(userId),
      })
      .exec();

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return { deleted: true };
  }
}
