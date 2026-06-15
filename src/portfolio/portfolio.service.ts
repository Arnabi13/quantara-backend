import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  getPositions(userId: string) {
    return this.prisma.position.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
  }

  async addPosition(userId: string, symbol: string, qty: number, price: number) {
    const sym = symbol.toUpperCase()
    const existing = await this.prisma.position.findUnique({
      where: { userId_symbol: { userId, symbol: sym } },
    })

    let position: Awaited<ReturnType<typeof this.prisma.position.create>>

    if (existing) {
      const newQty = existing.qty + qty
      const newAvg = (existing.qty * existing.avgBuy + qty * price) / newQty
      position = await this.prisma.position.update({
        where: { id: existing.id },
        data: { qty: newQty, avgBuy: parseFloat(newAvg.toFixed(2)) },
      })
    } else {
      position = await this.prisma.position.create({
        data: { userId, symbol: sym, qty, avgBuy: price },
      })
    }

    await this.prisma.transaction.create({
      data: { userId, positionId: position.id, symbol: sym, type: 'BUY', qty, price },
    })

    return position
  }

  async sellPosition(userId: string, symbol: string, qty: number, price: number) {
    const sym = symbol.toUpperCase()
    const existing = await this.prisma.position.findUnique({
      where: { userId_symbol: { userId, symbol: sym } },
    })

    if (!existing) throw new BadRequestException(`No position found for ${sym}`)
    if (qty > existing.qty) throw new BadRequestException(`Cannot sell more than held qty (${existing.qty})`)

    await this.prisma.transaction.create({
      data: { userId, positionId: existing.id, symbol: sym, type: 'SELL', qty, price },
    })

    if (Math.abs(qty - existing.qty) < 0.0001) {
      await this.prisma.position.delete({ where: { id: existing.id } })
      return { deleted: true, symbol: sym }
    }

    return this.prisma.position.update({
      where: { id: existing.id },
      data: { qty: parseFloat((existing.qty - qty).toFixed(6)) },
    })
  }

  async removePosition(userId: string, symbol: string) {
    await this.prisma.position.deleteMany({
      where: { userId, symbol: symbol.toUpperCase() },
    })
  }

  async getTransactions(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit
    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { userId },
        orderBy: { executedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ])
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}
