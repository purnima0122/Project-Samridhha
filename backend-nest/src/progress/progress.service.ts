import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { Lesson, LessonDocument } from '../lesson/schemas/lesson.schema';
import { User } from '../auth/schemas/user.schema';

const LESSON_COMPLETION_XP = 20;
const UNIT_COMPLETION_XP = 50;
const COURSE_COMPLETION_XP = 200;
const FLASHCARD_VIEW_XP = 2;
const QUIZ_CORRECT_XP = 5;
const MAX_FLASHCARDS_PER_LESSON = 4;
const PASSING_SCORE_PERCENT = 70;
const LEVEL_XP_STEP = 120;
const QUIZ_BONUS_XP = 15;
const MAX_STREAK_HISTORY_DAYS = 100;
const DEFAULT_MAX_HEARTS = 5;

type StreakDayRecord = {
  date: string;
  lessonsCompleted: number;
  quizzesCompleted: number;
  xpEarned: number;
  streakCount: number;
  freezeUsed: boolean;
};

type StreakCelebration = {
  date: string;
  xpEarned: number;
  streakCount: number;
};

@Injectable()
export class ProgressService {
  constructor(
    @InjectModel(Progress.name)
    private readonly progressModel: Model<ProgressDocument>,
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
  ) {}

  private getDayStart(date: Date): Date {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private diffInDays(from: Date, to: Date): number {
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.floor((this.getDayStart(to).getTime() - this.getDayStart(from).getTime()) / dayMs);
  }

  private getLocalDate(now: Date, timezoneOffsetMinutes: number) {
    return new Date(now.getTime() - timezoneOffsetMinutes * 60 * 1000);
  }

  private getDateKeyWithOffset(now: Date, timezoneOffsetMinutes: number): string {
    return this.getLocalDate(now, timezoneOffsetMinutes).toISOString().slice(0, 10);
  }

  private parseDateKey(dateKey: string): Date {
    return new Date(`${dateKey}T00:00:00.000Z`);
  }

  private formatDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private normalizeStreakHistory(user: User) {
    const history = (user.streakHistory ?? []) as StreakDayRecord[];
    history.sort((a, b) => a.date.localeCompare(b.date));
    if (history.length > MAX_STREAK_HISTORY_DAYS) {
      user.streakHistory = history.slice(-MAX_STREAK_HISTORY_DAYS);
    } else {
      user.streakHistory = history;
    }
  }

  private getOrCreateStreakDay(user: User, dateKey: string): StreakDayRecord {
    const history = (user.streakHistory ?? []) as StreakDayRecord[];
    const existingIndex = history.findIndex((item) => item.date === dateKey);
    if (existingIndex >= 0) {
      return history[existingIndex];
    }
    const record: StreakDayRecord = {
      date: dateKey,
      lessonsCompleted: 0,
      quizzesCompleted: 0,
      xpEarned: 0,
      streakCount: 0,
      freezeUsed: false,
    };
    history.push(record);
    user.streakHistory = history;
    return record;
  }

  private isDailyRequirementMet(record: StreakDayRecord) {
    return record.lessonsCompleted >= 1 && record.quizzesCompleted >= 1;
  }

  private resolveTimezoneOffset(user: User, clientOffset?: number) {
    if (Number.isFinite(clientOffset)) {
      user.timezoneOffsetMinutes = Number(clientOffset);
      return Number(clientOffset);
    }
    if (Number.isFinite(user.timezoneOffsetMinutes)) {
      return Number(user.timezoneOffsetMinutes);
    }
    return 0;
  }

  private processStreakRollovers(user: User, now: Date, timezoneOffsetMinutes: number) {
    const todayKey = this.getDateKeyWithOffset(now, timezoneOffsetMinutes);
    const lastCheckKey = user.lastStreakCheckDate ?? todayKey;
    if (!user.lastStreakCheckDate) {
      user.lastStreakCheckDate = todayKey;
      this.normalizeStreakHistory(user);
      return true;
    }

    if (lastCheckKey === todayKey) {
      return false;
    }

    let cursor = this.parseDateKey(lastCheckKey);
    const todayDate = this.parseDateKey(todayKey);
    let changed = false;

    cursor.setUTCDate(cursor.getUTCDate() + 1);
    while (cursor < todayDate) {
      const dateKey = this.formatDateKey(cursor);
      const record = this.getOrCreateStreakDay(user, dateKey);
      const requirementMet = this.isDailyRequirementMet(record);

      if (!requirementMet) {
        const freezes = user.streakFreezes ?? 0;
        if (freezes > 0) {
          user.streakFreezes = freezes - 1;
          user.streakFreezeUsedCount = (user.streakFreezeUsedCount ?? 0) + 1;
          record.freezeUsed = true;
          record.streakCount = user.streakDays ?? 0;
          changed = true;
        } else {
          if ((user.streakDays ?? 0) !== 0) {
            user.streakDays = 0;
            changed = true;
          }
          record.streakCount = 0;
        }
      } else if (record.streakCount === 0) {
        record.streakCount = user.streakDays ?? 0;
        changed = true;
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    user.lastStreakCheckDate = todayKey;
    this.normalizeStreakHistory(user);
    return changed || lastCheckKey !== todayKey;
  }

  private recordDailyActivity(
    user: User,
    now: Date,
    timezoneOffsetMinutes: number,
    deltas: { lessonsCompleted?: number; quizzesCompleted?: number; xpEarned?: number },
  ) {
    const dateKey = this.getDateKeyWithOffset(now, timezoneOffsetMinutes);
    const record = this.getOrCreateStreakDay(user, dateKey);
    record.lessonsCompleted = Math.max(0, record.lessonsCompleted + (deltas.lessonsCompleted ?? 0));
    record.quizzesCompleted = Math.max(0, record.quizzesCompleted + (deltas.quizzesCompleted ?? 0));
    record.xpEarned = Math.max(0, record.xpEarned + (deltas.xpEarned ?? 0));

    const requirementMet = this.isDailyRequirementMet(record);
    let streakAwarded = false;
    if (requirementMet && record.streakCount === 0) {
      user.streakDays = (user.streakDays ?? 0) + 1;
      record.streakCount = user.streakDays ?? 0;
      streakAwarded = true;
    }

    this.normalizeStreakHistory(user);
    return { record, requirementMet, streakAwarded };
  }

  private buildStreakCelebration(
    user: User,
    record: StreakDayRecord,
    streakAwarded: boolean,
  ): StreakCelebration | null {
    if (!streakAwarded) return null;
    if (user.lastStreakCelebrationDate === record.date) {
      return null;
    }
    user.lastStreakCelebrationDate = record.date;
    return {
      date: record.date,
      xpEarned: record.xpEarned,
      streakCount: record.streakCount,
    };
  }

  private getCurrentWeekProgress(user: User, now: Date, timezoneOffsetMinutes: number) {
    const localNow = this.getLocalDate(now, timezoneOffsetMinutes);
    const currentDay = localNow.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(localNow);
    monday.setDate(localNow.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activity = new Map(
      (user.streakHistory ?? []).map((item: any) => [item.date, item as StreakDayRecord]),
    );

    return labels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateKey = date.toISOString().slice(0, 10);
      const isToday = localNow.toISOString().slice(0, 10) === dateKey;
      const record = activity.get(dateKey);
      const completed = record ? this.isDailyRequirementMet(record) : false;

      return {
        label,
        date: dateKey,
        completed,
        isToday,
        status: completed ? 'done' : date > localNow ? 'locked' : isToday ? 'today' : 'missed',
      };
    });
  }

  private ensureHeartsFresh(user: User, now: Date) {
    const maxHearts = user.maxHearts ?? DEFAULT_MAX_HEARTS;
    const currentHearts = user.hearts ?? maxHearts;
    const lastRefill = user.lastHeartsRefillAt;

    if (!lastRefill || this.diffInDays(lastRefill, now) >= 1) {
      user.hearts = maxHearts;
      user.lastHeartsRefillAt = now;
      return true;
    }

    if (currentHearts !== user.hearts) {
      user.hearts = currentHearts;
      return true;
    }

    return false;
  }

  private applyFreezeRefillMilestones(user: User, newBadges: string[]) {
    const maxFreezes = user.maxStreakFreezes ?? 3;
    const currentFreezes = user.streakFreezes ?? 0;
    const streakDays = user.streakDays ?? 0;
    const freezeUsed = (user.streakFreezeUsedCount ?? 0) > 0;

    const rewards: Array<{ minDays: number; freeze: number; badge: string; requiresFreezeUse?: boolean }> = [
      { minDays: 7, freeze: 1, badge: '7 Day Streak' },
      { minDays: 14, freeze: 1, badge: '14 Day Streak Freeze Refill', requiresFreezeUse: true },
      { minDays: 30, freeze: 2, badge: '30 Day Streak' },
    ];

    let updatedFreezes = currentFreezes;
    for (const reward of rewards) {
      if (streakDays < reward.minDays) {
        continue;
      }
      if (reward.requiresFreezeUse && !freezeUsed) {
        continue;
      }
      if ((user.badges ?? []).includes(reward.badge)) {
        continue;
      }
      updatedFreezes = Math.min(maxFreezes, updatedFreezes + reward.freeze);
      this.addBadge(user, reward.badge, newBadges);
    }

    user.streakFreezes = updatedFreezes;
  }

  private getLevel(xp: number): number {
    return Math.floor(Math.max(0, xp) / LEVEL_XP_STEP) + 1;
  }

  private addBadge(user: User, badge: string, newBadges: string[]) {
    if (!user.badges) {
      user.badges = [];
    }

    if (!user.badges.includes(badge)) {
      user.badges.push(badge);
      newBadges.push(badge);
    }
  }

  private applyMilestoneBadges(user: User, newBadges: string[]) {
    if ((user.lessonsCompletedCount ?? 0) >= 1) {
      this.addBadge(user, 'First Lesson Completed', newBadges);
    }

    if ((user.lessonsCompletedCount ?? 0) >= 5) {
      this.addBadge(user, '5 Lessons Completed', newBadges);
    }

    if ((user.streakDays ?? 0) >= 7) {
      this.addBadge(user, '7 Day Streak', newBadges);
    }

    if ((user.correctQuizAnswers ?? 0) >= 50) {
      this.addBadge(user, '50 Quiz Questions Correct', newBadges);
    }
  }

  private gamificationSnapshot(user: User) {
    const xp = user.xp ?? 0;
    const progressInLevel = xp % LEVEL_XP_STEP;
    const now = new Date();
    this.ensureHeartsFresh(user, now);
    this.normalizeStreakHistory(user);
    const timezoneOffsetMinutes = this.resolveTimezoneOffset(user);
    return {
      xp,
      level: this.getLevel(xp),
      streakDays: user.streakDays ?? 0,
      streakFreezes: user.streakFreezes ?? 3,
      maxStreakFreezes: user.maxStreakFreezes ?? 3,
      badges: user.badges ?? [],
      badgeSeen: user.badgeSeen ?? [],
      streakHistory: user.streakHistory ?? [],
      hearts: user.hearts ?? DEFAULT_MAX_HEARTS,
      maxHearts: user.maxHearts ?? DEFAULT_MAX_HEARTS,
      lessonsCompletedCount: user.lessonsCompletedCount ?? 0,
      correctQuizAnswers: user.correctQuizAnswers ?? 0,
      xpToNextLevel: LEVEL_XP_STEP - progressInLevel,
      weeklyProgress: this.getCurrentWeekProgress(user, now, timezoneOffsetMinutes),
      streakMessage: 'Finish a lesson and a quiz today!',
    };
  }

  private async ensureUnlocked(userObjectId: Types.ObjectId, lesson: LessonDocument) {
    const previousLesson = await this.lessonModel
      .findOne({
        isPublished: true,
        module: lesson.module,
        order: { $lt: lesson.order },
      })
      .sort({ order: -1 })
      .select('_id')
      .exec();

    if (!previousLesson) {
      return;
    }

    const previousProgress = await this.progressModel
      .findOne({
        userId: userObjectId,
        lessonId: previousLesson._id,
        completed: true,
      })
      .select('_id')
      .exec();

    if (!previousProgress) {
      throw new BadRequestException('Complete the previous lesson to unlock this lesson.');
    }
  }

  // Called when user opens a lesson
  async startLesson(userId: string, lessonId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const lessonObjectId = new Types.ObjectId(lessonId);

    const lesson = await this.lessonModel.findById(lessonObjectId).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.ensureUnlocked(userObjectId, lesson);

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
  async completeLesson(userId: string, lessonId: string, clientTimezoneOffset?: number) {
    const now = new Date();
    const userObjectId = new Types.ObjectId(userId);
    const lessonObjectId = new Types.ObjectId(lessonId);

    const lesson = await this.lessonModel.findById(lessonObjectId).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.ensureUnlocked(userObjectId, lesson);

    const existing = await this.progressModel.findOne({
      userId: userObjectId,
      lessonId: lessonObjectId,
    });

    const wasCompleted = existing?.completed ?? false;

    const progress = await this.progressModel.findOneAndUpdate(
      {
        userId: userObjectId,
        lessonId: lessonObjectId,
      },
      {
        userId: userObjectId,
        lessonId: lessonObjectId,
        completed: true,
        completedAt: existing?.completedAt ?? now,
      },
      { new: true, upsert: true },
    );

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const timezoneOffsetMinutes = this.resolveTimezoneOffset(user, clientTimezoneOffset);
    this.processStreakRollovers(user, now, timezoneOffsetMinutes);
    this.ensureHeartsFresh(user, now);
    let xpAwarded = 0;
    const newBadges: string[] = [];

    if (!wasCompleted) {
      user.lessonsCompletedCount = (user.lessonsCompletedCount ?? 0) + 1;
      user.xp = (user.xp ?? 0) + LESSON_COMPLETION_XP;
      xpAwarded += LESSON_COMPLETION_XP;
    }

    if (!wasCompleted) {
      const moduleLessons = await this.lessonModel
        .find({ module: lesson.module, isPublished: true })
        .select('_id')
        .exec();

      const moduleLessonIds = moduleLessons.map((item) => item._id);
      const completedInModule = await this.progressModel.countDocuments({
        userId: userObjectId,
        completed: true,
        lessonId: { $in: moduleLessonIds },
      });

      if (
        moduleLessonIds.length > 0 &&
        completedInModule === moduleLessonIds.length
      ) {
        const unitBadge = `Unit Completed: ${lesson.module}`;
        const chapterBadge = `Chapter Badge: ${lesson.module}`;
        if (!(user.badges ?? []).includes(unitBadge)) {
          user.xp = (user.xp ?? 0) + UNIT_COMPLETION_XP;
          xpAwarded += UNIT_COMPLETION_XP;
          this.addBadge(user, unitBadge, newBadges);
          this.addBadge(user, chapterBadge, newBadges);
        }
      }

      const allLessons = await this.lessonModel.find({ isPublished: true }).select('_id').exec();
      const allLessonIds = allLessons.map((item) => item._id);
      const completedAllLessons = await this.progressModel.countDocuments({
        userId: userObjectId,
        completed: true,
        lessonId: { $in: allLessonIds },
      });

      if (
        allLessonIds.length > 0 &&
        completedAllLessons === allLessonIds.length &&
        !(user.badges ?? []).includes('Course Completed')
      ) {
        user.xp = (user.xp ?? 0) + COURSE_COMPLETION_XP;
        xpAwarded += COURSE_COMPLETION_XP;
        this.addBadge(user, 'Course Completed', newBadges);
      }
    }

    const activity = this.recordDailyActivity(user, now, timezoneOffsetMinutes, {
      lessonsCompleted: wasCompleted ? 0 : 1,
      xpEarned: xpAwarded,
    });
    const streakCelebration = this.buildStreakCelebration(user, activity.record, activity.streakAwarded);

    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);
    await user.save();

    return {
      progress,
      xpAwarded,
      freezeUsed: activity.record.freezeUsed,
      newBadges,
      streakCelebration,
      gamification: this.gamificationSnapshot(user),
    };
  }

  async recordFlashcardView(
    userId: string,
    lessonId: string,
    count = 1,
    clientTimezoneOffset?: number,
  ) {
    const now = new Date();
    const parsedCount = Number.isFinite(count) ? Number(count) : 1;
    const safeCount = Math.max(1, Math.floor(parsedCount));
    const userObjectId = new Types.ObjectId(userId);
    const lessonObjectId = new Types.ObjectId(lessonId);

    const lesson = await this.lessonModel.findById(lessonObjectId).exec();
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.ensureUnlocked(userObjectId, lesson);

    const existing = await this.progressModel.findOne({
      userId: userObjectId,
      lessonId: lessonObjectId,
    });

    const viewed = existing?.flashcardsViewed ?? 0;
    const remaining = Math.max(0, MAX_FLASHCARDS_PER_LESSON - viewed);
    const grantedCount = Math.min(remaining, safeCount);
    const xpAwarded = grantedCount * FLASHCARD_VIEW_XP;

    await this.progressModel.findOneAndUpdate(
      { userId: userObjectId, lessonId: lessonObjectId },
      {
        userId: userObjectId,
        lessonId: lessonObjectId,
        flashcardsViewed: viewed + grantedCount,
      },
      { new: true, upsert: true },
    );

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const timezoneOffsetMinutes = this.resolveTimezoneOffset(user, clientTimezoneOffset);
    this.processStreakRollovers(user, now, timezoneOffsetMinutes);
    this.ensureHeartsFresh(user, now);

    if (xpAwarded > 0) {
      user.xp = (user.xp ?? 0) + xpAwarded;
    }

    const activity = this.recordDailyActivity(user, now, timezoneOffsetMinutes, {
      xpEarned: xpAwarded,
    });
    const streakCelebration = this.buildStreakCelebration(user, activity.record, activity.streakAwarded);

    const newBadges: string[] = [];
    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);
    await user.save();

    return {
      grantedCount,
      xpAwarded,
      freezeUsed: activity.record.freezeUsed,
      newBadges,
      streakCelebration,
      gamification: this.gamificationSnapshot(user),
    };
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

  async getGamificationSummary(userId: string, clientTimezoneOffset?: number) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const previousOffset = user.timezoneOffsetMinutes;
    const timezoneOffsetMinutes = this.resolveTimezoneOffset(user, clientTimezoneOffset);
    const offsetUpdated =
      Number.isFinite(clientTimezoneOffset) && previousOffset !== timezoneOffsetMinutes;
    const streakUpdated = this.processStreakRollovers(user, now, timezoneOffsetMinutes);
    const heartsUpdated = this.ensureHeartsFresh(user, now);
    if (heartsUpdated || streakUpdated || offsetUpdated) {
      await user.save();
    }

    const lessons = await this.lessonModel
      .find({ isPublished: true })
      .select('_id title order module')
      .sort({ module: 1, order: 1 })
      .exec();

    const progress = await this.progressModel
      .find({ userId: userObjectId, completed: true })
      .select('lessonId')
      .exec();

    const completedSet = new Set(progress.map((item) => String(item.lessonId)));

    let nextLessonId: string | null = null;
    let nextLessonTitle: string | null = null;

    for (let i = 0; i < lessons.length; i += 1) {
      const current = lessons[i];
      const currentId = String(current._id);
      if (completedSet.has(currentId)) {
        continue;
      }

      const previousInModule = await this.lessonModel
        .findOne({
          isPublished: true,
          module: current.module,
          order: { $lt: current.order },
        })
        .sort({ order: -1 })
        .select('_id')
        .exec();

      if (!previousInModule || completedSet.has(String(previousInModule._id))) {
        nextLessonId = currentId;
        nextLessonTitle = current.title;
        break;
      }
    }

    const totalLessons = lessons.length;
    const completedLessons = completedSet.size;

    return {
      ...this.gamificationSnapshot(user),
      nextLessonId,
      nextLessonTitle,
      totalLessons,
      completedLessons,
      coursePercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    };
  }

  async markBadgesSeen(userId: string, badgeIds: string[]) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const normalized = Array.isArray(badgeIds)
      ? badgeIds.map((id) => String(id).trim()).filter((id) => id.length > 0)
      : [];

    if (normalized.length === 0) {
      return { badgeSeen: user.badgeSeen ?? [] };
    }

    const seen = new Set(user.badgeSeen ?? []);
    normalized.forEach((id) => seen.add(id));
    user.badgeSeen = Array.from(seen);
    await user.save();

    return { badgeSeen: user.badgeSeen };
  }

