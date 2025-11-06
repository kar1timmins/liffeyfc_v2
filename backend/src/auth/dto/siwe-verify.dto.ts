import { IsString, IsNotEmpty, Matches, IsOptional } from 'class-validator';

/**
 * SIWE (Sign-In with Ethereum) Verification DTO
 * 
 * Security Requirements:
 * - Address: Valid Ethereum address (0x + 40 hex chars)
 * - Signature: Valid hex signature
 * - ChainId: Optional, numeric string
 */
export class SiweVerifyDto {
  /**
   * Ethereum wallet address
   * - Must be valid Ethereum address format (0x + 40 hex characters)
   * - Case-insensitive
   */
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Wallet address is required' })
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'Invalid Ethereum address format (must be 0x followed by 40 hex characters)',
  })
  address: string;

  /**
   * Signature from wallet
   * - Must be valid hex signature format
   * - Typically 132 characters (0x + 130 hex)
   */
  @IsString({ message: 'Signature must be a string' })
  @IsNotEmpty({ message: 'Signature is required' })
  @Matches(/^0x[a-fA-F0-9]+$/, {
    message: 'Invalid signature format (must be hex string starting with 0x)',
  })
  signature: string;

  /**
   * Chain ID (optional)
   * - Used to verify signature against specific blockchain
   * - Must be numeric if provided
   */
  @IsOptional()
  @IsString({ message: 'Chain ID must be a string' })
  @Matches(/^\d+$/, {
    message: 'Chain ID must be a numeric string',
  })
  chainId?: string;
}
