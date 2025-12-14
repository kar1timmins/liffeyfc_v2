import { IsArray, IsEnum, ArrayMinSize } from 'class-validator';

export class EstimateCostDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(['ethereum', 'avalanche'], { each: true })
  chains: ('ethereum' | 'avalanche')[];
}
