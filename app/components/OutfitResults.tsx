'use client'

import { useState, useEffect, useRef } from 'react'

export interface Product {
  name: string
  price: string
  colour?: string
  productUrl: string
  imageUrl: string
}

export interface OutfitItem {
  category: string
  description: string
  alternatives: Product[]
}

export interface Outfit {
  name: string
  description: string
  items: OutfitItem[]
}

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.]/g, '')) || 0
}

/** Renders a Kmart-style price with a superscript dollar sign. */
function KmartPrice({ price, className = '' }: { price: string; className?: string }) {
  // Strip leading $ and render it as a superscript
  const stripped = price.startsWith('$') ? price.slice(1) : price
  return (
    <span className={className}>
      <sup className="text-sm font-bold leading-none align-super">$</sup>
      {stripped}
    </span>
  )
}

function ItemCard({
  item,
  idx,
  onIdxChange,
  animDelay,
}: {
  item: OutfitItem
  idx: number
  onIdxChange: (idx: number) => void
  animDelay: number
}) {
  const product = item.alternatives[idx]
  const count = item.alternatives.length

  return (
    <div
      className="bg-white border border-black/[0.08] p-5 sm:p-6"
      style={{ animation: `fadeUp 0.5s ${animDelay}ms ease both` }}
    >
      <div className="flex gap-4 sm:gap-6">
        {/* Image — 4:5 portrait ratio */}
        <div className="w-24 h-[120px] sm:w-[120px] sm:h-[150px] shrink-0 bg-[#f0f0f0] rounded overflow-hidden">
          {product.imageUrl ? (
            <img
              key={idx}
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              style={{ animation: 'imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[10px] text-[rgba(26,26,26,0.3)]">
              No image
            </div>
          )}
        </div>

        {/* Content: meta + price/link (stacks on mobile, row on desktop) */}
        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:gap-6">
          {/* Meta */}
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase mb-2"
               style={{ color: 'var(--accent)' }}>
              {item.category}
            </p>
            <h3 className="font-sans text-sm font-semibold leading-tight mb-1 text-[#333]">
              {product.name}
            </h3>
            {product.colour && (
              <p className="text-[11px] text-[rgba(26,26,26,0.4)] mb-1.5">{product.colour}</p>
            )}
            <p className="text-xs leading-relaxed text-[rgba(26,26,26,0.5)] line-clamp-2">
              {item.description}
            </p>
            {/* Nav */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => onIdxChange((idx - 1 + count) % count)}
                className="w-7 h-7 border border-black/[0.08] rounded-full flex items-center justify-center
                           text-sm text-[rgba(26,26,26,0.5)] hover:border-black/30 hover:text-[#1a1a1a]
                           transition-all"
                aria-label="Previous option"
              >‹</button>
              <span className="text-[11px] text-[rgba(26,26,26,0.3)] tabular-nums">
                {idx + 1} / {count}
              </span>
              <button
                onClick={() => onIdxChange((idx + 1) % count)}
                className="w-7 h-7 border border-black/[0.08] rounded-full flex items-center justify-center
                           text-sm text-[rgba(26,26,26,0.5)] hover:border-black/30 hover:text-[#1a1a1a]
                           transition-all"
                aria-label="Next option"
              >›</button>
            </div>
          </div>

          {/* Price + link — row on mobile (below meta), column on desktop (right side) */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between
                          mt-3 sm:mt-0 sm:gap-4 shrink-0">
            <KmartPrice
              price={product.price}
              className="font-sans text-2xl font-bold text-[#1a1a1a] leading-none"
            />
            <a
              href={product.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-semibold flex items-center gap-1
                         hover:underline transition-all"
              style={{ color: 'var(--accent)' }}
            >
              View at Kmart <span className="text-[9px]">↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function OutfitView({ outfit }: { outfit: Outfit }) {
  const [indices, setIndices] = useState<number[]>(() => outfit.items.map(() => 0))
  const [priceFlashing, setPriceFlashing] = useState(false)

  const total = outfit.items.reduce((sum, item, i) => {
    return sum + parsePrice(item.alternatives[indices[i]]?.price ?? '$0')
  }, 0)

  const prevTotalRef = useRef(total)

  useEffect(() => {
    if (prevTotalRef.current !== total) {
      setPriceFlashing(true)
      const t = setTimeout(() => setPriceFlashing(false), 400)
      prevTotalRef.current = total
      return () => clearTimeout(t)
    }
  }, [total])

  return (
    <div className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* Outfit summary card */}
      <div className="bg-white border border-black/[0.08] rounded p-7 lg:sticky lg:top-[172px]"
           style={{ animation: 'fadeUp 0.5s 60ms ease both' }}>
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[rgba(26,26,26,0.35)] mb-3">
          Selected Look
        </p>
        {/* Accent line */}
        <div className="w-10 h-0.5 mb-6" style={{ background: 'var(--accent)' }} />

        <h2 className="font-sans text-2xl font-bold leading-snug text-[#1a1a1a] mb-3">
          {outfit.name}
        </h2>
        <p className="text-sm leading-relaxed text-[rgba(26,26,26,0.5)] mb-7">
          {outfit.description}
        </p>

        {/* Total */}
        <div className="flex items-end justify-between pt-5 border-t border-black/[0.08] mb-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.35)] mb-1">
              Complete outfit
            </p>
            <div
              style={{
                color: 'var(--accent)',
                animation: priceFlashing ? 'priceBounce 400ms ease-out' : undefined,
              }}
            >
              <KmartPrice
                price={`$${total.toFixed(2)}`}
                className="font-sans text-[32px] font-bold leading-none"
              />
            </div>
          </div>
          <div className="text-xs text-[rgba(26,26,26,0.5)]">
            {outfit.items.length} pieces
          </div>
        </div>

        <button
          className="w-full py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase
                     rounded transition-all duration-200 text-white"
          style={{ background: 'var(--accent)' }}
          onMouseEnter={e => { e.currentTarget.style.filter = 'brightness(0.9)' }}
          onMouseLeave={e => { e.currentTarget.style.filter = '' }}
        >
          Shop All Pieces →
        </button>
      </div>

      {/* Items list */}
      <div className="flex flex-col gap-0.5">
        {outfit.items.map((item, i) => (
          <ItemCard
            key={item.category}
            item={item}
            idx={indices[i]}
            onIdxChange={newIdx => setIndices(prev => prev.map((v, j) => j === i ? newIdx : v))}
            animDelay={120 + i * 60}
          />
        ))}
      </div>
    </div>
  )
}

export default function OutfitResults({ outfits }: { outfits: Outfit[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 pb-16" style={{ animation: 'fadeUp 0.5s ease both' }}>
      {/* Sticky tab bar */}
      <div className="sticky top-20 z-10 bg-[#f5f5f5] -mx-4 sm:-mx-8 px-4 sm:px-8 pt-5 pb-4 mb-6">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[rgba(26,26,26,0.3)] mb-3">
          Style direction
        </p>
        <div className="flex gap-2 flex-wrap">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`px-5 py-2.5 rounded-full border text-[11px] font-semibold tracking-[0.08em]
                          uppercase transition-all duration-200 active:scale-95 whitespace-nowrap
                          ${i === activeIdx
                            ? 'text-white border-transparent'
                            : 'bg-transparent text-[rgba(26,26,26,0.5)] border-black/[0.12] hover:text-[#1a1a1a]'
                          }`}
              style={i === activeIdx ? { background: 'var(--accent)', borderColor: 'var(--accent)' } : {}}
            >
              {outfit.name}
            </button>
          ))}
        </div>
      </div>

      <OutfitView key={activeIdx} outfit={outfits[activeIdx]} />
    </div>
  )
}
