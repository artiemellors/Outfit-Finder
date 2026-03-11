'use client'

import { useState } from 'react'

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

function OutfitCard({ outfit }: { outfit: Outfit }) {
  const [indices, setIndices] = useState<number[]>(() => outfit.items.map(() => 0))

  const total = outfit.items.reduce((sum, item, i) => {
    return sum + parsePrice(item.alternatives[indices[i]]?.price ?? '$0')
  }, 0)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{outfit.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5 leading-snug">{outfit.description}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wide">Total</div>
            <div className="text-lg font-bold text-gray-900">${total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="px-5">
        {outfit.items.map((item, i) => (
          <ItemSlotControlled
            key={item.category}
            item={item}
            idx={indices[i]}
            onIdxChange={newIdx => setIndices(prev => prev.map((v, j) => j === i ? newIdx : v))}
          />
        ))}
      </div>
    </div>
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
  const total = item.alternatives.length

  return (
    <div className="flex gap-4 py-4 border-t border-gray-100">
      <div className="shrink-0 w-20 h-24 bg-gray-50 rounded-lg overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{item.category}</span>
          <span className="text-sm font-semibold text-gray-900 shrink-0">{product.price}</span>
        </div>
        <p className="text-sm font-medium text-gray-900 leading-tight mb-1 truncate">{product.name}</p>
        <p className="text-xs text-gray-500 leading-snug mb-3 line-clamp-2">{item.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onIdxChange((idx - 1 + total) % total)}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              aria-label="Previous option"
            >
              ‹
            </button>
            <span className="text-xs text-gray-400 tabular-nums">{idx + 1}/{total}</span>
            <button
              onClick={() => onIdxChange((idx + 1) % total)}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 hover:border-gray-300 transition-colors text-sm"
              aria-label="Next option"
            >
              ›
            </button>
          </div>
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            View at Kmart
            <span className="text-[10px]">↗</span>
          </a>
        </div>
      </div>
    </div>
  )
}

export default function OutfitResults({ outfits }: { outfits: Outfit[] }) {
  return (
    <div className="flex flex-col gap-6 mt-6">
      {outfits.map((outfit, i) => (
        <OutfitCard key={i} outfit={outfit} />
      ))}
    </div>
  )
}
