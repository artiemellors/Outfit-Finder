# Outfit Kurator

An AI-powered personal shopping assistant that builds complete outfit recommendations from Kmart Australia's product catalog. Describe the look you want in plain English, and Claude searches across clothing categories, selects matching products, and presents 2–4 curated outfits with real prices and direct links.

![Outfit Kurator](https://img.shields.io/badge/built%20with-Claude%20Sonnet%204.6-blueviolet) ![Next.js](https://img.shields.io/badge/Next.js-15-black) ![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8)

---

## What it does

1. You type a prompt — *"smart casual look for a job interview"* — and optionally pick Men or Women
2. Claude decides which clothing categories to search (e.g. "men's chinos", "men's oxford shirt", "men's leather belt")
3. Those searches run in parallel against Kmart's live product catalog
4. Claude assembles 2–4 complete outfit options from the results
5. You browse each outfit, swap between alternative products per item, and follow direct links to Kmart

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 + React 19 (TypeScript) |
| AI | Anthropic Claude Sonnet 4-6 (`@anthropic-ai/sdk`) |
| Product data | Kmart Australia via Constructor.io search API |
| Styling | Tailwind CSS v4 + CSS custom properties |
| Fonts | Cormorant Garamond (serif) · DM Sans (sans-serif) |

---

## Getting started

**Prerequisites**: Node.js 18+, an Anthropic API key

```bash
# 1. Clone and install
git clone <repo-url>
cd Outfit-Finder
npm install
# postinstall automatically runs: npx playwright install firefox

# 2. Set your API key
cp .env.example .env.local
# edit .env.local and set ANTHROPIC_API_KEY=sk-ant-...

# 3. Run
npm run dev
# open http://localhost:3000
```

---

## How it works

### Architecture

```
Browser (page.tsx)
  │  POST { query, gender }
  ▼
/api/search (route.ts)
  │  Claude agentic loop — SSE stream back to browser
  │    ├─ tool: search_kmart → lib/kmart-scraper.ts
  │    │       └─ Constructor.io API → products[]
  │    └─ tool: present_outfits → structured outfit data
  ▼
OutfitResults.tsx
  └─ Tabs × outfits, cards × items, arrows to swap alternatives
```

### Claude agentic loop

The API route runs a tool-use loop with Claude. Two tools are exposed:

- **`search_kmart(query)`** — searches Kmart and returns up to 6 products (name, price, image, URL). Claude calls this once per clothing category; all calls within a turn run in parallel via `Promise.all`.
- **`present_outfits(outfits)`** — called once Claude is ready to present results. Terminates the loop and streams the structured outfit data to the browser.

Claude's system prompt instructs it to search no more than 5 categories, avoid duplicating categories, and call `present_outfits` with 2–4 complete outfit options. When a gender is selected, the prompt adds a hard constraint forcing all search queries to be prefixed with "men's" or "women's".

### Product search

`lib/kmart-scraper.ts` queries the Constructor.io API that Kmart uses internally:

```
https://ac.cnstrc.com/search/{query}?key=key_GZTqlLr41FS2p7AY&num_results_per_page=24
```

Results are parsed and normalised into `{ name, price, productUrl, imageUrl }` objects. No browser automation is needed for product search — the Constructor.io endpoint is public and fast.

### Streaming

The API route uses [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events) to push real-time updates to the browser while Claude works:

```json
{ "type": "status", "message": "Searching for \"men's chinos\"..." }
{ "type": "status", "message": "Found 8 options for \"men's chinos\"" }
{ "type": "done", "result": [ ...outfits ] }
```

The frontend shows an animated loading state (rotating fashion-voice copy + skeleton cards) until the `done` event arrives.

---

## Project structure

```
app/
  page.tsx                   Search form, gender toggle, typewriter placeholder, SSE handling
  layout.tsx                 Root layout, font imports, metadata
  globals.css                Design tokens, keyframe animations, skeleton styles
  api/search/route.ts        Claude agentic loop, tool definitions, SSE streaming
  components/
    OutfitResults.tsx        Outfit tabs, product cards, alternative cycling, price totals
lib/
  kmart-scraper.ts           Constructor.io product search + field normalisation
scripts/
  test-scraper.ts            Standalone scraper using Claude computer use (not used in prod)
```

---

## Design

The UI uses an editorial fashion-magazine aesthetic:

- **Palette**: warm beige background (`#f5f2ee`), magenta accent (`#e0208e`), white cards
- **Typography**: Cormorant Garamond for prices and outfit names, DM Sans for UI chrome
- **Animations**: `fadeUp` card entrances, `priceBounce` when totals change, `imgJiggle` on product swap, `shimmer` skeleton loading, indeterminate progress bar during search
- **Layout**: sticky summary sidebar (desktop) + vertical item cards; collapses to single column on mobile

---

## Build slices

The project was built slice by slice, validating one bet at a time before moving to the next.

### Slice 0 — Kmart scraper proof of concept

**Commit**: `26b9215`

Validated the core technical bet before any UI investment: can we reliably extract product data from Kmart at all?

Built a standalone Node.js scraper (`scripts/test-scraper.ts`) using **Claude computer use** (claude-opus-4-6) with Playwright. Claude would take screenshots of the browser, visually identify products on the page, and call an `extract_products` tool to return structured data. Kmart uses Akamai bot detection, so getting past it required Firefox (different TLS fingerprint from Chromium), a homepage warmup to establish session cookies, and realistic locale/timezone headers.

Later sub-slices (`0c`–`0g`) iterated on the scraper: switching to Firefox, adding Constructor.io API interception as a fast path, adding `__NEXT_DATA__` DOM extraction as a second fallback, and finally replacing the whole browser approach with a direct Constructor.io API call — which turned out to be public and much faster.

---

### Slice 1 — Next.js walking skeleton

**Commit**: `3dc50d4`

Stood up the minimum viable web app: Next.js 15, Tailwind CSS v4, a search form, and a `/api/search` route that called the scraper and returned raw JSON. The page rendered that JSON verbatim. The goal was to prove the plumbing worked end to end before building any real UI.

Also extracted the scraper into `lib/kmart-scraper.ts` as a proper importable module.

---

### Slice 2 — Agentic outfit curator with SSE streaming

**Commit**: `0cfdb4f`

Replaced the plain product-list endpoint with a Claude agentic loop. Instead of searching once and returning a flat list, Claude now:

1. Decides which clothing categories to search for a given request
2. Calls `search_kmart` for each category
3. Assembles the results into complete outfit recommendations
4. Signals completion via a `present_outfits` tool call

Added Server-Sent Events so status messages (e.g. *"Searching for men's jeans…"*) stream to the browser in real time rather than waiting for the full response.

**Slice 2b** (`bbd2b48`) fixed a rate-limiting problem: each `searchKmart()` call was launching a new Firefox instance, causing Akamai to block after 3 rapid launches. Fix: extract `createKmartSession()` to do one browser launch + warmup per request, then reuse the same page across all category searches.

After Slice 2 the scraper itself was replaced (`324ab1e`) with a direct Constructor.io API call, removing Playwright from the hot path entirely and cutting response time from ~60s to ~15s. Parallel searches (`c512fa1`) brought it down further.

---

### Slice 3 — Interactive outfit card UI

**Commit**: `a14769f`

Replaced the raw JSON output with actual UI. Created `OutfitResults.tsx` with:

- One card per outfit with name, description, and live total price
- One row per clothing item showing image, name, price, and a Kmart link
- Left/right arrows on each row to cycle through product alternatives
- Total price recalculates as you swap products

---

### Slice 4 — UI uplift (Gumroad-inspired design)

**Commit**: `a0f2904`

First design pass inspired by Gumroad's aesthetic: bold 2px black borders, `#FF90E8` pink accent, white cards on white, sticky pill navigation to show one outfit at a time (reducing cognitive load). Added image crossfade on product swap, price flash animation, and slide-in transition on outfit switch.

---

### Slice 5 — Design language refinement

**Commit**: `5923322`

Refined the Gumroad aesthetic: switched to a warm cream background (`#F2EFEA`), introduced CSS `clip-path` arrow-notch price tags, and normalised font weights for a cleaner, lighter feel. Price changes now animate with a scale bounce instead of a colour flash.

---

### Post-Slice 5 — Editorial redesign & UX polish

A series of focused improvements after the initial slices:

| Commit | Change |
|--------|--------|
| `48a2dc2` | Strip emojis from outfit names and descriptions |
| `76f69dc` | Subtle image jiggle animation on product swap |
| `23736b6` | **Editorial redesign** — Cormorant Garamond + DM Sans typography, magenta rebrand (`#e0208e`), paper grain overlay, 2-column desktop layout with sticky summary sidebar, CSS custom properties for the full design system |
| `0d1d59f` | Responsive layout: logo top-left, wider container, mobile padding |
| `0e79f23` | 4:5 portrait aspect ratio for product images |
| `0bb4013` | Force tool use on every Claude API turn (prevents stalling) |
| `c355e41` | **Editorial loading state** — rotating fashion-voice copy per phase (thinking / searching / curating), indeterminate progress bar, skeleton cards that mirror the real results layout |
| `c2a2f02` | **Typewriter placeholder** — cycles through example searches to show users the kinds of prompts that work; pauses while the input is focused |
| `c26dddb` | Expand example copy pool; shuffle queue prevents repetition |
| `ef8309c` | **Men / Women gender toggle** — pill buttons below the search bar; selection prefixes all Claude searches and updates the typewriter example pool |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (`sk-ant-...`) |

---

## Scripts

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run test:scraper # Run the standalone computer-use scraper (not used in prod)
```
