# Request lifecycle

How a search request flows through the system end-to-end, annotated against real
Render logs.

---

## Tools Claude uses

### Outfit recommendation — agentic tool-use loop (`claude-sonnet-4-6`)

Claude runs in a multi-turn loop with three tools:

| Tool | Purpose |
|---|---|
| `search_kmart` | Search Kmart.com.au for products matching a free-text query. Returns up to 10 products (id, name, price, colour). |
| `browse_collection` | Browse a pre-curated Kmart collection by id. Returns the same product shape as `search_kmart`. |
| `present_outfits` | **Terminal tool.** Claude calls this once to deliver its structured outfit picks and refinement chips. The loop ends when this is called. |

Claude decides how many searches to run and may call `search_kmart`/`browse_collection` multiple times before calling `present_outfits`. All tool calls within a single turn are fired in parallel.

### Collections — single structured JSON call (`claude-sonnet-4-6`)

After outfits are delivered, a second independent Claude call takes all products that were
scraped but *not* used in any outfit (the full pool) and groups them into 2–3 themed
collections (e.g. "Resort Ready", "Weekend Edit"). No tools are used — Claude returns plain
JSON. This runs after the main response is sent so it does not block the user.

---

## /api/search

### Turn 1 — Claude decides what to search

```
[Claude] Turn 1 — calling API…
[Claude] Turn 1 — stop_reason: tool_use, blocks: 5
```

The user's search prompt is sent to Claude. It responds with `stop_reason: tool_use`
— meaning instead of answering in text, it returned **tool calls** (5 in this example).
Four are `search_kmart` calls, one is `browse_collection`.

### Parallel scraping

```
[Claude] Fetching 5 sources in parallel: "men's chino pants", "men's polo shirt", …
[Search] All 5 fetches done in 335ms
```

All tool calls are fired simultaneously against the Kmart Construct.io API. This is the
key performance win — 5 scrapes in ~335ms combined rather than sequentially.

### Trimming before sending back to Claude

```
[Search] "men's chino pants" → 24 total, 10 to Claude
```

Kmart may return up to 24 products per search, but only 10 are forwarded to Claude per
source. This caps context window growth and reduces token cost. The remaining products
are not discarded — see the product pool below.

### Turn 2 — Claude curates

```
[Claude] Turn 2 — calling API…
[Claude] Turn 2 — stop_reason: tool_use, blocks: 1
[Claude] present_outfits called — 4 outfits
```

Claude receives all trimmed product data and responds with a single `present_outfits`
tool call containing structured outfit objects. `present_outfits` is a **terminal tool**
— the server does not call the Claude API again after receiving it.

### Product pool for collections

```
[Collections] 90 unused products in pool for collections
```

All products that were scraped but not forwarded to Claude are kept in an in-memory pool
for that request. A fast Sonnet call then assigns them to named collections (e.g. "Sharp
& Relaxed"), which power the "browse similar items" sidebar. This happens after the main
response is sent, so it doesn't block the user.

### Response time

```
responseTimeMS=27117 responseBytes=33439
```

The entire `/api/search` request is a single long-lived HTTP connection. ~27 seconds
here is almost entirely Claude's Turn 2 inference time — the scraping itself is
sub-second. The response is ~33KB of JSON (outfit objects with product data).

---

## /api/visualise

```
[POST] /api/visualise  ×3
responseTimeMS=14418  responseBytes=2183339
```

After receiving outfits, the user clicked "Visualise" on 3 outfits. Each call sends
product images to the Gemini API, which composites them into a styled scene. The ~2MB
response is the generated image returned as base64. Each outfit fires its own
independent POST, so they run in parallel in the browser.

---

## Summary timeline

```
User submits search
  └─ Claude Turn 1: decide tool calls          (fast, ~1–2s)
  └─ N Kmart scrapes in parallel               (~300–500ms)
  └─ Claude Turn 2: curate outfits             (~20–25s)
  └─ Response sent to browser                  (33KB JSON)

User clicks Visualise
  └─ N × /api/visualise in parallel            (~10–15s each)
  └─ Gemini generates composite scene image    (~2MB base64 per image)

Background (after search response):
  └─ Sonnet assigns pool products to collections
```

The dominant cost in `/api/search` is Claude's inference on Turn 2, not scraping.
The dominant cost in `/api/visualise` is Gemini image generation.
