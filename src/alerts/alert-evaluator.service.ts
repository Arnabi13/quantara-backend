import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { getMockPrice } from '../shared/mock-price.util'

@Injectable()
export class AlertEvaluatorService {
  private readonly logger = new Logger(AlertEvaluatorService.name)

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async evaluate() {
    const alerts = await this.prisma.alert.findMany({ where: { isActive: true } })
    if (alerts.length === 0) return

    for (const alert of alerts) {
      const price = getMockPrice(alert.symbol)
      const triggered =
        alert.condition === 'above'
          ? price >= alert.targetPrice
          : price <= alert.targetPrice

      if (!triggered) continue

      const direction = alert.condition === 'above' ? 'rose above' : 'fell below'
      const priceStr = `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const targetStr = `₹${alert.targetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      await this.prisma.$transaction([
        this.prisma.notification.create({
          data: {
            userId: alert.userId,
            alertId: alert.id,
            symbol: alert.symbol,
            message: `${alert.symbol} ${direction} ${targetStr} · now at ${priceStr}`,
          },
        }),
        this.prisma.alert.update({
          where: { id: alert.id },
          data: { isActive: false, triggeredAt: new Date() },
        }),
      ])

      this.logger.log(`Alert fired: ${alert.symbol} ${direction} ${targetStr}`)
    }
  }
}
