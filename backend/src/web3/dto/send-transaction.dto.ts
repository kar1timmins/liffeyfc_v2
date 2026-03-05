import { IsString, IsNumber, IsIn, IsOptional, IsUUID } from 'class-validator';

export class SendTransactionDto {
  @IsString()
  recipientAddress: string;

  @IsString()
  @IsIn(['ethereum', 'avalanche', 'solana', 'stellar'])
  chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar';

  @IsNumber()
  amountEth: number; // Amount in native token (ETH, AVAX, SOL, XLM)

  /** Optional: when sending to an escrow contract, pass the wishlist item ID
   *  so a Contribution record is immediately saved to the database. */
  @IsOptional()
  @IsUUID()
  wishlistItemId?: string;
}
