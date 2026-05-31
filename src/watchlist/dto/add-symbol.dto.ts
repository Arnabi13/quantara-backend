import { IsString, IsNotEmpty, MaxLength } from 'class-validator'

export class AddSymbolDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  symbol: string
}
