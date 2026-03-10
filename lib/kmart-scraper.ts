/**
 * Kmart scraper — importable module
 *
 * Wraps the computer-use browser loop from scripts/test-scraper.ts.
 * Next.js loads .env.local automatically, so no manual env parsing here.
 */

import Anthropic from '@anthropic-ai/sdk'
import { firefox, type Page } from 'playwright'

const MODEL = 'claude-sonnet-4-6'
const VIEWPORT = { width: 1280, height: 800 }
const MAX_ITERATIONS = 25
const SEARCH_BASE_URL = 'https://www.kmart.com.au/search/?searchTerm='

export interface Product {
  name: string
  price: string
  productUrl?: string
}

interface ComputerInput {
  action: string
  coordinate?: [number, number]
  text?: string
  scroll_direction?: 'up' | 'down' | 'left' | 'right'
  scroll_amount?: number
}

type ContentResult =
  | { type: 'image'; source: { type: 'base64'; media_type: 'image/png'; data: string } }
  | { type: 'text'; text: string }

async function executeComputerAction(page: Page, input: ComputerInput): Promise<ContentResult> {
  switch (input.action) {
    case 'screenshot': {
      const buffer = await page.screenshot({ type: 'png' })
      return {
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: buffer.toString('base64') },
      }
    }
    case 'left_click': {
      const [x, y] = input.coordinate!
      await page.mouse.click(x, y)
      await page.waitForTimeout(600)
      return { type: 'text', text: `Clicked at (${x}, ${y})` }
    }
    case 'double_click': {
      const [x, y] = input.coordinate!
      await page.mouse.dblclick(x, y)
      await page.waitForTimeout(600)
      return { type: 'text', text: `Double-clicked at (${x}, ${y})` }
    }
    case 'right_click': {
      const [x, y] = input.coordinate!
      await page.mouse.click(x, y, { button: 'right' })
      await page.waitForTimeout(400)
      return { type: 'text', text: `Right-clicked at (${x}, ${y})` }
    }
    case 'type': {
      await page.keyboard.type(input.text!, { delay: 40 })
      return { type: 'text', text: `Typed: "${input.text}"` }
    }
    case 'key': {
      await page.keyboard.press(input.text!)
      await page.waitForTimeout(600)
      return { type: 'text', text: `Pressed key: ${input.text}` }
    }
    case 'scroll': {
      const [x, y] = input.coordinate ?? [VIEWPORT.width / 2, VIEWPORT.height / 2]
      const amount = (input.scroll_amount ?? 3) * 120
      const deltaY = input.scroll_direction === 'up' ? -amount : amount
      await page.mouse.move(x, y)
      await page.mouse.wheel(0, deltaY)
      await page.waitForTimeout(600)
      return { type: 'text', text: `Scrolled ${input.scroll_direction} by ${input.scroll_amount ?? 3} units` }
    }
    case 'mouse_move': {
      const [x, y] = input.coordinate!
      await page.mouse.move(x, y)
      return { type: 'text', text: `Moved mouse to (${x}, ${y})` }
    }
    default:
      return { type: 'text', text: `Unhandled action: ${input.action}` }
  }
}

