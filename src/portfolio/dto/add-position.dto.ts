import { IsNumber, IsString, Min } from 'class-validator'

export class AddPositionDto {
  @IsString()
  symbol: string

  @IsNumber()
  @Min(0.001)
  qty: number

  @IsNumber()
  @Min(0.01)
  price: number
}
