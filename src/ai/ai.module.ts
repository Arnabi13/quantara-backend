import { Module } from '@nestjs/common'
import { AiController } from './ai.controller'
import { AiService } from './ai.service'
import { BinanceModule } from '../binance/binance.module'

@Module({
  imports: [BinanceModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
