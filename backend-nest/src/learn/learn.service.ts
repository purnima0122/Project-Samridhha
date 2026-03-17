import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Lesson, LessonDocument } from 'src/lesson/schemas/lesson.schema';
import { ProgressService } from 'src/progress/progress.service';
import {
  LearningModule,
  LearningModuleDocument,
} from 'src/learning-modules/schemas/learning-module.schema';

const COLOR_POOL = [
  { color: '#F59E0B', darkColor: '#B45309' },
  { color: '#3B82F6', darkColor: '#1D4ED8' },
  { color: '#10B981', darkColor: '#065F46' },
  { color: '#8B5CF6', darkColor: '#6D28D9' },
  { color: '#F97316', darkColor: '#C2410C' },
];

const MODULE_EMOJI = ['💰', '🏦', '📊', '🧠', '🚀', '📚'];

const ICON_EMOJI: Record<string, string> = {
  BookOpen: '📘',
  TrendingUp: '📈',
  Shield: '🛡️',
  PieChart: '🥧',
  HelpCircle: '❓',
};

const DEFAULT_GAMIFICATION = {
  xp: 0,
  level: 1,
  streakDays: 0,
  streakFreezes: 0,
  maxStreakFreezes: 3,
  badges: [],
  badgeSeen: [],
  streakHistory: [],
  hearts: 5,
  maxHearts: 5,
  lessonsCompletedCount: 0,
  correctQuizAnswers: 0,
  xpToNextLevel: 120,
  weeklyProgress: [],
  streakMessage: 'Finish a lesson and a quiz today',
};

@Injectable()
export class LearnService {
  constructor(
    @InjectModel(Lesson.name)
    private readonly lessonModel: Model<LessonDocument>,
    @InjectModel(LearningModule.name)
    private readonly moduleModel: Model<LearningModuleDocument>,
    private readonly progressService: ProgressService,
  ) {}

  private splitLessonIntoCards(content?: string) {
    if (!content) return [];
    const rawSegments = content
      .split('\n')
      .flatMap((line) => line.split(/(?<=[.!?])\s+/))
      .map((item) => item.trim())
      .filter((item) => item.length > 15);

    const normalized = rawSegments
      .map((item) =>
        item
          .replace(/^[\u2022\-]\s*/, '')
          .replace(/^Concept Card \d+:\s*/i, '')
          .replace(/^Module \d+:\s*/i, '')
          .trim(),
      )
      .map((item) => {
        if (!item.includes('?')) {
          return item;
        }
        const questionSplit = item.split(/\?\s*/, 2);
        if (questionSplit.length > 1 && questionSplit[1].trim().length > 10) {
          return questionSplit[1].trim();
        }
        return '';
      })
      .filter((item) => item.length > 15 && !item.endsWith('?'))
      .filter((item) => !/^(what|why|how|when|where|who)\b/i.test(item));

    return Array.from(new Set(normalized)).slice(0, 4);
  }

  private buildFlashcards(content?: string) {
    const cards = this.splitLessonIntoCards(content);
    return cards.map((text, index) => ({
      id: index + 1,
      prompt: text,
      answer: text,
      tag: `Concept ${index + 1}`,
    }));
  }

  private buildVaultFacts(lessons: LessonDocument[]) {
    const statements = lessons.flatMap((lesson) =>
      this.splitLessonIntoCards(lesson.content || ''),
    );
    const unique = Array.from(new Set(statements)).slice(0, 3);
    const icons = ['🗂️', '✨', '🧠'];

    return unique.map((body, index) => ({
      icon: icons[index % icons.length],
      title: `Key Insight ${index + 1}`,
      body,
    }));
  }

  private getModuleTagline(lesson?: LessonDocument) {
    if (!lesson?.content) {
      return 'Level up your money skills';
    }
    const firstSentence = lesson.content.split(/(?<=[.!?])\s+/)[0];
    return firstSentence?.slice(0, 60) || 'Level up your money skills';
  }

  private darkenColor(color?: string) {
    if (!color || !color.startsWith('#') || color.length !== 7) {
      return '#1D4ED8';
    }
    const toChannel = (value: number) =>
      Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
    const r = parseInt(color.slice(1, 3), 16) - 40;
    const g = parseInt(color.slice(3, 5), 16) - 40;
    const b = parseInt(color.slice(5, 7), 16) - 40;
    return `#${toChannel(r)}${toChannel(g)}${toChannel(b)}`;
  }