  // Grade quiz for a lesson and store best score
  async submitQuiz(
    userId: string,
    lessonId: string,
    answers: number[],
    clientTimezoneOffset?: number,
  ) {
    const now = new Date();
    const userObjectId = new Types.ObjectId(userId);

    const lesson = await this.lessonModel
      .findById(lessonId)
      .select('quiz module order')
      .exec();

    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    await this.ensureUnlocked(userObjectId, lesson);

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
    const feedback = quiz.map((question, index) => {
      const selectedOptionIndex = answers[index];
      const isCorrect = selectedOptionIndex === question.correctOptionIndex;
      if (isCorrect) {
        correctAnswers += 1;
      }

      return {
        questionIndex: index,
        selectedOptionIndex,
        correctOptionIndex: question.correctOptionIndex,
        isCorrect,
        explanation: question.explanation ?? null,
      };
    });

    const scorePercent = Math.round(
      (correctAnswers / quiz.length) * 100,
    );
    const passed = scorePercent >= PASSING_SCORE_PERCENT;

    const lessonObjectId = new Types.ObjectId(lessonId);
    const existing = await this.progressModel.findOne({
      userId: userObjectId,
      lessonId: lessonObjectId,
    });

    const bestScore = Math.max(existing?.bestScore ?? 0, scorePercent);
    const bestCorrectAnswers = Math.max(existing?.bestCorrectAnswers ?? 0, correctAnswers);
    const quizPassed = (existing?.quizPassed ?? false) || passed;
    const completed = quizPassed
      ? true
      : existing?.completed ?? false;
    const completedAt =
      completed && !existing?.completedAt
        ? now
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
        bestCorrectAnswers,
        lastScore: scorePercent,
        quizPassed,
        lastQuizAttemptAt: now,
        completed,
        completedAt,
      },
      { new: true, upsert: true },
    );

    const user = await this.userModel.findById(userObjectId).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const timezoneOffsetMinutes = this.resolveTimezoneOffset(user, clientTimezoneOffset);
    this.processStreakRollovers(user, now, timezoneOffsetMinutes);
    this.ensureHeartsFresh(user, now);

    const previousBestCorrectAnswers = existing?.bestCorrectAnswers ?? 0;
    const newlyImprovedCorrectAnswers = Math.max(0, correctAnswers - previousBestCorrectAnswers);
    const bonusThreshold = Math.ceil(quiz.length * 0.75);
    const earnedBonus = correctAnswers >= bonusThreshold && (existing?.bestScore ?? 0) < 75;
    const bonusXpAwarded = earnedBonus ? QUIZ_BONUS_XP : 0;
    const xpAwarded = newlyImprovedCorrectAnswers * QUIZ_CORRECT_XP + bonusXpAwarded;

    user.xp = (user.xp ?? 0) + xpAwarded;
    user.correctQuizAnswers = (user.correctQuizAnswers ?? 0) + correctAnswers;
    const wrongAnswers = Math.max(0, quiz.length - correctAnswers);
    user.hearts = Math.max(0, (user.hearts ?? DEFAULT_MAX_HEARTS) - wrongAnswers);

    const todayKey = this.getDateKeyWithOffset(now, timezoneOffsetMinutes);
    const lastQuizAttemptKey = existing?.lastQuizAttemptAt
      ? this.getDateKeyWithOffset(existing.lastQuizAttemptAt, timezoneOffsetMinutes)
      : null;
    const quizDelta = lastQuizAttemptKey === todayKey ? 0 : 1;
    const activity = this.recordDailyActivity(user, now, timezoneOffsetMinutes, {
      quizzesCompleted: quizDelta,
      xpEarned: xpAwarded,
    });
    const streakCelebration = this.buildStreakCelebration(user, activity.record, activity.streakAwarded);

    const newBadges: string[] = [];
    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);
    await user.save();

    return {
      totalQuestions: quiz.length,
      correctAnswers,
      scorePercent,
      passed,
      bestScore,
      xpAwarded,
      bonusXpAwarded,
      freezeUsed: activity.record.freezeUsed,
      feedback,
      newBadges,
      streakCelebration,
      gamification: this.gamificationSnapshot(user),
    };
  }
}
