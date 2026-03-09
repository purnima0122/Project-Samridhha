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
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from 'src/guards/admin.guard';
import { AuthGuard } from 'src/guards/auth.guard';
import { CreateNewsDto } from './dtos/create-news.dto';
import { UpdateNewsDto } from './dtos/update-news.dto';
import { NewsService } from './news.service';

@Controller('news')
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  getPublicNews() {
    return this.newsService.findPublic();
  }

  @Get('admin/all')
  @UseGuards(AuthGuard, AdminGuard)
  getAllForAdmin(@Query('q') q?: string) {
    return this.newsService.findAllForAdmin(q);
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  create(@Body() body: CreateNewsDto) {
    return this.newsService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() body: UpdateNewsDto) {
    const updated = await this.newsService.update(id, body);
    if (!updated) {
      throw new NotFoundException('News item not found');
    }
    return updated;
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.newsService.remove(id);
  }
}
