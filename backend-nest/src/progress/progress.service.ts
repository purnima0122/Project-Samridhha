import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Progress, ProgressDocument } from './schemas/progress.schema';
import { Lesson, LessonDocument } from '../lesson/schemas/lesson.schema';
import { BadgeProgress, User } from '../auth/schemas/user.schema';

const LESSON_COMPLETION_XP = 20;
const UNIT_COMPLETION_XP = 50;
const COURSE_COMPLETION_XP = 200;
const FLASHCARD_VIEW_XP = 2;
const QUIZ_CORRECT_XP = 5;
const MAX_FLASHCARDS_PER_LESSON = 4;
const PASSING_SCORE_PERCENT = 70;
const LEVEL_XP_STEP = 120;
const QUIZ_BONUS_XP = 15;
const MAX_ACTIVITY_DAYS = 35;
const DEFAULT_MAX_HEARTS = 5;

type StreakStatus = 'active' | 'at_risk' | 'freeze_used' | 'streak_lost';

type BadgeDefinition = {
  badgeId: string;
  name: string;
  description: string;
  icon: string;
};

type BadgeSummary = BadgeDefinition & {
  earnedAt: Date;
  seen: boolean;
};

type StreakReconciliation = {
  changed: boolean;
  status: StreakStatus;
};

