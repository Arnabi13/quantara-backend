import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common'
import { Response } from 'express'
import Redis from 'ioredis'
import { PrismaService } from '../prisma/prisma.service'
import { REDIS_CLIENT } from '../redis/redis.module'

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name)

  // One dedicated subscriber connection shared across all open SSE streams
  private subscriber!: Redis

  // userId → set of active SSE Response objects
  private readonly clients = new Map<string, Set<Response>>()

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    this.subscriber = this.redis.duplicate()
    // Pattern-subscribe to every user channel
    this.subscriber.psubscribe('notifications:*')
    this.subscriber.on('pmessage', (_pattern, channel, message) => {
      const userId = channel.slice('notifications:'.length)
      this.clients.get(userId)?.forEach((res) => {
        try {
          res.write(`data: ${message}\n\n`)
        } catch {
          /* client already disconnected */
        }
      })
    })
    this.logger.log('Notification SSE pub/sub subscriber ready')
  }

  onModuleDestroy() {
    this.subscriber.punsubscribe()
    this.subscriber.quit()
  }

  // Called by NotificationsController to register an open SSE stream
  addClient(userId: string, res: Response) {
    if (!this.clients.has(userId)) this.clients.set(userId, new Set())
    this.clients.get(userId)!.add(res)
    this.logger.debug(`SSE client added for user ${userId} (total: ${this.clients.get(userId)!.size})`)
  }

  removeClient(userId: string, res: Response) {
    const set = this.clients.get(userId)
    set?.delete(res)
    if (set?.size === 0) this.clients.delete(userId)
    this.logger.debug(`SSE client removed for user ${userId}`)
  }

  // Called by AlertEvaluatorService after a notification row is persisted
  async publish(userId: string, notification: object) {
    await this.redis.publish(`notifications:${userId}`, JSON.stringify(notification))
  }

  findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }

  async clearAll(userId: string) {
    await this.prisma.notification.deleteMany({ where: { userId } })
  }
}
