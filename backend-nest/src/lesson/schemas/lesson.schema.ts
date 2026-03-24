import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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

@Schema({ _id: false })
export class Flashcard {
  @Prop({ required: true })
  prompt: string;

  @Prop({ required: true })
  answer: string;

  @Prop()
  tag?: string;
}

export const FlashcardSchema = SchemaFactory.createForClass(Flashcard);

@Schema({ _id: false })
export class VaultFact {
  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;
}

export const VaultFactSchema = SchemaFactory.createForClass(VaultFact);

@Schema({ timestamps: true })
export class Lesson {
  @Prop()
  slug?: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  topic?: string;

  @Prop()
  topicSlug?: string;

  @Prop({ required: true })
  module: string;

  @Prop()
  moduleSlug?: string;

  @Prop({ type: Types.ObjectId, ref: 'LearningModule' })
  moduleId?: Types.ObjectId;

  @Prop({ default: '' })
  summary: string;

  @Prop({ required: true })
  content: string;

  @Prop({ default: 'lesson' })
  type: 'lesson' | 'vault';

  @Prop({ default: '' })
  videoUrl: string;

  @Prop({ default: '#10B981' })
  color: string;

  @Prop({ default: 'BookOpen' })
  icon: string;

  @Prop()
  emoji?: string;

  @Prop({ required: true })
  order: number;

  @Prop({ default: 5 })
  duration: number;

  @Prop({ default: 50 })
  xp: number;

  @Prop({ default: true })
  isPublished: boolean;

  @Prop({ type: [FlashcardSchema], default: [] })
  flashcards: Flashcard[];

  @Prop({ type: [QuizQuestionSchema], default: [] })
  quiz: QuizQuestion[];

  @Prop({ type: [VaultFactSchema], default: [] })
  facts: VaultFact[];
}

export const LessonSchema = SchemaFactory.createForClass(Lesson);

LessonSchema.index(
  { moduleSlug: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: {
      moduleSlug: { $type: 'string' },
      slug: { $type: 'string' },
    },
  },
);
