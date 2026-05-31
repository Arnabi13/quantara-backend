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
import { AddSymbolDto } from './dto/add-symbol.dto'
import { WatchlistService } from './watchlist.service'

@UseGuards(AuthGuard('jwt'))
@Controller('watchlist')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.watchlistService.findAll(req.user.userId)
  }

  @Post()
  add(@Request() req: any, @Body() dto: AddSymbolDto) {
    return this.watchlistService.add(req.user.userId, dto.symbol)
  }

  @Delete(':symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Request() req: any, @Param('symbol') symbol: string) {
    return this.watchlistService.remove(req.user.userId, symbol)
  }
}
