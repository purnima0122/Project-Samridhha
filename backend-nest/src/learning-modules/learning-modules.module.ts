import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  LearningModule,
  LearningModuleSchema,
} from './schemas/learning-module.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: LearningModule.name, schema: LearningModuleSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class LearningModulesModule {}
