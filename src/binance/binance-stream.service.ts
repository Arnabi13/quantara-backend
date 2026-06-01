import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import WebSocket from 'ws'

export interface TickerData {
  symbol: string
  price: number
  open: number
  high: number
  low: number
  volume: number
  change: number
  changePct: number
}

export interface KlineData {
  symbol: string
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  isClosed: boolean
}

export interface DepthData {
  symbol: string
  bids: [number, number][]
  asks: [number, number][]
}

export interface TradeData {
  symbol: string
  price: number
  qty: number
  isBuyerMaker: boolean
  time: number
}

export type BinanceEvent =
  | { type: 'ticker'; symbol: string; data: TickerData }
  | { type: 'kline'; symbol: string; data: KlineData }
  | { type: 'depth'; symbol: string; data: DepthData }
  | { type: 'trade'; symbol: string; data: TradeData }

type EventHandler = (event: BinanceEvent) => void

const TICKER_SYMBOLS = ['btcusdt', 'ethusdt', 'bnbusdt', 'solusdt', 'adausdt', 'xrpusdt', 'dogeusdt']

const STREAMS = [
  ...TICKER_SYMBOLS.map((s) => `${s}@miniTicker`),
  'btcusdt@kline_1m',
  'ethusdt@kline_1m',
  'solusdt@kline_1m',
  'btcusdt@depth5@100ms',
  'ethusdt@depth5@100ms',
  'btcusdt@aggTrade',
  'ethusdt@aggTrade',
]

const WS_URL = `wss://stream.binance.com:9443/stream?streams=${STREAMS.join('/')}`

@Injectable()
export class BinanceStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BinanceStreamService.name)
  private ws: WebSocket | null = null
  private handlers = new Set<EventHandler>()
  private tickerCache = new Map<string, TickerData>()
  private depthCache  = new Map<string, DepthData>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 2000
  private destroyed = false

  onModuleInit() {
    this.connect()
  }

  onModuleDestroy() {
    this.destroyed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.ws?.terminate()
  }

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler)
    // Immediately replay cached tickers so late joiners get instant state
    this.tickerCache.forEach((data) => handler({ type: 'ticker', symbol: data.symbol, data }))
    return () => this.handlers.delete(handler)
  }

  getTickerCache(): Map<string, TickerData> {
    return this.tickerCache
  }

  getDepth(symbol: string): DepthData | null {
    return this.depthCache.get(symbol.toUpperCase()) ?? null
  }

  getPrice(symbol: string): number | null {
    return this.tickerCache.get(symbol.toUpperCase())?.price ?? null
  }

  private connect() {
    this.logger.log('Connecting to Binance WebSocket...')
    const ws = new WebSocket(WS_URL)
    this.ws = ws

    ws.on('open', () => {
      this.logger.log('Binance WebSocket connected')
      this.reconnectDelay = 2000
    })

    ws.on('message', (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString()) as { stream: string; data: unknown }
        if (!msg.stream || !msg.data) return
        this.handleStream(msg.stream, msg.data)
      } catch { /* ignore malformed frames */ }
    })

    ws.on('close', () => {
      this.logger.warn('Binance WebSocket closed — scheduling reconnect')
      this.scheduleReconnect()
    })

    ws.on('error', (err: Error) => {
      this.logger.error(`Binance WebSocket error: ${err.message}`)
      ws.terminate()
    })
  }

  private handleStream(stream: string, raw: unknown) {
    const data = raw as Record<string, unknown>

    if (stream.endsWith('@miniTicker')) {
      const ticker: TickerData = {
        symbol: data.s as string,
        price: parseFloat(data.c as string),
        open: parseFloat(data.o as string),
        high: parseFloat(data.h as string),
        low: parseFloat(data.l as string),
        volume: parseFloat(data.v as string),
        change: parseFloat(data.c as string) - parseFloat(data.o as string),
        changePct:
          ((parseFloat(data.c as string) - parseFloat(data.o as string)) /
            parseFloat(data.o as string)) *
          100,
      }
      this.tickerCache.set(ticker.symbol, ticker)
      this.broadcast({ type: 'ticker', symbol: ticker.symbol, data: ticker })
    } else if (stream.includes('@kline_')) {
      const k = (data.k as Record<string, unknown>)
      const kline: KlineData = {
        symbol: data.s as string,
        time: Math.floor((k.t as number) / 1000),
        open: parseFloat(k.o as string),
        high: parseFloat(k.h as string),
        low: parseFloat(k.l as string),
        close: parseFloat(k.c as string),
        volume: parseFloat(k.v as string),
        isClosed: k.x as boolean,
      }
      this.broadcast({ type: 'kline', symbol: kline.symbol, data: kline })
    } else if (stream.includes('@depth')) {
      const rawSymbol = stream.split('@')[0].toUpperCase()
      const bidsRaw = (data.bids as string[][]).slice(0, 5)
      const asksRaw = (data.asks as string[][]).slice(0, 5)
      const depth: DepthData = {
        symbol: rawSymbol,
        bids: bidsRaw.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
        asks: asksRaw.map(([p, q]) => [parseFloat(p), parseFloat(q)]),
      }
      this.depthCache.set(rawSymbol, depth)
      this.broadcast({ type: 'depth', symbol: depth.symbol, data: depth })
    } else if (stream.endsWith('@aggTrade')) {
      const trade: TradeData = {
        symbol: data.s as string,
        price: parseFloat(data.p as string),
        qty: parseFloat(data.q as string),
        isBuyerMaker: data.m as boolean,
        time: data.T as number,
      }
      this.broadcast({ type: 'trade', symbol: trade.symbol, data: trade })
    }
  }

  private broadcast(event: BinanceEvent) {
    this.handlers.forEach((h) => {
      try { h(event) } catch { /* isolate handler errors */ }
    })
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000)
      this.connect()
    }, this.reconnectDelay)
  }
}
