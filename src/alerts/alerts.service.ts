import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateAlertDto } from './dto/create-alert.dto'

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.alert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  create(userId: string, dto: CreateAlertDto) {
    return this.prisma.alert.create({
      data: {
        userId,
        symbol: dto.symbol.toUpperCase(),
        condition: dto.condition,
        targetPrice: dto.targetPrice,
      },
    })
  }

  async remove(userId: string, id: string) {
    const alert = await this.prisma.alert.findUnique({ where: { id } })
    if (!alert || alert.userId !== userId) {
      throw new NotFoundException('Alert not found')
    }
    await this.prisma.alert.delete({ where: { id } })
  }
}
