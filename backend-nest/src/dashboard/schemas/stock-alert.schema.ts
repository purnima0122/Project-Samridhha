import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockAlertDocument = StockAlert & Document;

@Schema({ timestamps: true })
export class StockAlert {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  symbol: string;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  price: string;

  @Prop({ required: true })
  units: string;

  @Prop({ default: 'active' })
  status: string;
}

export const StockAlertSchema = SchemaFactory.createForClass(StockAlert);
