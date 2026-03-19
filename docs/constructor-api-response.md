# Constructor.io API — Response Field Reference

> Verified against live API calls to `ac.cnstrc.com` on 2026-03-18.
> Endpoint: `GET /search/{query}` and `GET /browse/collection_id/{id}`

---

## Top-level response shape

```json
{
  "response": {
    "result_sources": { ... },
    "facets": [ ... ],
    "groups": [ ... ],
    "results": [ ... ],       // ← product items
    "sort_options": [ ... ],
    "refined_content": [ ... ],
    "total_num_results": 1234,
    "features": [ ... ],
    "related_searches": [ ... ],
    "related_browse_pages": [ ... ]
  }
}
```

---

## Per-result shape (`response.results[n]`)

| Field | Type | Description |
|---|---|---|
| `value` | `string` | Product display name (e.g. `"Long Sleeve Jacquard Top"`) |
| `matched_terms` | `string[]` | Which query terms matched this result |
| `is_slotted` | `boolean` | Whether the result was manually pinned/promoted |
| `labels` | `object` | Merchandising labels — see below |
| `data` | `object` | Core product data — see below |
| `variations` | `object[]` | Per-size/colour variants — same shape as `data` |

---

## `data` fields

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Product ID, e.g. `"P_S174095"` |
| `url` | `string` | Relative PDP path, e.g. `"/product/long-sleeve-jacquard-top-s174095/"` |
| `uri` | `string` | Same as `url` |
| `Brand` | `string` | e.g. `"Anko"` |
| `apn` | `number` | Australian Product Number (barcode) |
| `price` | `number` | Current price as a number, e.g. `15` |
| `prices` | `object[]` | Structured price array — see below |
| `Colour` | `string` | Primary colour label, e.g. `"Brown"` |
| `SecondaryColour` | `string` | Secondary/descriptive colour, e.g. `"Melt Brown"` |
| `Size` | `string` | Size for this variant, e.g. `"12"` |
| `image_url` | `string` | **Full URL** to the primary product image (580×725px) |
| `altImages` | `string[]` | Additional image IDs (UUID/asset-id format — **not full URLs**) |
| `arEnabled` | `boolean` | AR try-on enabled |
| `video` | `object` | Product video (usually empty `{}`) |
| `badges` | `array` | Product badges (usually empty) |
| `variant_badges` | `array` | Variant-level badges |
| `badgesMarketplace` | `object` | Seller badge info (e.g. `"kmart"`) |
| `Seller` | `string[]` | e.g. `["Kmart"]` |
| `clearance` | `boolean` | Whether the product is on clearance |
| `is_default` | `boolean` | Whether this variant is the default displayed |
| `variation_id` | `string` | Numeric string ID for this specific variant |
| `variant_video` | `object` | Variant-level video (usually empty `{}`) |
| `FreeShipping` | `boolean` | Eligible for free shipping |
| `FreeShippingMetro` | `boolean` | Eligible for free metro shipping |
| `FulfilmentChannel` | `number` | Internal fulfilment channel code |
| `MerchDepartment` | `number` | Internal merchandising department code |
| `AssortedProducts` | `boolean` | Whether this is an assorted/mixed product |
| `isPreOrderActive` | `boolean` | Whether pre-order is active |
| `nationalInventory` | `boolean` | Inventory is managed nationally |
| `primaryCategoryId` | `string` | UUID of primary category |
| `group_ids` | `string[]` | UUIDs of all category groups this product belongs to |

### `prices` array

Each element:

```json
{
  "type": "list",        // "list" = regular price
  "amount": "15.00",    // string decimal
  "country": "AU",
  "currency": "AUD",
  "startDate": "1899-12-30",
  "endDate": "9999-12-31"
}
```

Sale/was prices would appear as additional entries with different `type` values and real date ranges.

---

## `labels` fields

| Field | Notes |
|---|---|
| `__cnstrc_is_new_arrivals` | `value` is `null` or a truthy value |
| `__cnstrc_is_global_bestseller` | `value` is `null` or a truthy value |

---

## Images — important detail

**Primary image** (`data.image_url`) is a **complete URL**:
```
https://assets.kmart.com.au/transform/{uuid}/{asset-id}?io=transform:fill,width:580,height:725
```

**Alt images** (`data.altImages`) are **partial IDs only**, e.g.:
```
"318ff415-3116-4146-b7b3-1a27b3ce8cd7/73925668-2"
```
To reconstruct a full URL, prefix with `https://assets.kmart.com.au/transform/` and append the same `?io=` transform query string.

A typical product returns **6 alt images** plus the 1 primary — **7 total**.

---

## What we do NOT get

| Data | Available? | Notes |
|---|---|---|
| Star ratings | ❌ | Not in this API |
| Review count | ❌ | Not in this API |
| Review text | ❌ | Not in this API |
| Product description | ❌ | Not in this API — PDP scrape needed |
| Stock level | ❌ | Not in this API |
| Category name (string) | ❌ | Only UUIDs via `primaryCategoryId` / `group_ids` |
| Sale/was price | ⚠️ | Possible via `prices` array but not seen in testing |

Reviews and ratings are served from a separate endpoint (not Constructor.io) and would require a per-product PDP fetch or a dedicated reviews API call.

---

## What we currently map (vs what's available)

| `Product` field | Mapped from | Unused available fields |
|---|---|---|
| `name` | `value` | — |
| `price` | `data.price` | `data.prices[]` (structured, with sale support) |
| `colour` | `data.Colour` | `data.SecondaryColour` |
| `productUrl` | `data.url` | — |
| `imageUrl` | `data.image_url` | `data.altImages` (6 additional images) |
| — | — | `data.Brand` |
| — | — | `data.clearance` |
| — | — | `data.Size` |
| — | — | `labels.__cnstrc_is_new_arrivals` |
| — | — | `labels.__cnstrc_is_global_bestseller` |
