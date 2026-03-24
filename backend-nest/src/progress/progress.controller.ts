import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/guards/auth.guard';
import { ProgressService } from './progress.service';

@Controller('progress')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  // Start lesson (auto-create progress)
  @UseGuards(AuthGuard)
  @Post('start/:lessonId')
  startLesson(@Req() req, @Param('lessonId') lessonId: string) {
    return this.progressService.startLesson(
      req.userId,
      lessonId,
    );
  }

  // Mark lesson as completed
  @UseGuards(AuthGuard)
  @Post('complete/:lessonId')
  completeLesson(@Req() req, @Param('lessonId') lessonId: string) {
    return this.progressService.completeLesson(
      req.userId,
      lessonId,
    );
  }

  // Get logged-in user's progress
  @UseGuards(AuthGuard)
  @Get('me')
  getMyProgress(@Req() req) {
    return this.progressService.getUserProgress(req.userId);
  }

  @UseGuards(AuthGuard)
  @Get('gamification')
  getGamification(@Req() req) {
    return this.progressService.getGamificationSummary(req.userId);
  }

  @UseGuards(AuthGuard)
  @Get('check-streak')
  checkStreak(@Req() req) {
    return this.progressService.checkAndUpdateStreak(req.userId);
  }

  @UseGuards(AuthGuard)
  @Get('badges/check')
  checkBadges(@Req() req) {
    return this.progressService.checkBadges(req.userId);
  }

  @UseGuards(AuthGuard)
  @Post('badges/:badgeId/seen')
  markBadgeSeen(@Req() req, @Param('badgeId') badgeId: string) {
    return this.progressService.markBadgeSeen(req.userId, badgeId);
  }

  // Summary for progress bars
  @UseGuards(AuthGuard)
  @Get('summary')
  getMySummary(
    @Req() req,
    @Query('module') module?: string,
  ) {
    return this.progressService.getProgressSummary(
      req.userId,
      module,
    );
  }

  // Submit quiz answers (array of option indices)
  @UseGuards(AuthGuard)
  @Post('quiz/:lessonId')
  submitQuiz(
    @Req() req,
    @Param('lessonId') lessonId: string,
    @Body('answers') answers: number[],
  ) {
    return this.progressService.submitQuiz(
      req.userId,
      lessonId,
      answers,
    );
  }

  @UseGuards(AuthGuard)
  @Post('flashcard/:lessonId')
  submitFlashcardView(
    @Req() req,
    @Param('lessonId') lessonId: string,
    @Body('count') count?: number,
  ) {
    return this.progressService.recordFlashcardView(
      req.userId,
      lessonId,
      count,
    );
  }
}
