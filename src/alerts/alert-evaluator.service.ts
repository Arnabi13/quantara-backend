import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { getMockPrice } from '../shared/mock-price.util'
import { BinanceStreamService } from '../binance/binance-stream.service'
import { NotificationsService } from '../notifications/notifications.service'

const CRYPTO_REGEX = /USDT$/i

@Injectable()
export class AlertEvaluatorService implements OnModuleInit {
  private readonly logger = new Logger(AlertEvaluatorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly binance: BinanceStreamService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit() {
    // Evaluate crypto alerts in real-time on every Binance ticker tick
    this.binance.subscribe(async (event) => {
      if (event.type !== 'ticker') return
      await this.evaluateForSymbol(event.symbol, event.data.price)
    })
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async evaluateMockSymbols() {
    const alerts = await this.prisma.alert.findMany({ where: { isActive: true } })
    const nseAlerts = alerts.filter((a) => !CRYPTO_REGEX.test(a.symbol))
    for (const alert of nseAlerts) {
      await this.evaluateForSymbol(alert.symbol, getMockPrice(alert.symbol))
    }
  }

  private async evaluateForSymbol(symbol: string, price: number) {
    const alerts = await this.prisma.alert.findMany({
      where: { symbol: { equals: symbol, mode: 'insensitive' }, isActive: true },
    })

    for (const alert of alerts) {
      const triggered =
        alert.condition === 'above' ? price >= alert.targetPrice : price <= alert.targetPrice

      if (!triggered) continue

      const isCrypto = CRYPTO_REGEX.test(symbol)
      const direction = alert.condition === 'above' ? 'rose above' : 'fell below'

      const fmt = (n: number) =>
        isCrypto
          ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      const message = `${alert.symbol} ${direction} ${fmt(alert.targetPrice)} · now at ${fmt(price)}`

      // Persist notification + deactivate alert atomically
      const [notification] = await this.prisma.$transaction([
        this.prisma.notification.create({
          data: {
            userId: alert.userId,
            alertId: alert.id,
            symbol: alert.symbol,
            message,
          },
        }),
        this.prisma.alert.update({
          where: { id: alert.id },
          data: { isActive: false, triggeredAt: new Date() },
        }),
      ])

      this.logger.log(`Alert fired: ${message}`)

      // Push to any open SSE streams for this user via Redis pub/sub
      await this.notifications.publish(alert.userId, {
        id: notification.id,
        symbol: notification.symbol,
        message: notification.message,
        isRead: false,
        createdAt: notification.createdAt.toISOString(),
      })
    }
  }
}
