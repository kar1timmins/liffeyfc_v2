import { IsString, IsNumber, IsEthereumAddress, IsIn } from 'class-validator';

export class SendTransactionDto {
  @IsString()
  @IsEthereumAddress()
  recipientAddress: string;

  @IsString()
  @IsIn(['ethereum', 'avalanche'])
  chain: 'ethereum' | 'avalanche';

  @IsNumber()
  amountEth: number; // Amount in ETH/AVAX (not Wei)
}
