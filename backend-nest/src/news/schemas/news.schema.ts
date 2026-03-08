import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type NewsDocument = News & Document;

@Schema({ timestamps: true })
export class News {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  summary: string;

  @Prop({ default: '', trim: true })
  source: string;

  @Prop({ default: '', trim: true })
  url?: string;

  @Prop({ default: '', trim: true })
  category?: string;

  @Prop({ default: '', trim: true })
  imageUrl?: string;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ default: () => new Date() })
  publishedAt: Date;
}

export const NewsSchema = SchemaFactory.createForClass(News);