  private mapQuiz(quiz?: LessonDocument['quiz']) {
    return (quiz || []).map((item) => ({
      q: item.prompt,
      opts: item.options,
      ans: item.correctOptionIndex,
      exp: item.explanation || 'Keep learning',
    }));
  }

  async getFlow(userId?: string, clientTimezoneOffset?: number) {
    const [modules, lessons] = await Promise.all([
      this.moduleModel
        .find({ isPublished: true })
        .sort({ order: 1 })
        .exec(),
      this.lessonModel
        .find({ isPublished: true })
        .sort({ module: 1, order: 1 })
        .exec(),
    ]);

    const moduleMap = new Map<string, LearningModuleDocument>();
    modules.forEach((module) => moduleMap.set(module.title, module));

    const grouped = lessons.reduce<Record<string, LessonDocument[]>>(
      (acc, lesson) => {
        const key = lesson.module || 'General';
        if (!acc[key]) acc[key] = [];
        acc[key].push(lesson);
        return acc;
      },
      {},
    );

    const moduleKeys = Array.from(
      new Set([...moduleMap.keys(), ...Object.keys(grouped)]),
    );

    moduleKeys.sort((a, b) => {
      const moduleA = moduleMap.get(a);
      const moduleB = moduleMap.get(b);
      const aOrder = moduleA?.order ?? Math.min(...(grouped[a] || []).map((l) => l.order || 0));
      const bOrder = moduleB?.order ?? Math.min(...(grouped[b] || []).map((l) => l.order || 0));
      return aOrder - bOrder;
    });

    const chapters = moduleKeys.map((moduleKey, index) => {
      const module = moduleMap.get(moduleKey);
      const lessonsInModule = (grouped[moduleKey] || []).slice().sort(
        (a, b) => (a.order || 0) - (b.order || 0),
      );

      const colorFallback = lessonsInModule[0]?.color || COLOR_POOL[index % COLOR_POOL.length].color;
      const darkFallback = this.darkenColor(colorFallback);
      const color = module?.color || colorFallback;
      const darkColor = module?.darkColor || darkFallback;
      const emoji = module?.emoji || MODULE_EMOJI[index % MODULE_EMOJI.length];
      const tagline = module?.tagline || this.getModuleTagline(lessonsInModule[0]);

      const quests = lessonsInModule.map((lesson) => {
        const isVault = lesson.type === 'vault';
        const questEmoji = lesson.emoji || ICON_EMOJI[lesson.icon] || '📘';
        const flashcards =
          lesson.flashcards && lesson.flashcards.length > 0
            ? lesson.flashcards.map((card, idx) => ({
                id: idx + 1,
                prompt: card.prompt,
                answer: card.answer,
                tag: card.tag || `Concept ${idx + 1}`,
              }))
            : this.buildFlashcards(lesson.content);
        const facts =
          lesson.facts && lesson.facts.length > 0
            ? lesson.facts
            : isVault
              ? this.buildVaultFacts(lessonsInModule)
              : [];

        return {
          id: String(lesson._id),
          title: lesson.title,
          icon: lesson.icon ?? null,
          emoji: questEmoji,
          type: isVault ? 'vault' : 'lesson',
          order: lesson.order || 0,
          xp: lesson.xp || (isVault ? 20 : 50),
          flashcards: isVault ? [] : flashcards,
          quiz: isVault ? [] : this.mapQuiz(lesson.quiz),
          facts,
        };
      });

      const hasVault = quests.some((quest) => quest.type === 'vault');
      if (!hasVault && lessonsInModule.length > 0) {
        quests.push({
          id: `vault:${moduleKey}`,
          title: 'Mind Vault',
          icon: 'Shield',
          emoji: '🔮',
          type: 'vault',
          order: 999,
          xp: 20,
          flashcards: [],
          quiz: [],
          facts: this.buildVaultFacts(lessonsInModule),
        });
      }

      return {
        id: index + 1,
        title: moduleKey,
        emoji,
        color,
        darkColor,
        tagline,
        xpTotal: quests.reduce((sum, quest) => sum + (quest.xp || 0), 0),
        quests,
      };
    });

    const progress = userId
      ? await this.progressService.getUserProgress(userId)
      : [];
    const gamification = userId
      ? await this.progressService.getGamificationSummary(userId, clientTimezoneOffset)
      : DEFAULT_GAMIFICATION;

    return {
      chapters,
      progress,
      gamification,
    };
  }
}


