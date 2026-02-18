import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { JwtService } from '@nestjs/jwt';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: JwtService,
          useValue: { verify: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('someProtectedRoute', () => {
    it('should return the protected payload with userId', () => {
      const req = { userId: 'user-123' };

      expect(appController.someProtectedRoute(req)).toEqual({
        message: 'Accessed Resource',
        userId: 'user-123',
      });
    });
  });
});
