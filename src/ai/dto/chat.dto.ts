import { IsArray, IsOptional, IsString } from 'class-validator'

export class ChatMessage {
  @IsString()
  role: 'user' | 'assistant'

  @IsString()
  content: string
}

export class ChatDto {
  @IsString()
  message: string

  @IsOptional()
  @IsArray()
  history?: ChatMessage[]
}
