import { Module } from '@nestjs/common';
import { ProgressService } from './progress.service';
import { ProgressController } from './progress.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Progress, ProgressSchema } from './schemas/progress.schema';
import { Lesson, LessonSchema } from '../lesson/schemas/lesson.schema';
import { AuthGuard } from 'src/guards/auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Progress.name, schema: ProgressSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
  ],
  providers: [ProgressService, AuthGuard],
  controllers: [ProgressController],
})
export class ProgressModule {}
