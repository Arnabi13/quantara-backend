import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AlertsService } from './alerts.service'
import { CreateAlertDto } from './dto/create-alert.dto'

@UseGuards(AuthGuard('jwt'))
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.alertsService.findAll(req.user.userId)
  }

  @Post()
  create(@Request() req: any, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(req.user.userId, dto)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: any, @Param('id') id: string) {
    return this.alertsService.remove(req.user.userId, id)
  }
}
