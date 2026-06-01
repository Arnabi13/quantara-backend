import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'
import { getMockPrice } from '../shared/mock-price.util'
import { BinanceStreamService } from '../binance/binance-stream.service'

// Crypto symbols tracked by Binance (USDT pairs)
const CRYPTO_REGEX = /USDT$/i

@Injectable()
export class AlertEvaluatorService implements OnModuleInit {
  private readonly logger = new Logger(AlertEvaluatorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly binance: BinanceStreamService,
  ) {}

  onModuleInit() {
    // Evaluate crypto alerts in real-time on every Binance ticker tick
    this.binance.subscribe(async (event) => {
      if (event.type !== 'ticker') return
      await this.evaluateForSymbol(event.symbol, event.data.price)
    })
  }

  // NSE / mock symbols are still evaluated on a cron
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

      const priceStr = isCrypto
        ? `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

      const targetStr = isCrypto
        ? `$${alert.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : `₹${alert.targetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

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
