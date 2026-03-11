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

// Gumroad's signature price tag: pink with a rightward arrow notch cut into the right edge
function PriceTag({ children, large }: { children: React.ReactNode; large?: boolean }) {
  const sizeClasses = large
    ? 'text-lg font-bold px-4 py-1.5 pr-6'
    : 'text-xs font-bold px-2.5 py-0.5 pr-4'
  const notch = large
    ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
    : 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)'
  return (
    <span
      className={`inline-flex items-center bg-[#FF90E8] text-[#111] ${sizeClasses}`}
      style={{ clipPath: notch }}
    >
      {children}
    </span>
  )
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
    <div className="flex gap-4 py-4 border-t border-black/[0.08]">
      {/* Image — key remount triggers imgFadeIn crossfade */}
      <div className="shrink-0 w-20 h-24 border border-black rounded overflow-hidden bg-gray-50">
        {product.imageUrl ? (
          <img
            key={idx}
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            style={{ animation: 'imgFadeIn 180ms ease-out, imgJiggle 350ms ease-out' }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
            No image
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        {/* Category + per-item price tag */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase">
            {item.category}
          </span>
          <PriceTag>{product.price}</PriceTag>
        </div>

        <p className="text-sm font-semibold text-[#111] leading-snug mb-1 line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-gray-400 leading-snug mb-3 line-clamp-1">
          {item.description}
        </p>

        {/* Controls */}
        <div className="flex items-center justify-between">
          {/* Prev / counter / next */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onIdxChange((idx - 1 + count) % count)}
              className="w-9 h-9 rounded border-2 border-black flex items-center justify-center
                         text-[#111] text-xl font-bold leading-none
                         hover:bg-[#111] hover:text-white
                         active:scale-90 transition-all duration-100"
              aria-label="Previous option"
            >
              ‹
            </button>
            <span className="text-xs text-gray-400 tabular-nums w-8 text-center">
              {idx + 1}/{count}
            </span>
            <button
              onClick={() => onIdxChange((idx + 1) % count)}
              className="w-9 h-9 rounded border-2 border-black flex items-center justify-center
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
      const t = setTimeout(() => setPriceFlashing(false), 400)
      prevTotalRef.current = total
      return () => clearTimeout(t)
    }
  }, [total])

  return (
    // White card on cream page — Gumroad's core contrast pattern
    <div
      className="bg-white border border-black rounded overflow-hidden"
      style={{ animation: 'slideIn 250ms ease-out both' }}
    >
      {/* White header — outfit name + total price tag */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[#111] leading-snug">{outfit.name}</h2>
          <p className="text-xs text-gray-400 mt-1 leading-snug">{outfit.description}</p>
        </div>
        {/* Total price bounces when it changes */}
        <div
          className="shrink-0 mt-0.5"
          style={priceFlashing ? { animation: 'priceBounce 400ms ease-out' } : {}}
        >
          <PriceTag large>${total.toFixed(2)}</PriceTag>
        </div>
      </div>

      {/* Items */}
      <div className="px-5 pb-1">
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
      {/* Sticky pill nav on cream — matches Gumroad's category row */}
      <div className="sticky top-0 z-10 bg-[#F2EFEA] -mx-6 px-6 py-3 mb-5">
        <div className="flex gap-2 overflow-x-auto">
          {outfits.map((outfit, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full border border-black text-xs font-semibold
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

      {/* key remount resets indices + triggers slideIn */}
      <OutfitCard key={activeIdx} outfit={outfits[activeIdx]} />
    </div>
  )
}
