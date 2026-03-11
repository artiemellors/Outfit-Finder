import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchKmart } from '@/lib/kmart-scraper'

const SYSTEM_PROMPT = `You are an outfit curator for Kmart Australia. Given a user's clothing request, you:
1. Identify the clothing categories needed (tops, bottoms, footwear, accessories, etc.)
2. Call search_kmart ONCE per category — maximum 5 searches total
3. Call present_outfits with 2–4 named outfit pairings using the results you have

Use specific queries ("men's black t-shirt" not "t-shirt"). If a search returns no results, skip that category and use what you have. Do not retry failed searches.`

export async function POST(req: NextRequest) {
  const { query } = await req.json() as { query: string }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const client = new Anthropic()

        const tools: Anthropic.Tool[] = [
          {
            name: 'search_kmart',
            description: "Search Kmart Australia for products. Returns up to 6 products with name, price, imageUrl, productUrl.",
            input_schema: {
              type: 'object' as const,
              properties: { query: { type: 'string', description: "Search query, e.g. \"men's black t-shirt\"" } },
              required: ['query'],
            },
          },
          {
            name: 'present_outfits',
            description: 'Present the final outfit recommendations. Call once all searches are done.',
            input_schema: {
              type: 'object' as const,
              properties: {
                outfits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      description: { type: 'string' },
                      items: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            category: { type: 'string' },
                            description: { type: 'string' },
                            alternatives: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  name: { type: 'string' },
                                  price: { type: 'string' },
                                  productUrl: { type: 'string' },
                                  imageUrl: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              required: ['outfits'],
            },
          },
        ]

        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: query }]

        while (true) {
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools,
            messages,
          })

          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'end_turn') {
            send({ type: 'error', message: 'Claude finished without calling present_outfits' })
            break
          }

          if (response.stop_reason === 'tool_use') {
            const toolResults: Anthropic.ToolResultBlockParam[] = []
            for (const block of response.content) {
              if (block.type !== 'tool_use') continue

              if (block.name === 'search_kmart') {
                const q = (block.input as { query: string }).query
                send({ type: 'status', message: `Searching for "${q}"…` })
                const products = await searchKmart(q)
                if (products.length > 0) {
                  send({ type: 'status', message: `Found ${products.length} options for "${q}"` })
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify(products.slice(0, 6)),
                  })
                } else {
                  send({ type: 'status', message: `No results for "${q}" — skipping` })
                  toolResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: 'No results found. Skip this category and proceed with what you have.',
                  })
                }
              } else if (block.name === 'present_outfits') {
                send({ type: 'done', result: (block.input as { outfits: unknown }).outfits })
                controller.close()
                return
              }
            }
            messages.push({ role: 'user', content: toolResults })
          }
        }
      } catch (err) {
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
