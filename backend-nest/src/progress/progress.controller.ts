import {
  Body,
  Controller,
  Get,
  Headers,
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
  completeLesson(
    @Req() req,
    @Param('lessonId') lessonId: string,
    @Headers('x-client-tz-offset') tzOffset?: string,
  ) {
    const parsedOffset = Number(tzOffset);
    return this.progressService.completeLesson(
      req.userId,
      lessonId,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
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
  getGamification(@Req() req, @Headers('x-client-tz-offset') tzOffset?: string) {
    const parsedOffset = Number(tzOffset);
    return this.progressService.getGamificationSummary(
      req.userId,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    );
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
    @Headers('x-client-tz-offset') tzOffset?: string,
  ) {
    const parsedOffset = Number(tzOffset);
    return this.progressService.submitQuiz(
      req.userId,
      lessonId,
      answers,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    );
  }

  @UseGuards(AuthGuard)
  @Post('flashcard/:lessonId')
  submitFlashcardView(
    @Req() req,
    @Param('lessonId') lessonId: string,
    @Body('count') count?: number,
    @Headers('x-client-tz-offset') tzOffset?: string,
  ) {
    const parsedOffset = Number(tzOffset);
    return this.progressService.recordFlashcardView(
      req.userId,
      lessonId,
      count,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    );
  }

  @UseGuards(AuthGuard)
  @Post('badges/seen')
  markBadgesSeen(@Req() req, @Body('badges') badges: string[]) {
    return this.progressService.markBadgesSeen(req.userId, badges);
  }
}
