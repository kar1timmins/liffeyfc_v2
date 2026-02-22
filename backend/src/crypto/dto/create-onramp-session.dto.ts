import {
  IsString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class TransactionDetailsDto {
  @IsString()
  @IsNotEmpty()
  destination_currency: string;

  @IsString()
  @IsNotEmpty()
  destination_exchange_amount: string;

  @IsString()
  @IsNotEmpty()
  destination_network: string;

  @IsString()
  @IsOptional()
  wallet_address?: string;
}

export class CreateOnrampSessionDto {
  @ValidateNested()
  @Type(() => TransactionDetailsDto)
  transaction_details: TransactionDetailsDto;
}