export async function searchKmart(query: string): Promise<Product[]> {
  const client = new Anthropic()

  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    extraHTTPHeaders: { 'Accept-Language': 'en-AU,en;q=0.9' },
  })

  const page = await context.newPage()

  const capturedApiResponses: unknown[] = []
  const KMART_API_PATTERNS = [
    /api\.kmart\.com\.au/,
    /\/api\/.*search/i,
    /graphql/i,
  ]
  page.on('response', async (response) => {
    const url = response.url()
    if (!KMART_API_PATTERNS.some((pat) => pat.test(url))) return
    if (!response.ok()) return
    const ct = response.headers()['content-type'] ?? ''
    if (!ct.includes('application/json')) return
    try {
      const json = await response.json()
      capturedApiResponses.push(json)
      console.log(`[API intercept] Captured JSON from: ${url}`)
    } catch {
      // body already consumed or parse error — ignore
    }
  })

  let products: Product[] = []

  try {
    console.log('\n[Browser] Warming up via homepage...')
    try {
      await page.goto('https://www.kmart.com.au', { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await page.waitForTimeout(2000)
      console.log(`[Browser] Homepage loaded: "${await page.title()}"`)
    } catch (err) {
      console.log('[Browser] Homepage warm-up failed (non-fatal):', (err as Error).message)
    }

    const url = SEARCH_BASE_URL + encodeURIComponent(query)
    console.log(`\n[Browser] Navigating to: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    console.log('[Browser] Waiting for page to render...')
    await page.waitForTimeout(4000)

    // Fast path: try extracting from intercepted API responses
    if (capturedApiResponses.length > 0) {
      console.log(`[API intercept] Attempting direct extraction from ${capturedApiResponses.length} captured response(s)...`)
      for (const raw of capturedApiResponses) {
        try {
          const json = raw as Record<string, unknown>
          console.log('[API debug] Top-level keys:', Object.keys(json))
          if (json.data && typeof json.data === 'object') {
            console.log('[API debug] data keys:', Object.keys(json.data as object))
          }

          const data = json?.data as Record<string, unknown> | undefined
          const candidates: Record<string, unknown>[] = (
            (data?.search as Record<string, unknown>)?.products ??
            (data?.search as Record<string, unknown>)?.results ??
            (data?.search as Record<string, unknown>)?.items ??
            (data?.searchResults as Record<string, unknown>)?.products ??
            (data?.searchPage as Record<string, unknown>)?.products ??
            (data?.categoryOrSearch as Record<string, unknown>)?.products ??
            (data?.kmart as Record<string, unknown>)?.search ??
            data?.products ??
            data?.results ??
            data?.items ??
            json?.results ??
            json?.products ??
            json?.items ??
            (json?.hits as Record<string, unknown>)?.hits ??
            json?.hits ??
            []
          ) as Record<string, unknown>[]

          if (candidates.length > 0) {
            products = candidates.slice(0, 24).map((item, i) => ({
              name: String(item.name ?? item.displayName ?? item.title ?? item.productName ?? `Product ${i + 1}`),
              price: String(
                (item.price as Record<string, unknown>)?.current ??
                (item.price as Record<string, unknown>)?.min ??
                (item.price as Record<string, unknown>)?.value ??
                item.priceLabel ??
                item.salePrice ??
                item.regularPrice ??
                item.price ??
                'Unknown',
              ),
              productUrl: item.url != null ? String(item.url)
                : item.productUrl != null ? String(item.productUrl)
                : item.pdpUrl != null ? String(item.pdpUrl)
                : undefined,
            }))
            console.log(`[API intercept] Extracted ${products.length} products — skipping vision loop.`)
            return products
          } else {
            console.log('[API debug] No candidates found in this response — shape unrecognised.')
          }
        } catch (parseErr) {
          console.log('[API intercept] Could not parse JSON shape:', (parseErr as Error).message)
        }
      }
      console.log('[API intercept] No usable products found across all captured responses.')
    }

    // Slow path: Claude computer-use vision loop
    const tools: Anthropic.Beta.BetaTool[] = [
      {
        type: 'computer_20251124',
        name: 'computer',
        display_width_px: VIEWPORT.width,
        display_height_px: VIEWPORT.height,
      } as Anthropic.Beta.BetaComputerUseTool_20251124,
      {
        name: 'extract_products',
        description:
          'Call this when you can see product listings on the Kmart search results page. ' +
          'Extract all products that are clearly visible — name, price, and product URL if you can read it.',
        input_schema: {
          type: 'object' as const,
          properties: {
            products: {
              type: 'array',
              description: 'Products visible on screen',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: 'Full product name as shown on screen' },
                  price: { type: 'string', description: 'Price as displayed, e.g. "$15.00"' },
                  productUrl: { type: 'string', description: 'Product page URL if readable (optional)' },
                },
                required: ['name', 'price'],
              },
            },
          },
          required: ['products'],
        },
      },
    ]

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      {
        role: 'user',
        content:
          `The browser is open on the Kmart Australia search results page for: "${query}". ` +
          `Take a screenshot to see what is on screen. ` +
          `If a cookie/consent popup appears, close it first. ` +
          `If you can see product listings, extract as many as possible — aim for at least 12 products. ` +
          `If fewer than 12 are visible, scroll down to reveal more, then call extract_products once with everything you found. ` +
          `If the page hasn't loaded yet, wait a moment and take another screenshot.`,
      },
    ]

    let done = false

    for (let i = 0; i < MAX_ITERATIONS && !done; i++) {
      console.log(`\n[Iteration ${i + 1}/${MAX_ITERATIONS}] Calling ${MODEL}...`)

      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4096,
        system:
          'You are a web navigation assistant. A browser is open and controlled by Playwright. ' +
          'Your only goal is to extract product data from the Kmart Australia search results page. ' +
          'Be efficient: take a screenshot, identify products, call extract_products. ' +
          'If you see an Access Denied or error page, report it clearly in text and stop. ' +
          'Do not navigate away from the search results page.',
        tools,
        messages,
        betas: ['computer-use-2025-11-24'],
      })

      console.log(`[Claude] stop_reason: ${response.stop_reason}`)

      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          console.log(`[Claude says] ${block.text.slice(0, 300)}`)
        }
      }

      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        console.log('[Done] Claude finished without calling extract_products.')
        break
      }

      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        console.log(`[Tool call] ${block.name}: ${JSON.stringify(block.input).slice(0, 150)}`)

        if (block.name === 'computer') {
          const result = await executeComputerAction(page, block.input as ComputerInput)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: [result] })
        } else if (block.name === 'extract_products') {
          const input = block.input as { products: Product[] }
          products = input.products ?? []
          console.log(`\n✓ extract_products called — ${products.length} products captured`)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [{ type: 'text', text: 'Products captured successfully. Task complete.' }],
          })
          done = true
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults })
      }
    }

    if (!done) {
      console.log(`\n⚠️  Reached ${MAX_ITERATIONS} iterations without extract_products being called.`)
    }
  } finally {
    await browser.close()
    console.log('\n[Browser] Closed.')
  }

  return products
}
