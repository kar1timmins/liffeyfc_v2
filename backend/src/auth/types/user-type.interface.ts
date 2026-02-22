import { UserRole } from '../../entities/user.entity';

/**
 * JWT Payload with User Role
 */
export interface JwtPayload {
  sub: string; // User ID
  userType: UserRole; // Role of user (user, investor, staff)
  iat?: number; // Issued at
  exp?: number; // Expires at
}

// Re-export UserRole for convenience
export { UserRole };
