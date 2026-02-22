import { IsString, IsNumber, IsEthereumAddress, IsIn } from 'class-validator';

export class SendTransactionDto {
  @IsString()
  recipientAddress: string;

  @IsString()
  @IsIn(['ethereum', 'avalanche', 'solana', 'stellar'])
  chain: 'ethereum' | 'avalanche' | 'solana' | 'stellar';

  @IsNumber()
  amountEth: number; // Amount in native token (ETH, AVAX, SOL, XLM)
}
