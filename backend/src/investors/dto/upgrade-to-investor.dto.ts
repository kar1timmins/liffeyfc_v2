import { IsString, IsBoolean, IsOptional, IsUrl, MinLength } from 'class-validator';

/**
 * DTO for upgrading a user to investor status
 */
export class UpgradeToInvestorDto {
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters long' })
  company: string;

  @IsString()
  @MinLength(10, { message: 'Investment focus must be at least 10 characters long' })
  investmentFocus: string;

  @IsOptional()
  @IsUrl({}, { message: 'LinkedIn URL must be a valid URL' })
  linkedinUrl?: string;

  @IsBoolean()
  isAccredited: boolean;
}
