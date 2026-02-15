import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { ExecutionContext } from '@nestjs/common';
import { encodeRedirectState, isAllowedRedirect } from '../utils/redirects';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const rawRedirect =
      typeof request?.query?.redirect === 'string'
        ? request.query.redirect
        : null;
    const redirect = isAllowedRedirect(rawRedirect);
    const state = redirect ? encodeRedirectState(redirect) : undefined;

    return {
      scope: ['email', 'profile'],
      state,
      session: false,
    };
  }
}
