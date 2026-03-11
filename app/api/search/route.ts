import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { searchKmart, Product } from '@/lib/kmart-scraper'

const BASE_PROMPT = `You are an outfit curator for Kmart Australia. Given a user's clothing request:
1. In your FIRST response, call search_kmart for ALL categories at once — emit all tool calls together, do not wait between them. Max 5 calls.
2. Once you have the search results, call present_outfits — do NOT describe outfits in text.

Each product in search results has an "id" field. When calling present_outfits, reference products by their id only — do not repeat name, price, or URLs. Provide 2–4 named outfit pairings. For each outfit, group items by category (Top, Bottom, Footwear, etc.) with 3–5 product alternatives per slot. You MUST call present_outfits even if some searches returned no results. Do not use emojis in outfit names or descriptions.`

export async function POST(req: NextRequest) {
  const { query, gender } = await req.json() as { query: string; gender: 'men' | 'women' | null }

  const SYSTEM_PROMPT = gender
    ? `${BASE_PROMPT}\n\nIMPORTANT: The user is shopping for ${gender === 'men' ? 'a man' : 'a woman'} — every search query and all outfit suggestions must be for ${gender}'s clothing only. Prefix all search_kmart queries with "${gender === 'men' ? "men's" : "women's"}" unless the user has already specified it.`
    : BASE_PROMPT

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
            description: "Search Kmart Australia for products. Returns up to 6 products, each with an id, name, and price.",
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
                              description: 'Product ids from search results',
                              items: { type: 'string' },
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

        const productMap = new Map<string, Product>()
        const messages: Anthropic.MessageParam[] = [{ role: 'user', content: query }]
        let turn = 0
        let searchIndex = 0

        while (true) {
          turn++
          console.log(`\n[Claude] Turn ${turn} — calling API…`)
          const response = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 8192,
            system: SYSTEM_PROMPT,
            tools,
            tool_choice: { type: 'any' },
            messages,
          })
          console.log(`[Claude] Turn ${turn} — stop_reason: ${response.stop_reason}, blocks: ${response.content.length}`)

          messages.push({ role: 'assistant', content: response.content })

          if (response.stop_reason === 'end_turn') {
            send({ type: 'error', message: 'Claude finished without calling present_outfits' })
            break
          }

          if (response.stop_reason === 'tool_use') {
            const toolBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            )

            const presentBlock = toolBlocks.find(b => b.name === 'present_outfits')
            if (presentBlock) {
              const rawOutfits = (presentBlock.input as {
                outfits: Array<{
                  name: string
                  description: string
                  items: Array<{ category: string; description: string; alternatives: string[] }>
                }>
              }).outfits
              console.log(`[Claude] present_outfits called — ${Array.isArray(rawOutfits) ? rawOutfits.length : '?'} outfits`)

              // Resolve product IDs back to full product objects
              const outfits = rawOutfits.map(outfit => ({
                ...outfit,
                items: outfit.items.map(item => ({
                  ...item,
                  alternatives: item.alternatives
                    .map(id => productMap.get(id))
                    .filter((p): p is Product => p !== undefined),
                })),
              }))

              send({ type: 'done', result: outfits })
              controller.close()
              return
            }

            const searchBlocks = toolBlocks.filter(b => b.name === 'search_kmart')
            console.log(`[Claude] Searching ${searchBlocks.length} categories in parallel: ${searchBlocks.map(b => `"${(b.input as { query: string }).query}"`).join(', ')}`)
            searchBlocks.forEach(b =>
              send({ type: 'status', message: `Searching for "${(b.input as { query: string }).query}"…` })
            )

            const t0 = Date.now()
            const results = await Promise.all(
              searchBlocks.map(b => searchKmart((b.input as { query: string }).query))
            )
            console.log(`[Search] All ${searchBlocks.length} searches done in ${Date.now() - t0}ms`)

            const toolResults: Anthropic.ToolResultBlockParam[] = searchBlocks.map((b, i) => {
              const q = (b.input as { query: string }).query
              const products = results[i].slice(0, 6)
              const si = searchIndex++
              console.log(`[Search] "${q}" → ${products.length} products`)
              if (products.length > 0) {
                send({ type: 'status', message: `Found ${products.length} options for "${q}"` })
              } else {
                send({ type: 'status', message: `No results for "${q}" — skipping` })
              }

              // Tag each product with a short ID and store in map; only send id/name/price to Claude
              const tagged = products.map((p, pi) => {
                const id = `q${si}p${pi}`
                productMap.set(id, p)
                return { id, name: p.name, price: p.price }
              })

              return {
                type: 'tool_result' as const,
                tool_use_id: b.id,
                content: tagged.length > 0
                  ? JSON.stringify(tagged)
                  : 'No results found. Skip this category and proceed with what you have.',
              }
            })
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
