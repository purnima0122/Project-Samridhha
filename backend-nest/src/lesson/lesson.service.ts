import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from './schemas/lesson.schema';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';

@Injectable()
export class LessonService {
  constructor(
    @InjectModel(Lesson.name)
    private lessonModel: Model<LessonDocument>,
  ) {}

  async findAll() {
    return this.lessonModel
      .find({ isPublished: true })
      .sort({ order: 1 })
      .exec();
  }

  async findByModule(module: string) {
    return this.lessonModel
      .find({ module, isPublished: true })
      .sort({ order: 1 })
      .exec();
  }

  async findOne(id: string) {
    return this.lessonModel.findById(id).exec();
  }

  async create(data: CreateLessonDto) {
    return this.lessonModel.create(data);
  }

  async update(id: string, data: UpdateLessonDto) {
    return this.lessonModel.findByIdAndUpdate(id, data, {
      new: true,
    });
  }

  async remove(id: string) {
    await this.lessonModel.findByIdAndDelete(id).exec();
    return { deleted: true };
  }

  async addQuizQuestion(
    id: string,
    question: {
      prompt: string;
      options: string[];
      correctOptionIndex: number;
      explanation?: string;
    },
  ) {
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson) {
      return null;
    }
    lesson.quiz = lesson.quiz ?? [];
    lesson.quiz.push(question);
    await lesson.save();
    return lesson;
  }

  async updateQuizQuestion(
    id: string,
    index: number,
    question: Partial<{
      prompt: string;
      options: string[];
      correctOptionIndex: number;
      explanation?: string;
    }>,
  ) {
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson || !lesson.quiz || index < 0 || index >= lesson.quiz.length) {
      return null;
    }
    const existing = lesson.quiz[index];
    lesson.quiz[index] = {
      ...existing,
      ...question,
    };
    await lesson.save();
    return lesson;
  }

  async removeQuizQuestion(id: string, index: number) {
    const lesson = await this.lessonModel.findById(id).exec();
    if (!lesson || !lesson.quiz || index < 0 || index >= lesson.quiz.length) {
      return null;
    }
    lesson.quiz.splice(index, 1);
    await lesson.save();
    return lesson;
  }
}
