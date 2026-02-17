// import { Inject, Injectable } from '@nestjs/common';
// import { PassportStrategy } from '@nestjs/passport';
// import { Strategy, VerifyCallback } from 'passport-google-oauth20';
// import { ConfigType } from '@nestjs/config';

// import googleOauthConfig from '../../config/google-oauth.config';
// import { AuthService } from '../auth.service';

// @Injectable()
// export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
//   constructor(
//     @Inject(googleOauthConfig.KEY)
//     private googleConfiguration: ConfigType<typeof googleOauthConfig>,
//     private authService: AuthService,
//   ) {
//     super({
//       clientID: googleConfiguration.clientID,
//       clientSecret: googleConfiguration.clientSecret,
//       callbackURL: googleConfiguration.callbackURL,
//       scope: ['email', 'profile'],
//     });
//   }

//   async validate(
//     accessToken: string,
//     refreshToken: string,
//     profile: any,
//     done: VerifyCallback,
//   ) {
//     const user = await this.authService.validateGoogleUser({
//       email: profile.emails[0].value,
//       name: `${profile.name.givenName} ${profile.name.familyName}`,
//       avatar: profile.photos?.[0]?.value,
//     });

//     done(null, user);
//   }
// }


import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    const options: StrategyOptions = {
      clientID: configService.get<string>('googleOAuth.clientID') || 'placeholder-client-id',
      clientSecret: configService.get<string>('googleOAuth.clientSecret') || 'placeholder-client-secret',
      callbackURL: configService.get<string>('googleOAuth.callbackURL') || 'http://localhost:3000/auth/google/callback',
      scope: ['email', 'profile'],
    };
    super(options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const user = await this.authService.validateGoogleUser({
      email: profile.emails[0].value,
      name: `${profile.name.givenName} ${profile.name.familyName}`,
      avatar: profile.photos?.[0]?.value,
    });

    done(null, user);
  }
}
