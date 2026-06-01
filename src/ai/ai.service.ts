import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Groq from 'groq-sdk'
import { Response } from 'express'
import { BinanceStreamService } from '../binance/binance-stream.service'
import { ChatMessage } from './dto/chat.dto'

const MODEL = 'llama-3.3-70b-versatile'

const TOOLS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_price',
      description: 'Get the current live price of a specific cryptocurrency in USD',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol, e.g. BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, ADAUSDT, XRPUSDT, DOGEUSDT',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_24h_stats',
      description: 'Get full 24-hour statistics for a cryptocurrency: price, open, high, low, volume, and change percentage',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'Trading pair symbol, e.g. BTCUSDT, ETHUSDT',
          },
        },
        required: ['symbol'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_market_overview',
      description: 'Get current prices and 24h changes for all tracked cryptocurrencies at once',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_order_book_pressure',
      description: 'Get the current order book buy/sell pressure for BTC or ETH based on live depth data',
      parameters: {
        type: 'object',
        properties: {
          symbol: {
            type: 'string',
            description: 'BTCUSDT or ETHUSDT',
          },
        },
        required: ['symbol'],
      },
    },
  },
]

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly groq: Groq

  constructor(
    private readonly config: ConfigService,
    private readonly binance: BinanceStreamService,
  ) {
    this.groq = new Groq({ apiKey: this.config.get<string>('GROQ_API_KEY') })
  }

  async processChat(userMessage: string, history: ChatMessage[], res: Response) {
    const systemPrompt = this.buildSystemPrompt()

    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content }) as Groq.Chat.Completions.ChatCompletionMessageParam),
      { role: 'user', content: userMessage },
    ]

    // Round 1: stream with tools enabled
    const stream1 = await this.groq.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      stream: true,
      max_tokens: 1024,
      temperature: 0.4,
    })

    let assistantText = ''
    const toolCallsMap = new Map<number, { id: string; name: string; args: string }>()

    for await (const chunk of stream1) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue

      if (delta.content) {
        assistantText += delta.content
        res.write(`data: ${JSON.stringify({ type: 'delta', content: delta.content })}\n\n`)
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallsMap.has(tc.index)) {
            toolCallsMap.set(tc.index, { id: '', name: '', args: '' })
          }
          const entry = toolCallsMap.get(tc.index)!
          if (tc.id) entry.id = tc.id
          if (tc.function?.name) entry.name += tc.function.name
          if (tc.function?.arguments) entry.args += tc.function.arguments
        }
      }
    }

    // If tools were called, execute them then stream the final answer
    if (toolCallsMap.size > 0) {
      const toolCalls = Array.from(toolCallsMap.values())

      const assistantMsg: Groq.Chat.Completions.ChatCompletionMessageParam = {
        role: 'assistant',
        content: assistantText || null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.args },
        })),
      }

      const toolResults: Groq.Chat.Completions.ChatCompletionMessageParam[] = []

      for (const tc of toolCalls) {
        let args: Record<string, string> = {}
        try { args = JSON.parse(tc.args) } catch { /* malformed */ }

        res.write(`data: ${JSON.stringify({ type: 'tool_call', name: tc.name, args })}\n\n`)
        this.logger.log(`Tool call: ${tc.name}(${JSON.stringify(args)})`)

        const result = this.executeTool(tc.name, args)
        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        })
      }

      // Final streaming answer with tool results injected
      const stream2 = await this.groq.chat.completions.create({
        model: MODEL,
        messages: [...messages, assistantMsg, ...toolResults],
        stream: true,
        max_tokens: 1024,
        temperature: 0.4,
      })

      for await (const chunk of stream2) {
        const content = chunk.choices[0]?.delta?.content
        if (content) res.write(`data: ${JSON.stringify({ type: 'delta', content })}\n\n`)
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
  }

  private executeTool(name: string, args: Record<string, string>): unknown {
    const sym = (args.symbol ?? '').toUpperCase()

    switch (name) {
      case 'get_price': {
        const ticker = this.binance.getTickerCache().get(sym)
        if (!ticker) return { error: `No data for ${sym}` }
        return { symbol: sym, price: ticker.price, currency: 'USD' }
      }

      case 'get_24h_stats': {
        const ticker = this.binance.getTickerCache().get(sym)
        if (!ticker) return { error: `No data for ${sym}` }
        return {
          symbol: sym,
          price: ticker.price,
          open: ticker.open,
          high: ticker.high,
          low: ticker.low,
          volume: ticker.volume,
          change: ticker.change,
          changePct: ticker.changePct,
        }
      }

      case 'get_market_overview': {
        const overview: Record<string, unknown>[] = []
        this.binance.getTickerCache().forEach((t) => {
          overview.push({
            symbol: t.symbol,
            price: t.price,
            changePct: t.changePct,
          })
        })
        return overview
      }

      case 'get_order_book_pressure': {
        const depth = this.binance.getDepth(sym)
        if (!depth) return { error: `No depth data for ${sym} — only BTCUSDT and ETHUSDT are supported` }
        const bidTotal = depth.bids.reduce((s, [, q]) => s + q, 0)
        const askTotal = depth.asks.reduce((s, [, q]) => s + q, 0)
        const total = bidTotal + askTotal || 1
        return {
          symbol: sym,
          bidTotal: +bidTotal.toFixed(4),
          askTotal: +askTotal.toFixed(4),
          buyPressurePct: +((bidTotal / total) * 100).toFixed(1),
          sellPressurePct: +((askTotal / total) * 100).toFixed(1),
          dominance: bidTotal >= askTotal ? 'BUY' : 'SELL',
        }
      }

      default:
        return { error: `Unknown tool: ${name}` }
    }
  }

  private buildSystemPrompt(): string {
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    return `You are Quantara AI, a real-time crypto market assistant embedded in the Quantara trading dashboard.

You have live access to Binance WebSocket data for BTC, ETH, BNB, SOL, ADA, XRP, and DOGE.

Use the provided tools proactively when the user asks about prices, stats, or market conditions. Always call a tool to get live data rather than making up numbers.

Guidelines:
- Be concise — 2-4 sentences unless a detailed breakdown is requested
- Format prices with commas (e.g. $94,213.50)
- Show change percentages with a + or - sign
- For volume, abbreviate large numbers (e.g. 12.4K BTC)
- Current time in IST: ${now}`
  }
}
