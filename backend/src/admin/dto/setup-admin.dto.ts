import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetupAdminDto {
  /** Must match the ADMIN_SETUP_SECRET environment variable */
  @IsString()
  @IsNotEmpty()
  setupSecret: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @MinLength(8)
  password: string;
}