const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
  first_lesson: {
    badgeId: 'first_lesson',
    name: 'First Step',
    description: 'Complete your first lesson.',
    icon: '🌱',
  },
  lessons_5: {
    badgeId: 'lessons_5',
    name: 'Momentum Builder',
    description: 'Complete 5 lessons.',
    icon: '🏃',
  },
  lessons_10: {
    badgeId: 'lessons_10',
    name: 'Knowledge Seeker',
    description: 'Complete 10 lessons.',
    icon: '📚',
  },
  streak_7: {
    badgeId: 'streak_7',
    name: 'Week Warrior',
    description: 'Reach a 7-day streak.',
    icon: '🔥',
  },
  streak_14_refill: {
    badgeId: 'streak_14_refill',
    name: 'Freeze Refill',
    description: 'Reach 14 streak days after using a freeze.',
    icon: '🧊',
  },
  streak_30: {
    badgeId: 'streak_30',
    name: 'Monthly Master',
    description: 'Reach a 30-day streak.',
    icon: '⚡',
  },
  quiz_50: {
    badgeId: 'quiz_50',
    name: 'Quiz Ace',
    description: 'Answer 50 quiz questions correctly.',
    icon: '🎯',
  },
  course_completed: {
    badgeId: 'course_completed',
    name: 'Course Completed',
    description: 'Finish every published lesson.',
    icon: '🎓',
  },
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

  private isSameDay(left?: Date | null, right?: Date | null): boolean {
    if (!left || !right) {
      return false;
    }

    return this.getDayStart(left).getTime() === this.getDayStart(right).getTime();
  }

  private getDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private appendLearningDay(user: User, now: Date) {
    const todayKey = this.getDateKey(now);
    const existing = user.learningActivityDates ?? [];
    if (!existing.includes(todayKey)) {
      user.learningActivityDates = [...existing, todayKey].slice(-MAX_ACTIVITY_DAYS);
    }
  }

  private getCurrentWeekProgress(user: User, now: Date) {
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const activity = new Set(user.learningActivityDates ?? []);

    return labels.map((label, index) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + index);
      const dateKey = this.getDateKey(date);
      const isToday = this.getDateKey(now) === dateKey;
      const completed = activity.has(dateKey);

      return {
        label,
        date: dateKey,
        completed,
        isToday,
        status: completed ? 'done' : date > now ? 'locked' : isToday ? 'today' : 'missed',
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

  private normalizeLegacyBadgeId(label: string): string {
    if (!label?.trim()) {
      return '';
    }

    switch (label) {
      case 'First Lesson Completed':
        return 'first_lesson';
      case '5 Lessons Completed':
        return 'lessons_5';
      case '7 Day Streak':
        return 'streak_7';
      case '14 Day Streak Freeze Refill':
        return 'streak_14_refill';
      case '30 Day Streak':
        return 'streak_30';
      case '50 Quiz Questions Correct':
        return 'quiz_50';
      case 'Course Completed':
        return 'course_completed';
      default:
        if (label.startsWith('Unit Completed: ')) {
          return `unit_${label.slice('Unit Completed: '.length)}`;
        }
        if (label.startsWith('Chapter Badge: ')) {
          return `unit_${label.slice('Chapter Badge: '.length)}`;
        }
        return label;
    }
  }

  private ensureBadgeRecords(user: User): { badges: BadgeProgress[]; changed: boolean } {
    const rawBadges = Array.isArray((user as any).badges) ? ((user as any).badges as any[]) : [];
    const deduped = new Map<string, BadgeProgress>();
    let changed = !Array.isArray((user as any).badges);

    for (const entry of rawBadges) {
      let badgeId = '';
      let earnedAt = new Date();
      let seen = true;

      if (typeof entry === 'string') {
        badgeId = this.normalizeLegacyBadgeId(entry);
        changed = true;
      } else if (entry && typeof entry === 'object') {
        badgeId =
          typeof entry.badgeId === 'string' && entry.badgeId.trim()
            ? entry.badgeId.trim()
            : this.normalizeLegacyBadgeId(entry.name ?? '');
        earnedAt = entry.earnedAt ? new Date(entry.earnedAt) : new Date();
        seen = typeof entry.seen === 'boolean' ? entry.seen : true;
        if (!entry.earnedAt || typeof entry.seen !== 'boolean') {
          changed = true;
        }
      } else {
        changed = true;
      }

      if (!badgeId) {
        continue;
      }

      const existing = deduped.get(badgeId);
      if (!existing) {
        deduped.set(
          badgeId,
          {
            badgeId,
            earnedAt,
            seen,
          } as BadgeProgress,
        );
        continue;
      }

      existing.earnedAt =
        existing.earnedAt.getTime() <= earnedAt.getTime() ? existing.earnedAt : earnedAt;
      existing.seen = existing.seen && seen;
      changed = true;
    }

    const badges = Array.from(deduped.values()).sort(
      (left, right) => left.earnedAt.getTime() - right.earnedAt.getTime(),
    );

    if (changed || badges.length !== rawBadges.length) {
      user.badges = badges as BadgeProgress[];
      changed = true;
    }

    return {
      badges: (user.badges ?? []) as BadgeProgress[],
      changed,
    };
  }

  private hasBadge(user: User, badgeId: string): boolean {
    const { badges } = this.ensureBadgeRecords(user);
    return badges.some((entry) => entry.badgeId === badgeId);
  }

  private getBadgeDefinition(badgeId: string): BadgeDefinition {
    if (BADGE_DEFINITIONS[badgeId]) {
      return BADGE_DEFINITIONS[badgeId];
    }

    if (badgeId.startsWith('unit_')) {
      const moduleName = badgeId.slice('unit_'.length);
      return {
        badgeId,
        name: `${moduleName} Champ`,
        description: `Complete ${moduleName}.`,
        icon: '🏆',
      };
    }

    return {
      badgeId,
      name: badgeId.replace(/_/g, ' '),
      description: 'Badge earned.',
      icon: '🏅',
    };
  }

  private toBadgeSummary(badge: BadgeProgress): BadgeSummary {
    return {
      ...this.getBadgeDefinition(badge.badgeId),
      earnedAt: badge.earnedAt,
      seen: badge.seen,
    };
  }

  private awardBadge(user: User, badgeId: string, newBadges: BadgeSummary[]) {
    const { badges } = this.ensureBadgeRecords(user);
    if (badges.some((entry) => entry.badgeId === badgeId)) {
      return;
    }

    const badge = {
      badgeId,
      earnedAt: new Date(),
      seen: false,
    } as BadgeProgress;

    user.badges = [...badges, badge] as BadgeProgress[];
    newBadges.push(this.toBadgeSummary(badge));
  }

  private getUnseenBadges(user: User): BadgeSummary[] {
    const { badges } = this.ensureBadgeRecords(user);
    return badges
      .filter((entry) => !entry.seen)
      .sort((left, right) => left.earnedAt.getTime() - right.earnedAt.getTime())
      .map((entry) => this.toBadgeSummary(entry));
  }

  private applyFreezeRefillMilestones(user: User, newBadges: BadgeSummary[]) {
    const maxFreezes = user.maxStreakFreezes ?? 3;
    const currentFreezes = user.streakFreezes ?? 0;
    const streakDays = user.streakDays ?? 0;
    const freezeUsed = (user.streakFreezeUsedCount ?? 0) > 0;

    const rewards: Array<{ minDays: number; freeze: number; badgeId: string; requiresFreezeUse?: boolean }> = [
      { minDays: 7, freeze: 1, badgeId: 'streak_7' },
      { minDays: 14, freeze: 1, badgeId: 'streak_14_refill', requiresFreezeUse: true },
      { minDays: 30, freeze: 2, badgeId: 'streak_30' },
    ];

    let updatedFreezes = currentFreezes;
    for (const reward of rewards) {
      if (streakDays < reward.minDays) {
        continue;
      }
      if (reward.requiresFreezeUse && !freezeUsed) {
        continue;
      }
      if (this.hasBadge(user, reward.badgeId)) {
        continue;
      }
      updatedFreezes = Math.min(maxFreezes, updatedFreezes + reward.freeze);
      this.awardBadge(user, reward.badgeId, newBadges);
    }

    user.streakFreezes = updatedFreezes;
  }

  private getLevel(xp: number): number {
    return Math.floor(Math.max(0, xp) / LEVEL_XP_STEP) + 1;
  }

  private applyMilestoneBadges(user: User, newBadges: BadgeSummary[]) {
    if ((user.lessonsCompletedCount ?? 0) >= 1) {
      this.awardBadge(user, 'first_lesson', newBadges);
    }

    if ((user.lessonsCompletedCount ?? 0) >= 5) {
      this.awardBadge(user, 'lessons_5', newBadges);
    }

    if ((user.lessonsCompletedCount ?? 0) >= 10) {
      this.awardBadge(user, 'lessons_10', newBadges);
    }

    if ((user.correctQuizAnswers ?? 0) >= 50) {
      this.awardBadge(user, 'quiz_50', newBadges);
    }
  }

  private getCurrentStreakStatus(user: User, now: Date): StreakStatus {
    if (this.isSameDay(user.lastLessonDate, now)) {
      return 'active';
    }

    const lastActivity = user.lastActivityDate ?? user.lastLessonDate ?? user.lastLearningAt;
    if (!lastActivity) {
      return 'active';
    }

    const diff = this.diffInDays(lastActivity, now);
    if (diff <= 0) {
      return 'active';
    }

    if (diff === 1) {
      return 'at_risk';
    }

    return (user.streakDays ?? 0) > 0 ? 'streak_lost' : 'active';
  }

  private getStreakMessage(user: User, status: StreakStatus, now: Date): string {
    if (status === 'freeze_used') {
      return 'A freeze saved your streak today.';
    }

    if (status === 'streak_lost') {
      return 'Start fresh today with a lesson.';
    }

    if (this.isSameDay(user.lastLessonDate, now)) {
      return 'You finished a lesson today. Keep going!';
    }

    if (status === 'at_risk') {
      return 'Finish a lesson today to protect your streak.';
    }

    return 'Do not forget me today!';
  }

  private gamificationSnapshot(user: User, status?: StreakStatus) {
    const xp = user.xp ?? 0;
    const progressInLevel = xp % LEVEL_XP_STEP;
    const now = new Date();
    this.ensureHeartsFresh(user, now);
    const streakStatus = status ?? this.getCurrentStreakStatus(user, now);
    return {
      xp,
      level: this.getLevel(xp),
      streakDays: user.streakDays ?? 0,
      streakFreezes: user.streakFreezes ?? 2,
      maxStreakFreezes: user.maxStreakFreezes ?? 3,
      badges: this.ensureBadgeRecords(user).badges.map((entry) => entry.badgeId),
      badgeDetails: this.ensureBadgeRecords(user).badges.map((entry) => this.toBadgeSummary(entry)),
      unseenBadgeCount: this.getUnseenBadges(user).length,
      hearts: user.hearts ?? DEFAULT_MAX_HEARTS,
      maxHearts: user.maxHearts ?? DEFAULT_MAX_HEARTS,
      lessonsCompletedCount: user.lessonsCompletedCount ?? 0,
      correctQuizAnswers: user.correctQuizAnswers ?? 0,
      xpToNextLevel: LEVEL_XP_STEP - progressInLevel,
      weeklyProgress: this.getCurrentWeekProgress(user, now),
      streakStatus,
      streakMessage: this.getStreakMessage(user, streakStatus, now),
    };
  }

  private reconcileDailyStreak(user: User, now: Date): StreakReconciliation {
    const today = this.getDayStart(now);
    const lastActivity = user.lastActivityDate ?? user.lastLessonDate ?? user.lastLearningAt;

    if (!lastActivity) {
      return { changed: false, status: 'active' };
    }

    const dayDiff = this.diffInDays(lastActivity, today);

    if (dayDiff <= 0) {
      return { changed: false, status: 'active' };
    }

    if (dayDiff === 1) {
      return { changed: false, status: 'at_risk' };
    }

    if (dayDiff === 2) {
      if ((user.streakFreezes ?? 0) > 0) {
        user.streakFreezes = Math.max(0, (user.streakFreezes ?? 0) - 1);
        user.streakFreezeUsedCount = (user.streakFreezeUsedCount ?? 0) + 1;
        user.lastActivityDate = today;
        user.lastLearningAt = today;
        return { changed: true, status: 'freeze_used' };
      }

      user.streakDays = 0;
      user.lastActivityDate = today;
      user.lastLearningAt = today;
      return { changed: true, status: 'streak_lost' };
    }

    user.streakDays = 0;
    user.lastActivityDate = today;
    user.lastLearningAt = today;
    return { changed: true, status: 'streak_lost' };
  }

  private buildStreakCheckResponse(user: User, status: StreakStatus) {
    return {
      streak: user.streakDays ?? 0,
      freezes: user.streakFreezes ?? 2,
      maxFreezes: user.maxStreakFreezes ?? 3,
      status,
      lessonCompletedToday: this.isSameDay(user.lastLessonDate, new Date()),
      showSadEmoji: status === 'streak_lost' && (user.streakFreezes ?? 0) === 0,
      gamification: this.gamificationSnapshot(user, status),
    };
  }

  private buildUnitBadgeId(moduleName: string): string {
    return `unit_${moduleName}`;
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

  async checkAndUpdateStreak(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const badgeNormalization = this.ensureBadgeRecords(user);
    const streakMeta = this.reconcileDailyStreak(user, new Date());

    if (badgeNormalization.changed || streakMeta.changed) {
      await user.save();
    }

    return this.buildStreakCheckResponse(user, streakMeta.status);
  }

  async checkBadges(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const newBadges: BadgeSummary[] = [];
    const badgeNormalization = this.ensureBadgeRecords(user);
    const streakMeta = this.reconcileDailyStreak(user, new Date());
    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);

    if (badgeNormalization.changed || streakMeta.changed || newBadges.length > 0) {
      await user.save();
    }

    return this.getUnseenBadges(user);
  }

  async markBadgeSeen(userId: string, badgeId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { badges, changed } = this.ensureBadgeRecords(user);
    const badge = badges.find((entry) => entry.badgeId === badgeId);

    if (!badge) {
      throw new NotFoundException('Badge not found');
    }

    if (!badge.seen) {
      badge.seen = true;
      user.badges = badges as BadgeProgress[];
      await user.save();
    } else if (changed) {
      await user.save();
    }

    return { success: true };
  }

  // Called when user completes a lesson
  async completeLesson(userId: string, lessonId: string) {
    const now = new Date();
    const today = this.getDayStart(now);
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

    this.ensureBadgeRecords(user);
    this.ensureHeartsFresh(user, now);
    const streakMeta = this.reconcileDailyStreak(user, now);
    const lessonCompletedToday = this.isSameDay(user.lastLessonDate, today);
    let xpAwarded = 0;
    const newBadges: BadgeSummary[] = [];

    if (!lessonCompletedToday) {
      user.streakDays = (user.streakDays ?? 0) + 1;
      user.lastLessonDate = today;
      user.lastActivityDate = today;
      user.lastLearningAt = today;
      this.appendLearningDay(user, now);
    }

    if (!wasCompleted) {
      user.lessonsCompletedCount = (user.lessonsCompletedCount ?? 0) + 1;
      user.xp = (user.xp ?? 0) + LESSON_COMPLETION_XP;
      xpAwarded += LESSON_COMPLETION_XP;

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

      if (moduleLessonIds.length > 0 && completedInModule === moduleLessonIds.length) {
        const unitBadge = this.buildUnitBadgeId(lesson.module);
        if (!this.hasBadge(user, unitBadge)) {
          user.xp = (user.xp ?? 0) + UNIT_COMPLETION_XP;
          xpAwarded += UNIT_COMPLETION_XP;
          this.awardBadge(user, unitBadge, newBadges);
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
        !this.hasBadge(user, 'course_completed')
      ) {
        user.xp = (user.xp ?? 0) + COURSE_COMPLETION_XP;
        xpAwarded += COURSE_COMPLETION_XP;
        this.awardBadge(user, 'course_completed', newBadges);
      }
    }

    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);
    await user.save();

    const status = streakMeta.status === 'freeze_used' ? 'freeze_used' : 'active';

    return {
      progress,
      xpAwarded,
      freezeUsed: streakMeta.status === 'freeze_used',
      streakStatus: status,
      newBadges,
      gamification: this.gamificationSnapshot(user, status),
    };
  }

  async recordFlashcardView(userId: string, lessonId: string, count = 1) {
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

    this.ensureBadgeRecords(user);
    this.ensureHeartsFresh(user, now);

    if (xpAwarded > 0) {
      user.xp = (user.xp ?? 0) + xpAwarded;
    }

    const newBadges: BadgeSummary[] = [];
    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);
    await user.save();

    return {
      grantedCount,
      xpAwarded,
      freezeUsed: false,
      streakStatus: this.getCurrentStreakStatus(user, now),
      newBadges,
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

  async getGamificationSummary(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userObjectId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const now = new Date();
    const badgeNormalization = this.ensureBadgeRecords(user);
    const heartsUpdated = this.ensureHeartsFresh(user, now);
    const streakMeta = this.reconcileDailyStreak(user, now);
    const newBadges: BadgeSummary[] = [];
    this.applyMilestoneBadges(user, newBadges);
    this.applyFreezeRefillMilestones(user, newBadges);

    if (badgeNormalization.changed || heartsUpdated || streakMeta.changed || newBadges.length > 0) {
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
      ...this.gamificationSnapshot(user, streakMeta.status),
      nextLessonId,
      nextLessonTitle,
      totalLessons,
      completedLessons,
      coursePercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
    };
  }

  // Grade quiz for a lesson and store best score
  async submitQuiz(
    userId: string,
    lessonId: string,
    answers: number[],
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

    this.ensureBadgeRecords(user);
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

    const newBadges: BadgeSummary[] = [];
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
      freezeUsed: false,
      streakStatus: this.getCurrentStreakStatus(user, now),
      feedback,
      newBadges,
      gamification: this.gamificationSnapshot(user),
    };
  }
}
