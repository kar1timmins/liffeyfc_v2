import { IsString, IsNotEmpty, IsNumber, IsArray, IsOptional, Min, Matches, IsIn } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  wishlistItemId: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message: 'USDC transaction hash must be a valid transaction hash (0x followed by 64 hex characters)',
  })
  usdcTxHash: string;

  @IsNumber()
  @Min(0.01)
  usdcAmount: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['ethereum', 'avalanche'])
  chain: 'ethereum' | 'avalanche';

  @IsArray()
  @IsString({ each: true })
  deploymentChains: ('ethereum' | 'avalanche')[];

  @IsNumber()
  targetAmountEth: number;

  @IsNumber()
  durationInDays: number;

  @IsString()
  @IsOptional()
  campaignName?: string;

  @IsString()
  @IsOptional()
  campaignDescription?: string;
}
