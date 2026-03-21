import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { LearnService } from './learn.service';

@Controller('learn')
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @UseGuards(OptionalAuthGuard)
  @Get('flow')
  getFlow(@Req() req) {
    return this.learnService.getFlow(req.userId);
  }
}
