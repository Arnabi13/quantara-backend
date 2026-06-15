import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import Redis from 'ioredis'
import { REDIS_CLIENT } from './redis.module'

export const RATE_LIMIT_KEY = 'rateLimit'

export const RateLimit = (limit: number, windowMs: number) =>
  SetMetadata(RATE_LIMIT_KEY, { limit, windowMs })

@Injectable()
export class RateLimiterGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const config = this.reflector.get<{ limit: number; windowMs: number }>(
      RATE_LIMIT_KEY,
      ctx.getHandler(),
    )
    if (!config) return true

    const req = ctx.switchToHttp().getRequest()
    const userId: string = req.user?.userId ?? req.ip ?? 'anon'
    const key = `rl:${ctx.getClass().name}:${ctx.getHandler().name}:${userId}`
    const windowSec = Math.ceil(config.windowMs / 1000)

    // Atomic INCR: if this is the first hit, set the TTL window
    const count = await this.redis.incr(key)
    if (count === 1) await this.redis.expire(key, windowSec)

    if (count > config.limit) {
      const ttl = await this.redis.ttl(key)
      throw new HttpException(
        { statusCode: 429, message: 'Too many requests — slow down', retryAfter: ttl },
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }
    return true
  }
}
