import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { AuthGuard } from '@nestjs/passport'
import type { Request, Response } from 'express'
import { NotificationsService } from './notifications.service'

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * SSE stream — EventSource can't send custom headers, so the JWT is passed
   * as a query param and verified manually here.
   * GET /notifications/stream?token=<jwt>
   */
  @Get('stream')
  stream(@Query('token') token: string, @Req() req: Request, @Res() res: Response) {
    let userId: string
    try {
      const payload = this.jwtService.verify<{ sub: string }>(token ?? '')
      userId = payload.sub
    } catch {
      res.status(401).end()
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Confirm the stream is open to the client
    res.write(': connected\n\n')

    // Keepalive ping every 25s to prevent proxy / browser timeouts
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n') } catch { /* ignore */ }
    }, 25_000)

    this.notificationsService.addClient(userId, res)

    req.on('close', () => {
      clearInterval(heartbeat)
      this.notificationsService.removeClient(userId, res)
    })
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll(@Req() req: any) {
    return this.notificationsService.findAll(req.user.userId)
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.userId, id)
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Req() req: any) {
    return this.notificationsService.markAllRead(req.user.userId)
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearAll(@Req() req: any) {
    return this.notificationsService.clearAll(req.user.userId)
  }
}
