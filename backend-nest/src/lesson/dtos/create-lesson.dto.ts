import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CreateQuizQuestionDto {
  @IsString()
  prompt: string;

  @IsArray()
  @IsString({ each: true })
  options: string[];

  @IsInt()
  @Min(0)
  correctOptionIndex: number;

  @IsOptional()
  @IsString()
  explanation?: string;
}

class CreateFlashcardDto {
  @IsString()
  prompt: string;

  @IsString()
  answer: string;

  @IsOptional()
  @IsString()
  tag?: string;
}

class CreateVaultFactDto {
  @IsString()
  icon: string;

  @IsString()
  title: string;

  @IsString()
  body: string;
}

export class CreateLessonDto {
  @IsString()
  title: string;

  @IsString()
  module: string;

  @IsOptional()
  @IsMongoId()
  moduleId?: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsIn(['lesson', 'vault'])
  type?: 'lesson' | 'vault';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  order: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  duration?: number;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  xp?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionDto)
  quiz?: CreateQuizQuestionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFlashcardDto)
  flashcards?: CreateFlashcardDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVaultFactDto)
  facts?: CreateVaultFactDto[];
}
