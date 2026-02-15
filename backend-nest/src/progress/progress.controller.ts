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
}
