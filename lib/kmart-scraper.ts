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

function mapProducts(candidates: Record<string, unknown>[]): Product[] {
  // Deduplicate by (name, colour) — collapses size variants into one per colour
  const seen = new Set<string>()
  const deduplicated = candidates.filter(item => {
    const data = item.data as Record<string, unknown> | undefined
    const name = String(item.value ?? item.name ?? '')
    const colour = data?.Colour != null ? String(data.Colour) : ''
    const key = `${name}::${colour}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return deduplicated.slice(0, 24).map((item, i) => {
    const data = item.data as Record<string, unknown> | undefined
    const rawUrl = data?.url != null ? String(data.url)
      : item.url != null ? String(item.url)
      : item.productUrl != null ? String(item.productUrl)
      : item.pdpUrl != null ? String(item.pdpUrl)
      : undefined
    return {
      name: String(
        item.value ??
        item.name ?? item.displayName ?? item.title ?? item.productName ??
        `Product ${i + 1}`
      ),
      price: (() => {
        const raw = data?.price ??
          (item.price as Record<string, unknown>)?.current ??
          (item.price as Record<string, unknown>)?.min ??
          (item.price as Record<string, unknown>)?.value ??
          item.priceLabel ?? item.salePrice ?? item.regularPrice ?? item.price ?? 'Unknown'
        return typeof raw === 'number' ? `$${raw.toFixed(2)}` : String(raw)
      })(),
      colour: data?.Colour != null ? String(data.Colour) : undefined,
      productUrl: rawUrl != null
        ? rawUrl.startsWith('http') ? rawUrl : `https://www.kmart.com.au${rawUrl}`
        : undefined,
      imageUrl: data?.image_url != null ? String(data.image_url)
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

// Restrict to adult categories — excludes Boys Clothing, Girls Clothing, Baby, Schoolwear, Kids Shoes
const ADULT_CATEGORY_FILTER =
  '&filters%5BCategory%5D%5B%5D=Clothing' +
  '&filters%5BCategory%5D%5B%5D=Activewear' +
  '&filters%5BCategory%5D%5B%5D=Shoes'

const CLOTHING_KEYWORDS = [
  'dress', 'shirt', 'pants', 'jacket', 'shoes', 'footwear', 'skirt', 'jeans',
  'shorts', 'blazer', 'tracksuit', 'leggings', 'swimwear', 'sleepwear', 'top',
  'boot', 'heel', 'sneaker', 'apparel', 'clothing', 'fashion', 'wear', 'denim',
  'coat', 'suit', 'tshirt', 't-shirt', 'hoodie', 'jumper', 'cardigan', 'blouse',
  'vest', 'sock', 'hat', 'cap', 'bag', 'tote', 'sandal', 'flat', 'loafer',
  'mule', 'slipper', 'flannel', 'cargo', 'bucket', 'linen', 'cotton', 'hi-vis',
  'mens', 'womens', 'men\'s', 'women\'s', 'hi vis', 'everlast',
]

export async function fetchCollections(): Promise<Collection[]> {
  const url =
    `https://ac.cnstrc.com/browse/collections` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=200`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return []
  const json = await res.json() as Record<string, unknown>
  const all = ((json?.response as Record<string, unknown>)?.collections ?? []) as Array<{ id: string; display_name: string }>

  return all
    .filter(c => {
      const text = `${c.id} ${c.display_name}`.toLowerCase()
      return CLOTHING_KEYWORDS.some(kw => text.includes(kw))
    })
    .map(c => ({ id: c.id, display_name: c.display_name }))
}

export async function browseCollection(collectionId: string): Promise<Product[]> {
  const url =
    `https://ac.cnstrc.com/browse/collection_id/${encodeURIComponent(collectionId)}` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24`
  console.log(`\n[Collection] Browsing "${collectionId}"`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.log(`[Collection] HTTP ${res.status} — returning empty`)
    return []
  }
  const json = await res.json() as Record<string, unknown>
  const candidates = ((json?.response as Record<string, unknown>)?.results ?? []) as Record<string, unknown>[]
  const products = mapProducts(candidates)
  console.log(`[Collection] ${products.length} products in "${collectionId}"`)
  return products
}

export async function searchKmart(query: string): Promise<Product[]> {
  const url =
    `https://ac.cnstrc.com/search/${encodeURIComponent(query)}` +
    `?key=key_GZTqlLr41FS2p7AY&c=ciojs-client-2.71.1&num_results_per_page=24` +
    ADULT_CATEGORY_FILTER
  console.log(`\n[Search] ${query}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) {
    console.log(`[Search] HTTP ${res.status} — returning empty`)
    return []
  }
  const json = await res.json() as Record<string, unknown>
  const candidates = ((json?.response as Record<string, unknown>)?.results ?? []) as Record<string, unknown>[]
  const products = mapProducts(candidates)
  console.log(`[Search] ${products.length} products for "${query}"`)
  return products
}
