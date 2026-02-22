import { IsEmail, IsString, IsNotEmpty } from 'class-validator';

/**
 * Login DTO with validation
 *
 * Security Requirements:
 * - Email: Valid format, required
 * - Password: Required (no complexity check here - already validated at registration)
 */
export class LoginDto {
  /**
   * User email address
   * - Must be valid email format
   * - Required for authentication
   */
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /**
   * User password
   * - Required for authentication
   * - No complexity validation (user already registered with strong password)
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
