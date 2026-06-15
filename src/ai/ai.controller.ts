import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request, Response } from 'express'
import { AiService } from './ai.service'
import { ChatDto } from './dto/chat.dto'
import { RateLimiterGuard, RateLimit } from '../redis/rate-limiter.guard'

@UseGuards(AuthGuard('jwt'), RateLimiterGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @RateLimit(20, 60_000)
  @Post('chat')
  async chat(@Body() dto: ChatDto, @Req() _req: Request, @Res() res: Response) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    try {
      await this.aiService.processChat(dto.message, dto.history ?? [], res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      res.write(`data: ${JSON.stringify({ type: 'error', message: msg })}\n\n`)
    } finally {
      res.end()
    }
  }
}
