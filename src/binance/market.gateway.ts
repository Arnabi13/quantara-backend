import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'
import { OnModuleInit, Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { BinanceStreamService, BinanceEvent } from './binance-stream.service'

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((origin) => origin.trim())
      : 'http://localhost:5173',
    credentials: true,
  },
  namespace: '/market',
})
export class MarketGateway
  implements OnModuleInit, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server
  private readonly logger = new Logger(MarketGateway.name)

  constructor(private readonly binance: BinanceStreamService) {}

  onModuleInit() {
    this.binance.subscribe((event: BinanceEvent) => {
      switch (event.type) {
        case 'ticker':
          this.server?.to('ticker').emit('ticker', event.data)
          break
        case 'kline':
          this.server?.to(`kline:${event.symbol}`).emit('kline', event.data)
          break
        case 'depth':
          this.server?.to(`depth:${event.symbol}`).emit('depth', event.data)
          break
        case 'trade':
          this.server?.to(`trade:${event.symbol}`).emit('trade', event.data)
          break
      }
    })
  }

  afterInit() {
    this.logger.log('MarketGateway initialized')
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.join(room)

    if (room === 'ticker') {
      const snapshot = Array.from(this.binance.getTickerCache().values())
      if (snapshot.length > 0) client.emit('ticker_snapshot', snapshot)
    }
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.leave(room)
  }
}
