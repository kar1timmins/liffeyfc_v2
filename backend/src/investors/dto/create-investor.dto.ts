import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches, 
  IsOptional,
  IsBoolean,
  IsUrl,
} from 'class-validator';

/**
 * Create Investor DTO
 * 
 * Used for investor registration
 */
export class CreateInvestorDto {
  /**
   * Investor email address
   * - Must be valid email format
   * - Will be normalized (lowercase, trimmed)
   */
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  /**
   * Investor password (optional for OAuth users)
   * - Minimum 12 characters
   * - Must contain: uppercase, lowercase, number, special character
   * - Will be hashed before storage
   */
  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }
  )
  password?: string;

  /**
   * Investor name
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

  /**
   * Company or investment firm name
   */
  @IsOptional()
  @IsString({ message: 'Company must be a string' })
  @MaxLength(100, { message: 'Company must not exceed 100 characters' })
  company?: string;

  /**
   * Investment focus or thesis
   */
  @IsOptional()
  @IsString({ message: 'Investment focus must be a string' })
  @MaxLength(255, { message: 'Investment focus must not exceed 255 characters' })
  investmentFocus?: string;

  /**
   * LinkedIn profile URL
   */
  @IsOptional()
  @IsUrl({}, { message: 'Invalid LinkedIn URL format' })
  linkedinUrl?: string;

  /**
   * Whether the investor is accredited
   */
  @IsOptional()
  @IsBoolean({ message: 'isAccredited must be a boolean' })
  isAccredited?: boolean;
}
