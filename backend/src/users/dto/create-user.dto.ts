import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches, 
  IsOptional 
} from 'class-validator';

/**
 * Create User DTO with comprehensive validation
 * 
 * Used internally for user creation (including OAuth users without passwords)
 * All fields are optional to support different creation scenarios
 */
export class CreateUserDto {
  /**
   * User email address (optional for internal use)
   * - Must be valid email format if provided
   * - Will be normalized (lowercase, trimmed)
   */
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  /**
   * User password (optional for OAuth users)
   * - Minimum 12 characters if provided
   * - Must contain: uppercase, lowercase, number, special character
   * - Will be hashed before storage
   */
  @IsOptional()
    @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }
  )
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
    message: 'Name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
  })
  name?: string;
}
