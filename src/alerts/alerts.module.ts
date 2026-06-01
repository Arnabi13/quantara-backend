import { Module } from '@nestjs/common'
import { AlertsController } from './alerts.controller'
import { AlertsService } from './alerts.service'
import { AlertEvaluatorService } from './alert-evaluator.service'
import { BinanceModule } from '../binance/binance.module'

@Module({
  imports: [BinanceModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEvaluatorService],
})
export class AlertsModule {}
