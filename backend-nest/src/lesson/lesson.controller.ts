import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LessonService } from './lesson.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { AdminGuard } from 'src/guards/admin.guard';
import { CreateLessonDto } from './dtos/create-lesson.dto';
import { UpdateLessonDto } from './dtos/update-lesson.dto';

@Controller('lessons')
export class LessonController {
  constructor(private readonly lessonService: LessonService) {}

  @Get()
  async getAll(
    @Query('module') module: string,
    @Req() req,
  ) {
    console.log('Logged-in user:', req.userId);//this should work 

    if (module) {
      return this.lessonService.findByModule(module);
    }
    return this.lessonService.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return this.lessonService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  async create(@Body() body: CreateLessonDto) {
    return this.lessonService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() body: UpdateLessonDto) {
    const updated = await this.lessonService.update(id, body);
    if (!updated) {
      throw new NotFoundException('Lesson not found');
    }
    return updated;
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  async remove(@Param('id') id: string) {
    return this.lessonService.remove(id);
  }

  @Post(':id/quiz')
  @UseGuards(AuthGuard, AdminGuard)
  async addQuizQuestion(
    @Param('id') id: string,
    @Body()
    body: {
      prompt: string;
      options: string[];
      correctOptionIndex: number;
      explanation?: string;
    },
  ) {
    const lesson = await this.lessonService.addQuizQuestion(id, body);
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    return lesson;
  }

  @Patch(':id/quiz/:index')
  @UseGuards(AuthGuard, AdminGuard)
  async updateQuizQuestion(
    @Param('id') id: string,
    @Param('index') index: string,
    @Body()
    body: Partial<{
      prompt: string;
      options: string[];
      correctOptionIndex: number;
      explanation?: string;
    }>,
  ) {
    const lesson = await this.lessonService.updateQuizQuestion(
      id,
      Number(index),
      body,
    );
    if (!lesson) {
      throw new NotFoundException('Lesson or quiz question not found');
    }
    return lesson;
  }

  @Delete(':id/quiz/:index')
  @UseGuards(AuthGuard, AdminGuard)
  async removeQuizQuestion(
    @Param('id') id: string,
    @Param('index') index: string,
  ) {
    const lesson = await this.lessonService.removeQuizQuestion(
      id,
      Number(index),
    );
    if (!lesson) {
      throw new NotFoundException('Lesson or quiz question not found');
    }
    return lesson;
  }
}
