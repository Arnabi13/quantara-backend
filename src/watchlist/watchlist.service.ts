import { ConflictException, Injectable } from '@nestjs/common'
import { PrismaService } from 'src/prisma/prisma.service'

@Injectable()
export class WatchlistService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.watchlist.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { symbol: true, createdAt: true },
    })
  }

  async add(userId: string, symbol: string) {
    try {
      return await this.prisma.watchlist.create({
        data: { userId, symbol: symbol.toUpperCase() },
        select: { symbol: true, createdAt: true },
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Symbol already in watchlist')
      }
      throw err
    }
  }

  async remove(userId: string, symbol: string) {
    await this.prisma.watchlist.deleteMany({
      where: { userId, symbol: symbol.toUpperCase() },
    })
  }
}
