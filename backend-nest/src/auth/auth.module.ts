import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Mongoose } from 'mongoose';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh.token.schema';
import { ResetToken, ResetTokenSchema } from './schemas/reset.token.schema';
import { MailService } from 'src/services/mail.service';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import googleOauthConfig from 'src/config/google-oauth.config';
import { GoogleStrategy } from './strategies/google.strategy';
import { GoogleAuthGuard } from './guards/google-auth.guard';

@Module({
  imports:[
   
    MongooseModule.forFeature([
    {
    name:User.name,
    schema: UserSchema
    },
    {
    name:RefreshToken.name,
    schema: RefreshTokenSchema,
    },
     {
    name:ResetToken.name,
    schema: ResetTokenSchema,
    }
]),
 ConfigModule.forFeature(googleOauthConfig),
 PassportModule,
],
  controllers: [AuthController],
  providers: [AuthService, MailService, GoogleStrategy, GoogleAuthGuard]
})
export class AuthModule {}
