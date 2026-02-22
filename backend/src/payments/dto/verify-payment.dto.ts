import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class VerifyPaymentDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, {
    message:
      'Transaction hash must be a valid transaction hash (0x followed by 64 hex characters)',
  })
  txHash: string;

  @IsString()
  @IsNotEmpty()
  chain: 'ethereum' | 'avalanche';
}
