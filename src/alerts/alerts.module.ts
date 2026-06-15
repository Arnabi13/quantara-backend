import { Module } from '@nestjs/common'
import { AlertsController } from './alerts.controller'
import { AlertsService } from './alerts.service'
import { AlertEvaluatorService } from './alert-evaluator.service'
import { BinanceModule } from '../binance/binance.module'
import { NotificationsModule } from '../notifications/notifications.module'

@Module({
  imports: [BinanceModule, NotificationsModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEvaluatorService],
})
export class AlertsModule {}
