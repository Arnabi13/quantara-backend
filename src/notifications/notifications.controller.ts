import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { NotificationsService } from './notifications.service'

@UseGuards(AuthGuard('jwt'))
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.notificationsService.findAll(req.user.userId)
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  markRead(@Request() req: any, @Param('id') id: string) {
    return this.notificationsService.markRead(req.user.userId, id)
  }

  @Post('read-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  markAllRead(@Request() req: any) {
    return this.notificationsService.markAllRead(req.user.userId)
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  clearAll(@Request() req: any) {
    return this.notificationsService.clearAll(req.user.userId)
  }
}
