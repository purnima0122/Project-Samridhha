import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from './users/users.module';
import { LessonModule } from './lesson/lesson.module';
import { ProgressModule } from './progress/progress.module';
import { DashboardModule } from './dashboard/dashboard.module';
import config from './config/config';
import googleOauthConfig from './config/google-oauth.config';

@Module({
  imports:
  [ ConfigModule.forRoot({
    isGlobal:true,
    cache:true,
    load:[config,googleOauthConfig],
  }),
       
    JwtModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async(config)=>({
      secret: config.get('jwt.secret'),
    }),
    global:true,
    inject: [ConfigService]
  }),

    MongooseModule.forRootAsync({
    imports: [ConfigModule],
    useFactory: async(config)=>({
      uri: config.get('database.connectionString'),
    }),
    inject: [ConfigService]
  }),

    AuthModule,

    UsersModule,

    LessonModule,
    ProgressModule,
    DashboardModule],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
