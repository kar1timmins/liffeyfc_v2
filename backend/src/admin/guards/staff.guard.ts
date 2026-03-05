import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard that allows only authenticated users with role 'staff'.
 * Must be combined with AuthGuard('jwt').
 */
@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Not authenticated.');

    // JWT payload stores role as `userType` set by jwt.strategy
    if (user.userType !== 'staff' && user.role !== 'staff') {
      throw new ForbiddenException('Staff access required.');
    }

    return true;
  }
}
