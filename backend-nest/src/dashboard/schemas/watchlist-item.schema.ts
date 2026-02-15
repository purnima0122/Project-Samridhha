import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type WatchlistItemDocument = WatchlistItem & Document;

@Schema({ timestamps: true })
export class WatchlistItem {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  symbol: string;

  @Prop()
  price?: string;

  @Prop()
  change?: string;

  @Prop()
  alertType?: string;

  @Prop({ default: true })
  isPositive: boolean;
}

export const WatchlistItemSchema =
  SchemaFactory.createForClass(WatchlistItem);
