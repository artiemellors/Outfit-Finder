'use client'

import { useState, useEffect, useRef } from 'react'

const useKosmos = process.env.NEXT_PUBLIC_SHOW_NEW_FEATURE === 'true'

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
  const stripped = price.startsWith('$') ? price.slice(1) : price
  return (
    <span className={className}>
      <span className="text-sm font-bold align-top">$</span>
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

  const arrowClass = `w-8 h-8 rounded-full bg-white border border-black/[0.12] shadow-sm
                      flex items-center justify-center text-sm text-[--text-muted]
                      hover:border-black/30 hover:text-[--text] transition-all z-10`

  return (
    <div style={{ animation: `fadeUp 0.5s ${animDelay}ms ease both` }}>
      {/* card */}
      <div
        id="ItemCard"
        className={`relative bg-white rounded-lg flex gap-4 sm:gap-6
          ${useKosmos ? 'border border-[#CDD1D5]' : 'border border-black/[0.08]'}`}
      >
        {/* left arrow — centred on left card edge, half overflowing */}
        {count > 1 && (
          <button
            onClick={() => onIdxChange((idx - 1 + count) % count)}
            aria-label="Previous option"
            className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 ${arrowClass}`}
          >‹</button>
        )}

        {/* ItemCard — image thumbnail (flush to card edges) */}
        <div id="ItemCard-image" className="w-28 sm:w-[160px] shrink-0 bg-white rounded-l-lg overflow-hidden">
          {product.imageUrl ? (
            <img
              key={idx}
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
              style={{
                animation: 'imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out',
                ...(useKosmos ? {} : { mixBlendMode: 'multiply' as const }),
              }}
            />
          ) : null}
        </div>

        {/* ItemCard — content column (meta + price/link) */}
        <div id="ItemCard-content" className="flex-1 min-w-0 flex flex-col sm:flex-row sm:gap-6 py-5 sm:py-6 pr-5 sm:pr-6">
          {/* ItemCard — product meta (category, name, colour, description) */}
          <div id="ItemCard-meta" className="flex-1 min-w-0">
            <p className="text-[9px] font-bold tracking-[0.22em] uppercase mb-2"
               style={{ color: 'var(--accent)' }}>
              {item.category}
            </p>
            <h3 className="font-sans text-sm font-medium leading-tight mb-1 text-[--text]">
              {product.name}
            </h3>
            {product.colour && (
              useKosmos ? (
                <p className="text-[11px] text-[--text-muted] flex items-center gap-1.5 mb-1.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-black/10 shrink-0 bg-[--surface2]" />
                  {product.colour}
                </p>
              ) : (
                <p className="text-[11px] text-[--text-muted] mb-1.5">{product.colour}</p>
              )
            )}
            <p className="text-xs leading-relaxed text-[--text-muted] line-clamp-2">
              {item.description}
            </p>
          </div>

          {/* ItemCard — price + "View at Kmart" link */}
          <div id="ItemCard-price" className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-between
                          mt-3 sm:mt-0 sm:gap-4 shrink-0">
            <KmartPrice
              price={product.price}
              className="font-sans text-2xl font-bold text-[--text] leading-none"
            />
            {useKosmos ? (
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold px-3 py-1.5 rounded border transition-all"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent)'
                  e.currentTarget.style.color = '#fff'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
              >
                Shop ↗
              </a>
            ) : (
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
            )}
          </div>
        </div>

        {/* right arrow — centred on right card edge, half overflowing */}
        {count > 1 && (
          <button
            onClick={() => onIdxChange((idx + 1) % count)}
            aria-label="Next option"
            className={`absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 ${arrowClass}`}
          >›</button>
        )}
      </div>

      {/* dots — centred below the card */}
      {count > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {item.alternatives.map((_, i) => (
            <span
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? 'bg-black/50' : 'bg-black/[0.15]'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OutfitView({ outfit, groupLabel = 'Selected Look', totalLabel = 'Complete outfit' }: {
  outfit: Outfit
  groupLabel?: string
  totalLabel?: string
}) {
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
    <div id="OutfitView" className="grid gap-6 items-start grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* OutfitView — summary card (sticky sidebar) */}
      <div
        id="OutfitView-summary"
        className="bg-white lg:sticky lg:top-[172px] rounded-lg p-7 border border-black/[0.08]"
        style={{ animation: 'fadeUp 0.5s 60ms ease both' }}
      >
        <p className="text-[9px] font-bold tracking-[0.25em] uppercase text-[--text-subtle] mb-3">
          {groupLabel}
        </p>
        <div className="w-10 h-0.5 mb-6" style={{ background: 'var(--accent)' }} />

        <h2 className="font-sans text-2xl font-bold leading-snug text-[--text] mb-3">
          {outfit.name}
        </h2>
        <p className="text-sm leading-relaxed text-[--text-muted] mb-7">
          {outfit.description}
        </p>

        {/* Summary card — total price row */}
        <div
          id="OutfitView-summary-total"
          className="flex items-end justify-between pt-5 mb-6 border-t border-black/[0.08]"
        >
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase text-[--text-subtle] mb-1">
              {totalLabel}
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
          <div className="text-xs text-[--text-muted]">
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

      {/* OutfitView — items list */}
      <div id="OutfitView-items" className="flex flex-col" style={{ gap: 'calc(var(--spacing) * 2)' }}>
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

export default function OutfitResults({
  outfits,
  groupLabel,
  totalLabel,
}: {
  outfits: Outfit[]
  groupLabel?: string
  totalLabel?: string
}) {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div id="OutfitResults" className="max-w-4xl mx-auto px-4 sm:px-8 pb-16" style={{ animation: 'fadeUp 0.5s ease both' }}>
      {/* OutfitResults — sticky outfit tab bar */}
      <div id="OutfitResults-tabbar" className={`sticky top-20 z-10 -mx-4 sm:-mx-8 px-4 sm:px-8 pt-5 mb-6
        ${useKosmos ? 'bg-white' : 'bg-[--bg]'}`}>
        <div className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-black/[0.08]">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`px-5 pb-3 pt-1 text-[11px] font-semibold tracking-[0.12em]
                          uppercase transition-all duration-200 whitespace-nowrap shrink-0 border-b-2
                          ${i === activeIdx
                            ? useKosmos
                              ? 'border-[#1768B0] text-[#1768B0]'
                              : 'border-[--accent] text-[--accent]'
                            : 'border-transparent text-[--text-muted] hover:text-[--text]'
                          }`}
            >
              {outfit.name}
            </button>
          ))}
        </div>
      </div>

      <OutfitView key={activeIdx} outfit={outfits[activeIdx]} groupLabel={groupLabel} totalLabel={totalLabel} />
    </div>
  )
}
