import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/auth/schemas/user.schema';
import { Lesson, LessonSchema } from 'src/lesson/schemas/lesson.schema';
import { Progress, ProgressSchema } from 'src/progress/schemas/progress.schema';
import { RegulatorController } from './regulator.controller';
import { RegulatorService } from './regulator.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Progress.name, schema: ProgressSchema },
      { name: Lesson.name, schema: LessonSchema },
    ]),
  ],
  controllers: [RegulatorController],
  providers: [RegulatorService],
})
export class RegulatorModule {}
