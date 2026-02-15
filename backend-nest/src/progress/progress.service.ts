import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { Lesson, LessonDocument } from '../lesson/schemas/lesson.schema';

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Progress.name)
    private readonly progressModel: Model<ProgressDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
  ) {}

  // Called when user opens a lesson
  async startLesson(userId: string, lessonId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const lessonObjectId = new Types.ObjectId(lessonId);

    const exists = await this.progressModel.findOne({
      userId: userObjectId,
      lessonId: lessonObjectId,
    });

    if (exists) {
      return exists;
    }

    return this.progressModel.create({
      userId: userObjectId,
      lessonId: lessonObjectId,
      completed: false,
    });
  }

  // Called when user completes a lesson
  async completeLesson(userId: string, lessonId: string) {
    return this.progressModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        lessonId: new Types.ObjectId(lessonId),
      },
      {
        completed: true,
        completedAt: new Date(),
      },
      { new: true, upsert: true },
    );
  }

  // Fetch all progress for logged-in user
  async getUserProgress(userId: string) {
    return this.progressModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('lessonId')
      .exec();
  }

  // Progress summary for a user (optionally filtered by module)
  async getProgressSummary(userId: string, module?: string) {
    const userObjectId = new Types.ObjectId(userId);
    const lessonQuery: Record<string, unknown> = {
      isPublished: true,
    };

    if (module) {
      lessonQuery.module = module;
    }

    const lessons = await this.lessonModel
      .find(lessonQuery)
      .select('_id')
      .exec();

    const totalLessons = lessons.length;
    if (totalLessons === 0) {
      return {
        totalLessons: 0,
        completedLessons: 0,
        remainingLessons: 0,
        percentComplete: 0,
      };
    }

    const lessonIds = lessons.map((lesson) => lesson._id);
    const completedLessons = await this.progressModel.countDocuments({
      userId: userObjectId,
      completed: true,
      lessonId: { $in: lessonIds },
    });

    const remainingLessons = Math.max(
      totalLessons - completedLessons,
      0,
    );

    const percentComplete = Math.round(
      (completedLessons / totalLessons) * 100,
    );

    return {
      totalLessons,
      completedLessons,
      remainingLessons,
      percentComplete,
    };
  }

  // Grade quiz for a lesson and store best score
  async submitQuiz(
    userId: string,
    lessonId: string,
    answers: number[],
  ) {
    const lesson = await this.lessonModel
      .findById(lessonId)
      .select('quiz')
      .exec();

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const quiz = lesson.quiz ?? [];
    if (quiz.length === 0) {
      return {
        message: 'No quiz found for this lesson.',
        totalQuestions: 0,
        correctAnswers: 0,
        scorePercent: 0,
        passed: false,
      };
    }

    if (!Array.isArray(answers) || answers.length !== quiz.length) {
      throw new BadRequestException(
        `answers must be an array with ${quiz.length} items`,
      );
    }

    let correctAnswers = 0;
    for (let i = 0; i < quiz.length; i += 1) {
      if (answers[i] === quiz[i].correctOptionIndex) {
        correctAnswers += 1;
      }
    }

    const scorePercent = Math.round(
      (correctAnswers / quiz.length) * 100,
    );
    const passed = scorePercent >= 70;

    const userObjectId = new Types.ObjectId(userId);
    const lessonObjectId = new Types.ObjectId(lessonId);
    const existing = await this.progressModel.findOne({
      userId: userObjectId,
      lessonId: lessonObjectId,
    });

    const bestScore = Math.max(existing?.bestScore ?? 0, scorePercent);
    const quizPassed = (existing?.quizPassed ?? false) || passed;
    const completed = quizPassed
      ? true
      : existing?.completed ?? false;
    const completedAt =
      completed && !existing?.completedAt
        ? new Date()
        : existing?.completedAt;

    await this.progressModel.findOneAndUpdate(
      {
        userId: userObjectId,
        lessonId: lessonObjectId,
      },
      {
        userId: userObjectId,
        lessonId: lessonObjectId,
        quizAttempts: (existing?.quizAttempts ?? 0) + 1,
        bestScore,
        lastScore: scorePercent,
        quizPassed,
        lastQuizAttemptAt: new Date(),
        completed,
        completedAt,
      },
      { new: true, upsert: true },
    );

    return {
      totalQuestions: quiz.length,
      correctAnswers,
      scorePercent,
      passed,
      bestScore,
    };
  }
}
