import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  Matches, 
  IsOptional,
  IsBoolean,
  IsIn,
} from 'class-validator';

/**
 * Create Staff DTO
 * 
 * Used for staff member registration (admin-only operation)
 */
export class CreateStaffDto {
  /**
   * Staff email address
   * - Must be valid email format
   * - Will be normalized (lowercase, trimmed)
   */
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;

  /**
   * Staff password
   * - Minimum 12 characters
   * - Must contain: uppercase, lowercase, number, special character
   * - Will be hashed before storage
   */
  @IsString({ message: 'Password must be a string' })
  @MinLength(12, { message: 'Password must be at least 12 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&)',
    }
  )
  password: string;

  /**
   * Staff member name
   * - Required field
   * - Maximum 100 characters
   * - Will be sanitized to prevent XSS
   */
  @IsString({ message: 'Name must be a string' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z0-9\s\-_.]+$/, {
    message: 'Name can only contain letters, numbers, spaces, hyphens, underscores, and periods',
  })
  name: string;

  /**
   * Staff role
   * - Must be one of: 'admin', 'staff', 'moderator'
   * - Default: 'staff'
   */
  @IsOptional()
  @IsString({ message: 'Role must be a string' })
  @IsIn(['admin', 'staff', 'moderator'], { message: 'Role must be admin, staff, or moderator' })
  role?: string;

  /**
   * Department
   */
  @IsOptional()
  @IsString({ message: 'Department must be a string' })
  @MaxLength(100, { message: 'Department must not exceed 100 characters' })
  department?: string;

  /**
   * Phone number
   */
  @IsOptional()
  @IsString({ message: 'Phone number must be a string' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  phoneNumber?: string;

  /**
   * Whether the staff member is active
   */
  @IsOptional()
  @IsBoolean({ message: 'isActive must be a boolean' })
  isActive?: boolean;
}
