import { Controller, Get, Headers, Req, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { LearnService } from './learn.service';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @UseGuards(OptionalAuthGuard)
  @Get('flow')
  getFlow(@Req() req, @Headers('x-client-tz-offset') tzOffset?: string) {
    const parsedOffset = Number(tzOffset);
    return this.learnService.getFlow(
      req.userId,
      Number.isFinite(parsedOffset) ? parsedOffset : undefined,
    );
  }
}
