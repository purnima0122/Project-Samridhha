import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type LessonDocument = Lesson & Document;

@Schema({ _id: false })
export class QuizQuestion {
  @Prop({ required: true })
  prompt: string;

  @Prop({ type: [String], required: true })
  options: string[];

  @Prop({ required: true, min: 0 })
  correctOptionIndex: number;

  @Prop()
  explanation?: string;
}

export const QuizQuestionSchema =
  SchemaFactory.createForClass(QuizQuestion);

@Schema({ timestamps: true })
export class Lesson {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  module: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: '' })
  videoUrl: string;

  @Prop({ default: '#10B981' })
  color: string;

  @Prop({ default: 'BookOpen' })
  icon: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: 5 })
  duration: number;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ type: [QuizQuestionSchema], default: [] })
  quiz: QuizQuestion[];
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);
