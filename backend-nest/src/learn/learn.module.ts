import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Lesson, LessonSchema } from 'src/lesson/schemas/lesson.schema';
import {
  LearningModule,
  LearningModuleSchema,
} from 'src/learning-modules/schemas/learning-module.schema';
import { ProgressModule } from 'src/progress/progress.module';
import { OptionalAuthGuard } from 'src/guards/optional-auth.guard';
import { LearnController } from './learn.controller';
import { LearnService } from './learn.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Lesson.name, schema: LessonSchema },
      { name: LearningModule.name, schema: LearningModuleSchema },
    ]),
    ProgressModule,
  ],
  controllers: [LearnController],
  providers: [LearnService, OptionalAuthGuard],
})
export class LearnModule {}
