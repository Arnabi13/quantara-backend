import { IsIn, IsNumber, IsPositive, IsString, MinLength } from 'class-validator'

export class CreateAlertDto {
  @IsString()
  @MinLength(1)
  symbol: string

  @IsIn(['above', 'below'])
  condition: 'above' | 'below'

  @IsNumber()
  @IsPositive()
  targetPrice: number
}
