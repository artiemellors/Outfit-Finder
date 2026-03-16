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
  if (useKosmos) {
    return (
      <div className="flex flex-col">
        <div className="skeleton aspect-[4/5] w-full bg-[#F4F5F6]" />
        <div className="pt-2 space-y-1.5">
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-2/3 rounded" />
          <div className="skeleton h-4 w-1/3 rounded mt-1" />
        </div>
      </div>
    )
  }
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
    <div className="w-full bg-white border-t border-black/[0.06]">
    <div id="ProductCollections" className="max-w-4xl mx-auto px-4 sm:px-8 pb-16">

      {/* Section heading */}
      {useKosmos ? (
        <p className="text-base font-bold text-[#1a1a1a] mt-8 mb-5">Shop the edit</p>
      ) : (
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-[--text-muted] mt-8 mb-5">Shop the Edit</p>
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
              className={`px-4 py-1.5 text-[13px] border transition-colors whitespace-nowrap shrink-0
                ${useKosmos ? 'rounded' : 'rounded-full'}
                ${i === activeTab
                  ? 'border-[#1768B0] text-[#1768B0] bg-white'
                  : useKosmos
                    ? 'border-black/[0.15] text-[#1a1a1a] bg-white hover:border-[#1768B0] hover:text-[#1768B0]'
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
        className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 ${useKosmos ? 'gap-x-3 gap-y-6' : 'gap-3'}`}
      >
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
        ) : activeCollection ? (
          activeCollection.products.map((p, i) => (
            useKosmos ? (
              /* Kmart-style card: borderless, grey image area, anko badge */
              <a
                key={`${activeTab}-${i}`}
                href={p.productUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                id="ProductCard"
                className="flex flex-col group"
                style={{ animation: `fadeUp 300ms ${i * 35}ms ease both` }}
              >
                <div className="relative bg-[#F4F5F6] overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="aspect-[4/5] w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      style={{ animation: `imgFadeIn 300ms ease-out` }}
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full" />
                  )}
                  <span className="absolute bottom-2 left-2 bg-[#1768B0] text-white
                                   text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                    anko
                  </span>
                </div>
                <div className="pt-2 pb-3 flex flex-col">
                  <p className="text-[12px] font-normal leading-[1.3] line-clamp-2 text-[#1a1a1a] mb-1">
                    {p.name}
                  </p>
                  {p.colour && (
                    <p className="text-[11px] text-[rgba(26,26,26,0.5)] mb-1.5">{p.colour}</p>
                  )}
                  <p className="font-bold text-[#1a1a1a] leading-none text-[14px]">
                    <span className="text-[10px] font-bold align-top">$</span>
                    {p.price.startsWith('$') ? p.price.slice(1) : p.price}
                  </p>
                </div>
              </a>
            ) : (
              /* Original card */
              <a
                key={`${activeTab}-${i}`}
                href={p.productUrl ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
                id="ProductCard"
                className="bg-white rounded-lg overflow-hidden flex flex-col transition-colors"
                style={{ animation: `fadeUp 300ms ${i * 35}ms ease both` }}
              >
                <div className="relative bg-white rounded-lg">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="aspect-[4/5] w-full object-contain rounded-lg"
                      style={{ animation: `imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out`, mixBlendMode: 'multiply' }}
                    />
                  ) : (
                    <div className="aspect-[4/5] w-full bg-[--surface2] rounded-lg" />
                  )}
                </div>
                <div id="ProductCard-content" className="p-3 flex flex-col flex-1">
                  <p className="text-[14px] font-normal leading-tight line-clamp-2 text-[--text] mb-3">
                    {p.name}
                  </p>
                  <p className="text-xl font-bold text-[--text] leading-none mb-3">
                    <span className="text-xs font-bold align-top">$</span>
                    {p.price.startsWith('$') ? p.price.slice(1) : p.price}
                  </p>
                  <p className="text-[11px] font-semibold mt-auto" style={{ color: 'var(--accent)' }}>View at Kmart ↗</p>
                </div>
              </a>
            )
          ))
        ) : null}
      </div>
    </div>
    </div>
  )
}
