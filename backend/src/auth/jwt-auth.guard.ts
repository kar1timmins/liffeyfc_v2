import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { verifyJwt } from './jwt.util';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers?.authorization as string | undefined;
    if (!auth?.startsWith('Bearer ')) return false;
    const token = auth.split(' ')[1];
    const payload = verifyJwt(token);
    if (!payload) return false;
    // attach payload to request for controllers
    req.user = payload;
    return true;
  }
}
