import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsOptional,
  Min,
  IsIn,
} from 'class-validator';

export class CreateMasterWalletPaymentDto {
  @IsString()
  @IsNotEmpty()
  wishlistItemId: string;

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

  @IsString()
  @IsNotEmpty()
  @IsIn(['master-wallet'])
  paymentMethod: 'master-wallet';
}
