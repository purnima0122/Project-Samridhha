import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { CreateNewsDto } from './dtos/create-news.dto';
import { UpdateNewsDto } from './dtos/update-news.dto';
import { News, NewsDocument } from './schemas/news.schema';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<NewsDocument>,
  ) {}

  async findPublic() {
    return this.newsModel
      .find({ isPublished: true })
      .sort({ publishedAt: -1, createdAt: -1 })
      .exec();
  }

  async findAllForAdmin(query?: string) {
    const filter: FilterQuery<NewsDocument> = {};
    if (query?.trim()) {
      const regex = new RegExp(query.trim(), 'i');
      filter.$or = [{ title: regex }, { summary: regex }, { source: regex }];
    }
    return this.newsModel.find(filter).sort({ publishedAt: -1, createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    return this.newsModel.findById(id).exec();
  }

  async create(data: CreateNewsDto) {
    return this.newsModel.create(data);
  }

  async update(id: string, data: UpdateNewsDto) {
    return this.newsModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async remove(id: string) {
    await this.newsModel.findByIdAndDelete(id).exec();
    return { deleted: true };
  }
}
