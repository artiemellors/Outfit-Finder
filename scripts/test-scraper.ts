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
import { firefox, type Page } from 'playwright'
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
const MODEL = 'claude-sonnet-4-6'
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
  imageUrl?: string
}

function mapProducts(candidates: Record<string, unknown>[]): Product[] {
  return candidates.slice(0, 24).map((item, i) => {
    const data = item.data as Record<string, unknown> | undefined
    const rawUrl = data?.url != null ? String(data.url)
      : item.url != null ? String(item.url)
      : item.productUrl != null ? String(item.productUrl)
      : item.pdpUrl != null ? String(item.pdpUrl)
      : undefined
    return {
      name: String(
        item.value ??  // Constructor.io
        item.name ?? item.displayName ?? item.title ?? item.productName ??
        `Product ${i + 1}`
      ),
      price: String(
        data?.price ??  // Constructor.io: numeric e.g. 15
        (item.price as Record<string, unknown>)?.current ??
        (item.price as Record<string, unknown>)?.min ??
        (item.price as Record<string, unknown>)?.value ??
        item.priceLabel ?? item.salePrice ?? item.regularPrice ?? item.price ??
        'Unknown'
      ),
      productUrl: rawUrl != null
        ? rawUrl.startsWith('http') ? rawUrl : `https://www.kmart.com.au${rawUrl}`
        : undefined,
      imageUrl: data?.image_url != null ? String(data.image_url)  // Constructor.io: full URL
        : item.primaryImage != null
          ? String((item.primaryImage as Record<string, unknown>).url ?? item.primaryImage)
          : Array.isArray(item.images) && (item.images as unknown[]).length > 0
            ? String(((item.images as Record<string, unknown>[])[0]).url ?? (item.images as unknown[])[0])
            : item.imageUrl != null ? String(item.imageUrl)
            : item.image != null ? String(item.image)
            : item.thumbnail != null ? String(item.thumbnail)
            : undefined,
    }
  })
}

async function extractFromNextData(page: Page): Promise<Product[]> {
  const nextData = await page.evaluate(() => {
    const el = document.getElementById('__NEXT_DATA__')
    if (!el?.textContent) return null
    try { return JSON.parse(el.textContent) } catch { return null }
  }) as Record<string, unknown> | null

  if (!nextData) {
    console.log('[__NEXT_DATA__] Script tag not found on page')
    return []
  }

  console.log('[__NEXT_DATA__] Found. Top-level keys:', Object.keys(nextData))
  const pageProps = (nextData?.props as Record<string, unknown>)?.pageProps as Record<string, unknown> | undefined
  if (!pageProps) {
    console.log('[__NEXT_DATA__] No props.pageProps found')
    return []
  }
  console.log('[__NEXT_DATA__] pageProps keys:', Object.keys(pageProps))

  const candidates = (
    (pageProps?.initialData as Record<string, unknown>)?.search?.products ??
    (pageProps?.searchResults as Record<string, unknown>)?.products ??
    (pageProps?.data as Record<string, unknown>)?.search?.products ??
    (pageProps?.initialState as Record<string, unknown>)?.search?.products ??
    (pageProps?.searchData as Record<string, unknown>)?.products ??
    pageProps?.products ??
    []
  ) as Record<string, unknown>[]

  if (!candidates.length) {
    console.log('[__NEXT_DATA__] No products found in known paths. Logging pageProps structure:')
    console.log(JSON.stringify(pageProps, null, 2).slice(0, 3000))
    return []
  }

  const products = mapProducts(candidates)
  console.log(`[__NEXT_DATA__] Extracted ${products.length} products (imageUrl present on ${products.filter(p => p.imageUrl).length})`)
  return products
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

  // Firefox uses NSS (not BoringSSL like Chromium), giving it a different
  // TLS/JA3 fingerprint that Akamai's bot detection doesn't block.
  const browser = await firefox.launch({ headless: true })
  const context = await browser.newContext({
    viewport: VIEWPORT,
    // Don't spoof the UA — a Firefox TLS fingerprint + Chrome UA is a
    // detectable contradiction. Let Firefox send its own UA string.
    locale: 'en-AU',
    timezoneId: 'Australia/Sydney',
    extraHTTPHeaders: { 'Accept-Language': 'en-AU,en;q=0.9' },
  })

  const page = await context.newPage()

  // Intercept Kmart's internal search API responses.
  // The site is a React SPA that fetches product JSON from an internal API.
  // If we capture it, we can skip the Claude vision loop entirely.
  // Collect ALL matching responses (homepage + search page may both fire).
  const capturedApiResponses: unknown[] = []
  page.on('response', async (response) => {
    // Constructor.io is Kmart's search provider — only capture its search endpoint
    if (!/ac\.cnstrc\.com\/search\//.test(response.url())) return
    if (!response.ok()) return
    try {
      const json = await response.json()
      capturedApiResponses.push(json)
      console.log(`[API intercept] Captured from: ${response.url().slice(0, 100)}`)
    } catch {
      // body already consumed or parse error — ignore
    }
  })
  let products: Product[] = []

  try {
    // Warm up via homepage first — may establish Akamai session cookies
    // that make the subsequent search navigation pass bot checks.
    console.log('\n[Browser] Warming up via homepage...')
    try {
      await page.goto('https://www.kmart.com.au', {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      })
      await page.waitForTimeout(2000)
      console.log(`[Browser] Homepage loaded: "${await page.title()}"`)
    } catch (err) {
      console.log('[Browser] Homepage warm-up failed (non-fatal):', (err as Error).message)
    }

    const url = SEARCH_BASE_URL + encodeURIComponent(query)
    console.log(`\n[Browser] Navigating to: ${url}`)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Give JS time to render the product grid and fire API requests
    console.log('[Browser] Waiting for page to render...')
    await page.waitForTimeout(4000)

    // Fast path 1: __NEXT_DATA__ DOM extraction (works if search page is SSR)
    const nextDataProducts = await extractFromNextData(page)
    if (nextDataProducts.length > 0) {
      console.log('[__NEXT_DATA__] Success — skipping API interception and vision loop.')
      return nextDataProducts
    }

    // Fast path 2: if API interception captured product JSON, extract directly.
    if (capturedApiResponses.length > 0) {
      console.log(`[API intercept] Attempting direct extraction from ${capturedApiResponses.length} captured response(s)...`)
      for (const raw of capturedApiResponses) {
        try {
          const json = raw as Record<string, unknown>
          const data = json?.data as Record<string, unknown> | undefined
          const candidates: Record<string, unknown>[] = (
            // Constructor.io search response (Kmart's search provider)
            (json?.response as Record<string, unknown>)?.results ??
            // Generic GraphQL / REST fallbacks
            (data?.search as Record<string, unknown>)?.products ??
            (data?.search as Record<string, unknown>)?.results ??
            (data?.search as Record<string, unknown>)?.items ??
            (data?.searchResults as Record<string, unknown>)?.products ??
            (data?.searchPage as Record<string, unknown>)?.products ??
            (data?.categoryOrSearch as Record<string, unknown>)?.products ??
            (data?.kmart as Record<string, unknown>)?.search ??
            data?.products ?? data?.results ?? data?.items ??
            json?.results ?? json?.products ?? json?.items ??
            (json?.hits as Record<string, unknown>)?.hits ?? json?.hits ??
            []
          ) as Record<string, unknown>[]

          if (candidates.length > 0) {
            products = mapProducts(candidates)
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
                  imageUrl: {
                    type: 'string',
                    description: 'Product image URL if readable from page source (optional)',
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
