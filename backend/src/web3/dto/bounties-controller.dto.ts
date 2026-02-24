import {
  IsString,
  IsNumber,
  IsOptional,
  IsNotEmpty,
  IsIn,
  Min,
} from 'class-validator';


export class CreateBountyDto {
  @IsString()
  @IsNotEmpty()
  wishlistItemId!: string;

  @IsNumber()
  targetAmountEur!: number;

  @IsNumber()
  durationInDays!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  campaignDescription?: string;
}

export class ManualContributionDto {
  @IsString()
  @IsIn(['solana', 'stellar', 'bitcoin'])
  chain!: string;

  @IsNumber()
  @Min(0.000001)
  nativeAmount!: number;

  @IsString()
  @IsNotEmpty()
  transactionHash!: string;
}