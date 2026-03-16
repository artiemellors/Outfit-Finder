'use client'

import { useState } from 'react'

const useKosmos = process.env.NEXT_PUBLIC_SHOW_NEW_FEATURE === 'true'

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
    <div className="w-full bg-white border-t border-[--border-soft]">
    <div id="ProductCollections" className="max-w-4xl mx-auto px-4 sm:px-8 pb-16">

      {/* Section heading */}
      {useKosmos ? (
        <p className="text-base font-bold text-[--text] mt-8 mb-5">
          Shop the edit
        </p>
      ) : (
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-[--text-muted] mt-8 mb-5">
          Shop the Edit
        </p>
      )}

      {/* ProductCollections — sticky collection tab bar */}
      <div id="ProductCollections-tabbar" className="sticky top-20 z-10 bg-white -mx-4 sm:-mx-8 px-4 sm:px-8 pt-4 pb-3 mb-6 flex gap-2 overflow-x-auto sm:flex-wrap scrollbar-hide">
        {isLoading ? (
          <>
            <div className={`skeleton h-8 w-28 ${useKosmos ? 'rounded' : 'rounded-full'}`} />
            <div className={`skeleton h-8 w-24 ${useKosmos ? 'rounded' : 'rounded-full'}`} />
            <div className={`skeleton h-8 w-32 ${useKosmos ? 'rounded' : 'rounded-full'}`} />
          </>
        ) : (
          collections.map((col, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              className={`px-4 py-1.5 text-sm border transition-colors whitespace-nowrap shrink-0
                ${useKosmos ? 'rounded' : 'rounded-full'}
                ${i === activeTab
                  ? 'border-[--accent] text-[--accent] bg-white'
                  : useKosmos
                    ? 'border-[--border-soft] text-[--text] bg-white hover:border-[--accent] hover:text-[--accent]'
                    : 'border-black/[0.08] text-[--text] bg-white hover:border-black/20'
                }`}
            >
              {col.name}
            </button>
          ))
        )}
      </div>

      {/* ProductCollections — product grid */}
      <div
        id="ProductCollections-grid"
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${useKosmos ? 'gap-2' : 'gap-3'}`}
      >
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activeCollection ? (
          activeCollection.products.map((p, i) => (
            <a
              key={`${activeTab}-${i}`}
              href={p.productUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              id="ProductCard"
              className={`bg-white overflow-hidden flex flex-col transition-all
                ${useKosmos
                  ? 'rounded shadow-sm hover:shadow-md hover:-translate-y-0.5'
                  : 'rounded-lg transition-colors'
                }`}
              style={{ animation: `fadeUp 300ms ${i * 35}ms ease both` }}
            >
              {/* Product card — image */}
              <div className={`relative bg-white ${useKosmos ? 'rounded' : 'rounded-lg'}`}>
                {p.imageUrl ? (
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    className={`aspect-[4/5] w-full object-contain ${useKosmos ? 'rounded' : 'rounded-lg'}`}
                    style={{
                      animation: `imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out`,
                      ...(useKosmos ? {} : { mixBlendMode: 'multiply' as const }),
                    }}
                  />
                ) : (
                  <div className={`aspect-[4/5] w-full bg-[--surface2] ${useKosmos ? 'rounded' : 'rounded-lg'}`} />
                )}

                {/* anko badge — Kmart brand label */}
                {useKosmos && (
                  <span className="absolute bottom-2 left-2 bg-[#1768B0] text-white
                                   text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                    anko
                  </span>
                )}
              </div>

              {/* Product card — text content */}
              <div id="ProductCard-content" className="p-3 flex flex-col flex-1">
                <p className="text-[13px] font-normal leading-tight line-clamp-2 text-[--text] mb-2">
                  {p.name}
                </p>

                {/* Colour — dot + name when kosmos, hidden otherwise */}
                {useKosmos && p.colour && (
                  <p className="text-[11px] text-[--text-muted] flex items-center gap-1.5 mb-2">
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0 bg-[--surface2]" />
                    {p.colour}
                  </p>
                )}

                <p className={`font-bold text-[--text] leading-none ${useKosmos ? 'text-lg mb-1' : 'text-xl mb-3'}`}>
                  <span className="text-xs font-bold align-top">$</span>
                  {p.price.startsWith('$') ? p.price.slice(1) : p.price}
                </p>

                {/* "View at Kmart" link — only in non-Kosmos mode */}
                {!useKosmos && (
                  <p className="text-[11px] font-semibold mt-auto" style={{ color: 'var(--accent)' }}>View at Kmart ↗</p>
                )}
              </div>
            </a>
          ))
        ) : null}
      </div>
    </div>
    </div>
  )
}
