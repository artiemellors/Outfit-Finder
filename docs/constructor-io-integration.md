# Constructor.io Integration — Technical Reference

This document describes how Kurator integrates Constructor.io, and provides a step-by-step guide for replicating the same pattern against any other e-commerce site powered by Constructor.io.

---

## Table of Contents

1. [What is Constructor.io](#1-what-is-constructorio)
2. [Identifying a Constructor.io-powered site](#2-identifying-a-constructorio-powered-site)
3. [API endpoint reference](#3-api-endpoint-reference)
4. [Discovering a retailer's taxonomy](#4-discovering-a-retailers-taxonomy)
5. [Kurator's code architecture](#5-kurators-code-architecture)
6. [Step-by-step: adapting for a new retailer](#6-step-by-step-adapting-for-a-new-retailer)
7. [Multi-retailer architecture (optional refactor)](#7-multi-retailer-architecture-optional-refactor)

---

## 1. What is Constructor.io

Constructor.io is a SaaS search and product discovery platform used by many retailers. It powers the site search, browse, collections/curations, and recommendations experience that shoppers see.

**Key facts for integration purposes:**

- The REST API lives at `https://ac.cnstrc.com`
- The endpoint structure is **identical across all Constructor.io customers** — only the API key and the data taxonomy inside responses differ
- The API key is **intentionally public** (same model as Algolia's search-only key). It is shipped in browser JavaScript and visible in all network requests. It is safe to use server-side
- Authentication is purely via a `key` query parameter — no OAuth, no signed headers

---

## 2. Identifying a Constructor.io-powered site

Open the target retailer's website, open DevTools, and go to the **Network** tab.

1. Perform a search or browse a category on the site
2. Filter network requests by `cnstrc` or `ac.cnstrc.com`
3. Click any matching request and inspect the URL

You will see something like:

```
https://ac.cnstrc.com/search/blue%20jeans?key=key_XXXXXXXXXXXXXXXX&c=ciojs-client-2.71.1&num_results_per_page=24
```

From this URL you can immediately extract:

| URL component | Example | What it is |
|---|---|---|
| `key=` | `key_GZTqlLr41FS2p7AY` | The retailer's Constructor.io API key |
| `c=` | `ciojs-client-2.71.1` | Client library version (informational only) |
| Path prefix | `/search/`, `/browse/` | Which endpoint type is being used |

Also note which endpoint paths appear in the network tab — this tells you which Constructor.io features the retailer has enabled:

| Path | Feature |
|---|---|
| `/search/{query}` | Keyword search |
| `/browse/collection_id/{id}` | Curated collections |
| `/browse/collections` | List all collections |
| `/autocomplete/{query}` | Search-as-you-type |
| `/recommendations/...` | Product recommendations |

Kurator uses the first three.

---

## 3. API endpoint reference

All requests require `key=YOUR_API_KEY` as a query parameter. The `c=ciojs-client-2.71.1` parameter is optional but mimics the official JS client and is good practice to include.

### 3.1 List collections

Returns all curated product collections the retailer has configured.

```
GET https://ac.cnstrc.com/browse/collections
  ?key=KEY
  &c=ciojs-client-2.71.1
  &num_results_per_page=200
```

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `key` | Yes | API key |
| `num_results_per_page` | No | Max collections to return (default varies; use 200 to get all) |

**Response shape:**

```json
{
  "response": {
    "collections": [
      {
        "id": "blazers-for-women",
        "display_name": "Blazers for Women",
        "data": { ... }
      },
      {
        "id": "mens-activewear",
        "display_name": "Men's Activewear",
        "data": { ... }
      }
    ],
    "total_num_results": 187
  }
}
```

**How Kurator uses it:** Called once per search request to build a menu of available collections. The result is filtered by keyword and injected into Claude's system prompt so Claude knows which collection IDs it can call `browse_collection` with.

---

### 3.2 Browse a collection

Returns products within a specific curated collection.

```
GET https://ac.cnstrc.com/browse/collection_id/{COLLECTION_ID}
  ?key=KEY
  &c=ciojs-client-2.71.1
  &num_results_per_page=24
```

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `key` | Yes | API key |
| Collection ID | Yes | URL-encoded collection ID in the path, e.g. `blazers-for-women` |
| `num_results_per_page` | No | Products to return (Kurator uses 24) |

**Response shape:**

```json
{
  "response": {
    "results": [
      {
        "value": "Women's Oversized Blazer",
        "name": "Women's Oversized Blazer",
        "data": {
          "price": 39.00,
          "image_url": "https://cdn.kmart.com.au/images/...",
          "url": "/product/womens-oversized-blazer-12345",
          "Colour": "Black"
        }
      }
    ],
    "total_num_results": 18
  }
}
```

**How Kurator uses it:** Claude calls `browse_collection` as a tool when a collection ID closely matches the user's request. The server intercepts the tool call, fetches from this endpoint, and returns the products to Claude.

---

### 3.3 Search

Searches for products by keyword, with optional facet filters.

```
GET https://ac.cnstrc.com/search/{QUERY}
  ?key=KEY
  &c=ciojs-client-2.71.1
  &num_results_per_page=24
  &filters%5BCategory%5D%5B%5D=Clothing
  &filters%5BCategory%5D%5B%5D=Activewear
```

**Parameters:**

| Parameter | Required | Description |
|---|---|---|
| `key` | Yes | API key |
| Query | Yes | URL-encoded search term in the path |
| `num_results_per_page` | No | Products to return (Kurator uses 24) |
| `filters[FACET][]` | No | URL-encoded facet filter; repeatable for multiple values |

**Filter encoding:** The filter key `filters[Category][]` URL-encodes to `filters%5BCategory%5D%5B%5D`. Each additional category value is a separate repeated parameter:

```
# Decoded:
filters[Category][]=Clothing&filters[Category][]=Activewear&filters[Category][]=Shoes

# Encoded (as used in Kurator):
&filters%5BCategory%5D%5B%5D=Clothing&filters%5BCategory%5D%5B%5D=Activewear&filters%5BCategory%5D%5B%5D=Shoes
```

**Response shape:** Same as browse — `response.results[]` with the same product object structure.

**How Kurator uses it:** Claude calls `search_kmart` with a natural language query. The server appends the pre-configured `categoryFilter` string for the active category and fetches from this endpoint.

---

## 4. Discovering a retailer's taxonomy

Every retailer configures their own facet names and collection IDs inside Constructor.io. You cannot assume they match Kmart's. Here is how to discover them for a new site.

### Finding facet names

In DevTools Network tab, look at the query parameters of any existing search or browse request made by the site's own UI. The filter parameters the site itself sends reveal the valid facet names.

Alternatively, inspect the response of any search request — it includes a `facets` array:

```json
{
  "response": {
    "results": [...],
    "facets": [
      {
        "name": "Category",
        "display_name": "Category",
        "options": [
          { "value": "Clothing", "count": 142 },
          { "value": "Activewear", "count": 88 }
        ]
      },
      {
        "name": "Colour",
        "display_name": "Colour",
        "options": [...]
      }
    ]
  }
}
```

The `name` field on each facet is the key to use in filter parameters.

### Finding collection IDs

Call the collections endpoint directly in your browser or with curl, substituting the retailer's API key:

```bash
curl "https://ac.cnstrc.com/browse/collections?key=YOUR_KEY&num_results_per_page=200" | jq '.response.collections[].id'
```

This returns all collection IDs. Use these to populate `collectionKeywords` in the category config.

### Finding product data field names

Call any search or browse endpoint and inspect `response.results[0].data`:

```bash
curl "https://ac.cnstrc.com/search/jeans?key=YOUR_KEY&num_results_per_page=1" | jq '.response.results[0]'
```

Common field names vary by retailer:

| What you need | Kmart field | Other common fields |
|---|---|---|
| Product name | `value` or `name` | `title`, `displayName`, `productName` |
| Price | `data.price` | `price.current`, `price.min`, `priceLabel`, `salePrice` |
| Image | `data.image_url` | `primaryImage.url`, `images[0].url`, `imageUrl`, `thumbnail` |
| Product URL | `data.url` | `url`, `productUrl`, `pdpUrl` |
| Colour/variant | `data.Colour` | `data.color`, `data.variant`, varies widely |

---

## 5. Kurator's code architecture

### 5.1 File map

```
lib/
  kmart-scraper.ts      — Constructor.io fetch wrapper (3 exported functions + mapProducts helper)
  category-config.ts    — Per-category taxonomy config (category filters, collection keywords)
app/
  api/search/route.ts   — Next.js API route; Claude tool-call loop; orchestrates everything
```

---

### 5.2 `lib/kmart-scraper.ts` — Constructor.io wrapper

The single file that talks to Constructor.io. Contains no business logic — just fetch, parse, and normalise.

#### Interfaces

```typescript
export interface Product {
  name: string
  price: string
  colour?: string
  productUrl?: string
  imageUrl?: string
}

export interface Collection {
  id: string
  display_name: string
}
```

#### `fetchCollections(keywords: string[]): Promise<Collection[]>`

Fetches all collections and filters to those relevant to the active category.

```typescript
export async function fetchCollections(keywords: string[]): Promise<Collection[]> {
  const url =
    `https://ac.cnstrc.com/browse/collections` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=200`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json()
  const all = json?.response?.collections ?? []

  return all
    .filter(c => {
      const text = `${c.id} ${c.display_name}`.toLowerCase()
      return keywords.some(kw => text.includes(kw))
    })
    .map(c => ({ id: c.id, display_name: c.display_name }))
}
```

**Usage:** Called once per search request, before the Claude loop starts. The filtered list is injected into Claude's system prompt as a lookup table of available collection IDs.

---

#### `browseCollection(collectionId: string): Promise<Product[]>`

Fetches products within a specific curated collection.

```typescript
export async function browseCollection(collectionId: string): Promise<Product[]> {
  const url =
    `https://ac.cnstrc.com/browse/collection_id/${encodeURIComponent(collectionId)}` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json()
  const candidates = json?.response?.results ?? []
  return mapProducts(candidates)
}
```

**Usage:** Called when Claude's `browse_collection` tool call is intercepted in `route.ts`.

---

#### `searchKmart(query: string, categoryFilter?: string): Promise<Product[]>`

Searches for products by keyword with optional pre-built category filter string.

```typescript
export async function searchKmart(query: string, categoryFilter = ''): Promise<Product[]> {
  const url =
    `https://ac.cnstrc.com/search/${encodeURIComponent(query)}` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24` +
    categoryFilter
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json()
  const candidates = json?.response?.results ?? []
  return mapProducts(candidates)
}
```

**Usage:** Called when Claude's `search_kmart` tool call is intercepted. `categoryFilter` is the pre-built URL-encoded string from `CategoryConfig.categoryFilter`.

---

#### `mapProducts(candidates)` — internal helper

Transforms raw Constructor.io result items into typed `Product` objects.

**Deduplication** — collapses size variants. Products with the same `(name, colour)` tuple are collapsed to one entry. This is important because Constructor.io commonly returns one item per SKU (i.e. per size), so a t-shirt in sizes XS–3XL appears as 6 results.

```typescript
const seen = new Set<string>()
const deduplicated = candidates.filter(item => {
  const name = String(item.value ?? item.name ?? '')
  const colour = item.data?.Colour != null ? String(item.data.Colour) : ''
  const key = `${name}::${colour}`
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
```

**Field mapping with fallback chains** — handles variation across retailer configurations:

```typescript
{
  name: item.value ?? item.name ?? item.displayName ?? item.title ?? item.productName ?? `Product ${i}`,

  price: (() => {
    const raw = data?.price
      ?? item.price?.current ?? item.price?.min ?? item.price?.value
      ?? item.priceLabel ?? item.salePrice ?? item.regularPrice ?? item.price
      ?? 'Unknown'
    return typeof raw === 'number' ? `$${raw.toFixed(2)}` : String(raw)
  })(),

  colour: data?.Colour != null ? String(data.Colour) : undefined,

  productUrl: rawUrl?.startsWith('http') ? rawUrl : `https://www.kmart.com.au${rawUrl}`,

  imageUrl: data?.image_url
    ?? item.primaryImage?.url ?? item.primaryImage
    ?? item.images?.[0]?.url ?? item.images?.[0]
    ?? item.imageUrl ?? item.image ?? item.thumbnail
    ?? undefined,
}
```

**Cap:** Slices to 24 products after deduplication.

---

### 5.3 `lib/category-config.ts` — taxonomy mapping

Defines per-category Constructor.io configuration. The two Constructor.io-specific fields are:

#### `categoryFilter: string`

Pre-built URL-encoded filter string appended to every `search_kmart` request for this category. Restricts search results to relevant Constructor.io categories.

```typescript
// Outfits category — decoded: filters[Category][]=Clothing, Activewear, Shoes
categoryFilter:
  '&filters%5BCategory%5D%5B%5D=Clothing' +
  '&filters%5BCategory%5D%5B%5D=Activewear' +
  '&filters%5BCategory%5D%5B%5D=Shoes',

// Home & Living — 15 category values
categoryFilter:
  '&filters%5BCategory%5D%5B%5D=Cushions' +
  '&filters%5BCategory%5D%5B%5D=Rugs' +
  // ... etc
```

Use an empty string (`''`) for no category restriction.

#### `collectionKeywords: string[]`

Keywords used to filter the full list of ~200 Kmart collections down to those relevant to this category. Matched against both the collection `id` and `display_name` (lowercase).

```typescript
// Outfits category
collectionKeywords: [
  'dress', 'shirt', 'pants', 'jacket', 'shoes', 'footwear', 'skirt', 'jeans',
  'shorts', 'blazer', 'tracksuit', 'leggings', 'swimwear', 'top', 'boot',
  'heel', 'sneaker', 'clothing', 'fashion', 'wear', 'denim', 'hoodie',
  'mens', 'womens', "men's", "women's",
  // ...
],
```

A collection passes the filter if any keyword appears anywhere in `"${collection.id} ${collection.display_name}".toLowerCase()`.

---

### 5.4 `app/api/search/route.ts` — orchestration layer

The Next.js API route that ties Constructor.io to Claude. Accepts a POST with `{ query, gender, category }` and returns a Server-Sent Events stream.

#### Full data flow

```
POST /api/search { query, gender, category }
  │
  ├─ 1. fetchCollections(config.collectionKeywords)
  │      → ac.cnstrc.com/browse/collections
  │      → filtered collection list injected into Claude system prompt
  │
  ├─ 2. Claude tool-call loop begins (claude-sonnet-4-6, tool_choice: "any")
  │
  │   Turn 1: Claude emits tool calls (up to 5 in parallel):
  │   ├─ search_kmart("men's black chinos")
  │   ├─ search_kmart("white Oxford shirt men's")
  │   └─ browse_collection("mens-casual-footwear")
  │
  ├─ 3. Server intercepts all tool calls, fetches Constructor.io in parallel:
  │      → searchKmart("men's black chinos", config.categoryFilter)
  │      → searchKmart("white Oxford shirt men's", config.categoryFilter)
  │      → browseCollection("mens-casual-footwear")
  │
  ├─ 4. Product ID tagging:
  │      - Claude receives top 10 products per call, tagged q0p0…q0p9, q1p0…, etc.
  │      - Full 24 products stored in fullPool (invisible to Claude)
  │      - productMap stores Claude's 10 for reference resolution later
  │
  │   Turn 2: Claude calls present_outfits with product IDs
  │
  ├─ 5. Outfit resolution:
  │      - Claude's product ID references resolved back to full Product objects
  │      - SSE event: { type: 'done', result: outfits[] }
  │
  └─ 6. Collections pass (parallel to frontend rendering):
         - Products NOT referenced by any outfit slot taken from fullPool
         - Second Claude call groups them into 2–3 themed collections
         - SSE event: { type: 'collections', result: collections[] }
```

#### Product ID scheme

```
q{searchIndex}p{productIndex}   — products shown to Claude (top 10)
q{searchIndex}x{productIndex}   — overflow products in fullPool only (positions 11–24)
```

This scheme lets the server track which products Claude referenced vs which remained unused, enabling the collections pass to use the overflow without re-fetching from Constructor.io.

#### Gender filtering

Applied server-side after Constructor.io returns results, before products are sent to Claude:

```typescript
const WOMENS_TERMS = /\b(women'?s?|ladies|girl'?s?|feminine|womens)\b/i
const MENS_TERMS   = /\b(men'?s?|guy'?s?|boys?|masculine|mens)\b/i

function filterByGender(products: Product[], gender: 'men' | 'women' | null): Product[] {
  if (!gender) return products
  const excludePattern = gender === 'men' ? WOMENS_TERMS : MENS_TERMS
  return products.filter(p => !excludePattern.test(p.name))
}
```

Only applied for categories where `config.showGenderFilter === true` (currently: Outfits only).

---

## 6. Step-by-step: adapting for a new retailer

### Step 1 — Find the API key

1. Open the target retailer's site in Chrome/Firefox
2. DevTools → Network tab → filter for `cnstrc`
3. Search or browse any category on the site
4. Click any `ac.cnstrc.com` request, copy the `key=` value from the URL

Verify it works:

```bash
curl "https://ac.cnstrc.com/browse/collections?key=YOUR_KEY_HERE&num_results_per_page=5"
```

If you get a JSON response with a `response.collections` array, the key is valid.

### Step 2 — Enumerate collections

```bash
curl "https://ac.cnstrc.com/browse/collections?key=YOUR_KEY&num_results_per_page=200" \
  | jq '.response.collections[] | {id, display_name}'
```

Save the output. You will use the collection IDs to build `collectionKeywords`.

### Step 3 — Discover product data shape

Pick a generic search term relevant to the retailer:

```bash
curl "https://ac.cnstrc.com/search/shirt?key=YOUR_KEY&num_results_per_page=1" \
  | jq '.response.results[0]'
```

Examine the full result object. Note which fields contain:
- Product name (`value`, `name`, `title`, etc.)
- Price (`data.price`, `price.current`, `price.min`, etc.)
- Image URL (`data.image_url`, `primaryImage`, `images[0].url`, etc.)
- Product URL (`data.url`, `url`, `pdpUrl`, etc.)
- Colour/variant (`data.Colour`, `data.color`, `data.variant`, etc.)

### Step 4 — Discover facet taxonomy

```bash
curl "https://ac.cnstrc.com/search/shirt?key=YOUR_KEY&num_results_per_page=1" \
  | jq '.response.facets[] | {name, options: .options[:3]}'
```

Note the facet `name` values — these are the keys to use in `filters[NAME][]` parameters.

Also inspect what values appear under the category facet to determine valid filter values.

### Step 5 — Update the scraper

In `lib/kmart-scraper.ts` (or a new file per retailer):

1. **Replace the API key:**
   ```typescript
   // Before
   `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1`

   // After
   `?key=YOUR_RETAILER_KEY&c=ciojs-client-2.71.1`
   ```

2. **Update `mapProducts()` field mappings** to match the retailer's data shape. Adjust the fallback chains for `name`, `price`, `imageUrl`, `productUrl`, and `colour` based on what you found in Step 3.

3. **Update URL normalisation** — change the hardcoded domain:
   ```typescript
   // Before (Kmart)
   rawUrl.startsWith('http') ? rawUrl : `https://www.kmart.com.au${rawUrl}`

   // After (new retailer)
   rawUrl.startsWith('http') ? rawUrl : `https://www.newretailer.com${rawUrl}`
   ```

### Step 6 — Update the category config

In `lib/category-config.ts`, for each category:

1. **`categoryFilter`** — build the URL-encoded filter string using the facet taxonomy from Step 4:
   ```typescript
   // Template
   categoryFilter:
     '&filters%5B{FACET_NAME}%5D%5B%5D={VALUE_1}' +
     '&filters%5B{FACET_NAME}%5D%5B%5D={VALUE_2}',
   ```

   URL-encoding reference:
   - `[` → `%5B`
   - `]` → `%5D`
   - ` ` → `%20`
   - `&` → `%26`

2. **`collectionKeywords`** — pick keywords that appear in the collection IDs you listed in Step 2, grouped by relevance to each category.

### Step 7 — Test each endpoint directly

Before running the full app, test each function in isolation:

```typescript
// Quick smoke test (run with ts-node or similar)
import { fetchCollections, searchKmart, browseCollection } from './lib/kmart-scraper'

// Should return a non-empty filtered list
console.log(await fetchCollections(['shirt', 'dress', 'denim']))

// Should return up to 24 deduplicated products
console.log(await searchKmart("summer dress", "&filters%5BCategory%5D%5B%5D=Clothing"))

// Should return products for a known collection ID
console.log(await browseCollection("your-known-collection-id"))
```

Verify each result contains sensible `name`, `price`, `imageUrl`, and `productUrl` values. If any field is `undefined`, revisit the field mapping in `mapProducts()`.

---

## 7. Multi-retailer architecture (optional refactor)

If building an app that targets multiple Constructor.io retailers simultaneously, the cleanest approach is to parameterise the scraper:

```typescript
export interface RetailerConfig {
  apiKey: string
  baseProductUrl: string      // e.g. "https://www.retailer.com"
  fieldMappings: {
    name: string[]            // ordered list of field paths to try
    price: string[]
    imageUrl: string[]
    productUrl: string[]
    colour: string[]
  }
}

export function createScraper(retailer: RetailerConfig) {
  return {
    fetchCollections: (keywords: string[]) => fetchCollections(keywords, retailer),
    browseCollection: (id: string) => browseCollection(id, retailer),
    search: (query: string, categoryFilter?: string) => search(query, retailer, categoryFilter),
  }
}
```

Store per-retailer configs in `lib/retailers/`:

```
lib/
  retailers/
    kmart.ts
    myer.ts
    target-au.ts
```

Each exports a `RetailerConfig` object. The category config then references a retailer by name, and the API route selects the appropriate scraper instance based on the active retailer.
