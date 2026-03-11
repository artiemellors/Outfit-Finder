'use client'

import { useState, useEffect, useRef } from 'react'

export interface Product {
  name: string
  price: string
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

function ItemSlotControlled({
  item,
  idx,
  onIdxChange,
}: {
  item: OutfitItem
  idx: number
  onIdxChange: (idx: number) => void
}) {
  const product = item.alternatives[idx]
  const count = item.alternatives.length

  return (
    <div className="flex gap-5 py-5 border-t-2 border-gray-100">
      {/* Image — key forces remount on swap, triggering imgFadeIn */}
      <div className="shrink-0 w-24 h-28 border-2 border-black rounded-lg overflow-hidden bg-gray-50">
        {product.imageUrl ? (
          <img
            key={idx}
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            style={{ animation: 'imgFadeIn 180ms ease-out' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-[10px] font-black tracking-[0.2em] text-gray-400 uppercase mt-0.5">
            {item.category}
          </span>
          <span className="text-sm font-bold text-[#111] shrink-0">{product.price}</span>
        </div>
        <p className="text-sm font-semibold text-[#111] leading-tight mb-1.5 line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-gray-400 leading-snug mb-4 line-clamp-2">
          {item.description}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Prev / counter / next — 40×40px targets (Fitts's Law) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onIdxChange((idx - 1 + count) % count)}
              className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center
                         text-[#111] text-xl font-bold leading-none
                         hover:bg-[#111] hover:text-white
                         active:scale-90 transition-all duration-100"
              aria-label="Previous option"
            >
              ‹
            </button>
            <span className="text-xs text-gray-400 tabular-nums w-8 text-center">
              {idx + 1} / {count}
            </span>
            <button
              onClick={() => onIdxChange((idx + 1) % count)}
              className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center
                         text-[#111] text-xl font-bold leading-none
                         hover:bg-[#111] hover:text-white
                         active:scale-90 transition-all duration-100"
              aria-label="Next option"
            >
              ›
            </button>
          </div>

          {/* Slide-underline link */}
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative text-xs font-semibold text-[#111] group flex items-center gap-0.5"
          >
            View at Kmart
            <span className="text-[10px] ml-0.5">↗</span>
            <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-[#111] group-hover:w-full transition-all duration-200" />
          </a>
        </div>
      </div>
    </div>
  )
}

function OutfitCard({ outfit }: { outfit: Outfit }) {
  const [indices, setIndices] = useState<number[]>(() => outfit.items.map(() => 0))
  const [priceFlashing, setPriceFlashing] = useState(false)

  const total = outfit.items.reduce((sum, item, i) => {
    return sum + parsePrice(item.alternatives[indices[i]]?.price ?? '$0')
  }, 0)

  const prevTotalRef = useRef(total)

  useEffect(() => {
    if (prevTotalRef.current !== total) {
      setPriceFlashing(true)
      const t = setTimeout(() => setPriceFlashing(false), 700)
      prevTotalRef.current = total
      return () => clearTimeout(t)
    }
  }, [total])

  return (
    <div
      className="border-2 border-black rounded-xl overflow-hidden bg-white"
      style={{ animation: 'slideIn 250ms ease-out both' }}
    >
      {/* Dark header */}
      <div className="px-6 py-5 bg-[#111]">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white leading-tight">{outfit.name}</h2>
            <p className="text-sm text-gray-400 mt-1.5 leading-snug">{outfit.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-0.5">
              Total
            </div>
            {/* Price flashes pink when total changes */}
            <div
              className="text-2xl font-black text-white rounded px-1 -mx-1"
              style={priceFlashing ? { animation: 'priceFlash 700ms ease-out forwards' } : {}}
            >
              ${total.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* Item slots */}
      <div className="px-6">
        {outfit.items.map((item, i) => (
          <ItemSlotControlled
            key={item.category}
            item={item}
            idx={indices[i]}
            onIdxChange={newIdx =>
              setIndices(prev => prev.map((v, j) => (j === i ? newIdx : v)))
            }
          />
        ))}
      </div>
    </div>
  )
}

export default function OutfitResults({ outfits }: { outfits: Outfit[] }) {
  const [activeIdx, setActiveIdx] = useState(0)

  return (
    <div className="max-w-2xl mx-auto px-6 pb-16">
      {/* Sticky pill nav — reduces cognitive load (Hick's Law), one outfit at a time */}
      <div className="sticky top-0 z-10 bg-white border-b-2 border-black -mx-6 px-6 py-3 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-4 py-2 rounded-full border-2 border-black text-sm font-bold
                          whitespace-nowrap transition-all duration-150 active:scale-95
                          ${i === activeIdx
                            ? 'bg-[#111] text-white'
                            : 'bg-white text-[#111] hover:bg-gray-50'
                          }`}
            >
              {outfit.name}
            </button>
          ))}
        </div>
      </div>

      {/* key forces remount → resets state + triggers slideIn animation on switch */}
      <OutfitCard key={activeIdx} outfit={outfits[activeIdx]} />
    </div>
  )
}
