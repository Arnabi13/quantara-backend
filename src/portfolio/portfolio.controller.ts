import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Post, Query, Request, UseGuards,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { AddPositionDto } from './dto/add-position.dto'
import { SellPositionDto } from './dto/sell-position.dto'
import { PortfolioService } from './portfolio.service'

@UseGuards(AuthGuard('jwt'))
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  getPositions(@Request() req: any) {
    return this.portfolioService.getPositions(req.user.userId)
  }

  @Post()
  addPosition(@Request() req: any, @Body() dto: AddPositionDto) {
    return this.portfolioService.addPosition(req.user.userId, dto.symbol, dto.qty, dto.price)
  }

  @Post('sell')
  sellPosition(@Request() req: any, @Body() dto: SellPositionDto) {
    return this.portfolioService.sellPosition(req.user.userId, dto.symbol, dto.qty, dto.price)
  }

  @Delete(':symbol')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePosition(@Request() req: any, @Param('symbol') symbol: string) {
    return this.portfolioService.removePosition(req.user.userId, symbol)
  }

  @Get('transactions')
  getTransactions(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '15',
  ) {
    return this.portfolioService.getTransactions(
      req.user.userId,
      parseInt(page, 10),
      parseInt(limit, 10),
    )
  }
}
