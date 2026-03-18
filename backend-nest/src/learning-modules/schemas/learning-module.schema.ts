import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LearningModuleDocument = LearningModule & Document;

@Schema({ timestamps: true })
export class LearningModule {
  @Prop({ required: true })
  title: string;

  @Prop()
  emoji?: string;

  @Prop({ default: '#F59E0B' })
  color: string;

  @Prop({ default: '#B45309' })
  darkColor: string;

  @Prop({ default: '' })
  tagline: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: true })
  isPublished: boolean;
}

export const LearningModuleSchema =
  SchemaFactory.createForClass(LearningModule);
