import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { User } from 'src/auth/schemas/user.schema';
import { Lesson } from 'src/lesson/schemas/lesson.schema';
import { ProgressService } from './progress.service';
import { Progress } from './schemas/progress.schema';

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProgressService,
        { provide: getModelToken(Progress.name), useValue: {} },
        { provide: getModelToken(Lesson.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
      ],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
