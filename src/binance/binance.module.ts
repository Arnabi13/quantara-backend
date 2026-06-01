import { Module } from '@nestjs/common'
import { BinanceStreamService } from './binance-stream.service'
import { MarketGateway } from './market.gateway'

@Module({
  providers: [BinanceStreamService, MarketGateway],
  exports: [BinanceStreamService],
})
export class BinanceModule {}
