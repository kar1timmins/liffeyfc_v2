/**
 * User Type Enum
 * Defines the three types of users in the system
 */
export enum UserType {
  USER = 'user',           // General users/founders
  INVESTOR = 'investor',   // Investors
  STAFF = 'staff',         // Staff members (admin, moderators)
}

/**
 * Unified User Interface
 * Common interface for all user types
 */
export interface UnifiedUser {
  id: string;
  email: string;
  name?: string;
  passwordHash?: string;
  provider?: string;
  providerId?: string;
  userType: UserType;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * JWT Payload with User Type
 */
export interface JwtPayload {
  sub: string;           // User ID
  userType: UserType;    // Type of user (user, investor, staff)
  iat?: number;          // Issued at
  exp?: number;          // Expires at
}
