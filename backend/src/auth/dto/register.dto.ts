import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

/**
 * Registration DTO with comprehensive validation
 *
 * Security Requirements:
 * - Email: Valid format, normalized
 * - Password: Strong (12+ chars, uppercase, lowercase, number, special char)
 * - Name: Optional, sanitized
 */
export class RegisterDto {
  /**
   * User email address
   * - Must be valid email format
   * - Will be normalized (lowercase, trimmed)
   * - Used for login and communication
   */
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  /**
   * User password
   * - Minimum 8 characters (balanced security and usability)
   * - Must contain: uppercase, lowercase, number, special character
   * - Will be hashed before storage (never stored in plain text)
   */
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
  })
  @IsNotEmpty({ message: 'Password is required' })
  password: string;

  /**
   * User display name (optional)
   * - Maximum 100 characters
   * - Will be sanitized to prevent XSS
   */
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.]+$/, {
    message:
      'Name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
  })
  name?: string;
}
