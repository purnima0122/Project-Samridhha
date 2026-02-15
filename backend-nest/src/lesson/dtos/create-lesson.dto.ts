export class CreateLessonDto {
  title: string;
  module: string;
  content: string;
  order: number;
  duration?: number;
  isPublished?: boolean;
  videoUrl?: string;
  color?: string;
  icon?: string;
  quiz?: {
    prompt: string;
    options: string[];
    correctOptionIndex: number;
    explanation?: string;
  }[];
}
