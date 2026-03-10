/**
 * Slice 0 — Kmart scraper proof of concept
 *
 * Uses Claude computer use to visually navigate kmart.com.au and extract
 * product listings. No selectors — Claude reads the page like a human would.
 *
 * Usage:
 *   npx tsx scripts/test-scraper.ts "men's black t-shirt"
 *   npx tsx scripts/test-scraper.ts "women's gym leggings"
 */

import Anthropic from '@anthropic-ai/sdk'
import { chromium, type Page } from 'playwright'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ---------------------------------------------------------------------------
// Load .env.local if present (no dotenv dependency needed)
// ---------------------------------------------------------------------------
const envPath = join(process.cwd(), '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !(key in process.env)) process.env[key] = val
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MODEL = 'claude-opus-4-6'
const VIEWPORT = { width: 1280, height: 800 }
const MAX_ITERATIONS = 25
const SEARCH_BASE_URL = 'https://www.kmart.com.au/search/?searchTerm='

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Product {
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

// ---------------------------------------------------------------------------
// Execute a computer action in Playwright and return the tool result content
// ---------------------------------------------------------------------------
async function executeComputerAction(
  page: Page,
  input: ComputerInput,
): Promise<ContentResult> {
  switch (input.action) {
    case 'screenshot': {
      const buffer = await page.screenshot({ type: 'png' })
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: buffer.toString('base64'),
        },
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

// ---------------------------------------------------------------------------
// Main scraper function
// ---------------------------------------------------------------------------
async function searchKmart(query: string): Promise<Product[]> {
  const client = new Anthropic()

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--no-sandbox',
    ],
  })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    extraHTTPHeaders: {
      'Accept-Language': 'en-AU,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  // Remove automation fingerprints that Akamai detects
  await context.addInitScript(() => {
    // Hide webdriver flag
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    // Spoof plugins to look like a real browser
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    })
    // Spoof languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-AU', 'en'],
    })
    // Remove chrome automation markers
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise
    // @ts-ignore
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol
  })

  const page = await context.newPage()
  let products: Product[] = []

  try {
    const url = SEARCH_BASE_URL + encodeURIComponent(query)
    console.log(`\n[Browser] Navigating to: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Give JS time to render the product grid
    console.log('[Browser] Waiting for page to render...')
    await page.waitForTimeout(3000)

    // Tool definitions
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
                  name: {
                    type: 'string',
                    description: 'Full product name as shown on screen',
                  },
                  price: {
                    type: 'string',
                    description: 'Price as displayed, e.g. "$15.00"',
                  },
                  productUrl: {
                    type: 'string',
                    description: 'Product page URL if readable (optional)',
                  },
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
          `If you can see product listings, immediately call extract_products with all the products you can see (aim for 5-8). ` +
          `If a cookie/consent popup appears, close it first. ` +
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
          'If you see an Access Denied or bot-detection page, try pressing F5 to reload once, then wait 3 seconds and screenshot again. ' +
          'Do not navigate away from the search results page.',
        tools,
        messages,
        betas: ['computer-use-2025-11-24'],
      })

      console.log(`[Claude] stop_reason: ${response.stop_reason}`)

      // Log any text Claude outputs
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          console.log(`[Claude says] ${block.text.slice(0, 300)}`)
        }
      }

      // Append Claude's full response to keep conversation going
      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason === 'end_turn') {
        console.log('[Done] Claude finished without calling extract_products.')
        break
      }

      // Process tool calls
      const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue

        const logInput = JSON.stringify(block.input).slice(0, 150)
        console.log(`[Tool call] ${block.name}: ${logInput}`)

        if (block.name === 'computer') {
          const result = await executeComputerAction(page, block.input as ComputerInput)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: [result],
          })
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

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const query = process.argv[2] ?? "men's black t-shirt"

  console.log('─'.repeat(60))
  console.log(`🔍  Kmart Outfit Finder — Scraper Test`)
  console.log(`    Query:    "${query}"`)
  console.log(`    Model:    ${MODEL}`)
  console.log(`    Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`)
  console.log('─'.repeat(60))

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('\n❌  ANTHROPIC_API_KEY is not set.')
    console.error('    Copy .env.example → .env.local and add your key.\n')
    process.exit(1)
  }

  try {
    const products = await searchKmart(query)

    console.log('\n' + '─'.repeat(60))
    if (products.length === 0) {
      console.log('❌  No products found.')
      console.log('    Check the [Claude says] output above for clues.')
      process.exit(1)
    }

    console.log(`✅  Found ${products.length} products:\n`)
    console.log(JSON.stringify(products, null, 2))
    console.log('─'.repeat(60))
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      console.error(`\n❌  Anthropic API error (HTTP ${err.status}): ${err.message}`)
    } else {
      console.error('\n❌  Unexpected error:', err)
    }
    process.exit(1)
  }
}

main()
