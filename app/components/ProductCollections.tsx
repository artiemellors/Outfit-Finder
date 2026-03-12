'use client'

import { useState } from 'react'

interface CollectionProduct {
  name: string
  price: string
  colour?: string
  productUrl?: string
  imageUrl?: string
}

export interface ProductCollection {
  name: string
  products: CollectionProduct[]
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-black/[0.08] rounded overflow-hidden">
      <div className="skeleton aspect-[4/5] w-full" />
      <div className="p-3 space-y-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
        <div className="skeleton h-3 w-1/3 rounded mt-1" />
      </div>
    </div>
  )
}

export function ProductCollections({ collections }: { collections: ProductCollection[] | null }) {
  const [activeTab, setActiveTab] = useState(0)
  const isLoading = collections === null

  // Reset active tab when collections change
  if (!isLoading && activeTab >= collections.length && collections.length > 0) {
    setActiveTab(0)
  }

  if (!isLoading && collections.length === 0) return null

  const activeCollection = isLoading ? null : collections[activeTab]

  return (
    <div id="ProductCollections" className="max-w-4xl mx-auto px-4 sm:px-8 pb-16">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-[--text-muted] mb-5">
        Shop the Edit
      </p>

      {/* ProductCollections — sticky collection tab bar */}
      <div id="ProductCollections-tabbar" className="sticky top-20 z-10 bg-[#f5f5f5] -mx-4 sm:-mx-8 px-4 sm:px-8 pt-4 pb-3 mb-6 flex gap-2 flex-wrap">
        {isLoading ? (
          <>
            <div className="skeleton h-8 w-28 rounded-full" />
            <div className="skeleton h-8 w-24 rounded-full" />
            <div className="skeleton h-8 w-32 rounded-full" />
          </>
        ) : (
          collections.map((col, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-1.5 rounded-full text-sm border transition-colors ${
                i === activeTab
                  ? 'border-[--accent] text-[--accent] bg-white'
                  : 'border-black/[0.08] text-[--text] bg-white hover:border-black/20'
              }`}
            >
              {col.name}
            </button>
          ))
        )}
      </div>

      {/* ProductCollections — product grid */}
      <div id="ProductCollections-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activeCollection ? (
          activeCollection.products.map((p, i) => (
            <a
              key={i}
              href={p.productUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              id="ProductCard"
              className="bg-white border border-black/[0.08] rounded-2xl overflow-hidden block hover:border-black/20 transition-colors"
            >
              {/* Product card — image */}
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="aspect-[4/5] w-full object-cover bg-[--surface2]"
                />
              ) : (
                <div className="aspect-[4/5] w-full bg-[--surface2]" />
              )}
              {/* Product card — text content (title, price, link) */}
              <div id="ProductCard-content" className="p-3">
                <p className="text-[14px] font-medium leading-tight line-clamp-2 text-[--text] mb-1">
                  {p.name}
                </p>
                <p className="text-xl font-bold text-[--text] leading-none mb-1">
                  <sup className="text-xs font-bold align-super">$</sup>
                  {p.price.startsWith('$') ? p.price.slice(1) : p.price}
                </p>
                <p className="text-[11px] font-semibold text-[--accent]">View at Kmart ↗</p>
              </div>
            </a>
          ))
        ) : null}
      </div>
    </div>
  )
}
