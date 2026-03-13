'use client'

import { useEffect, useState } from 'react'

interface Props {
  chips: string[]
  onRefine: (chip: string) => void
}

export default function RefinementChips({ chips, onRefine }: Props) {
  // Each entry is the characters revealed so far for that chip
  const [displayed, setDisplayed] = useState<string[]>(() => chips.map(() => ''))

  useEffect(() => {
    setDisplayed(chips.map(() => ''))
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

    async function run() {
      await sleep(200)
      for (let i = 0; i < chips.length; i++) {
        if (cancelled) return
        if (i > 0) await sleep(120)
        for (let c = 1; c <= chips[i].length; c++) {
          if (cancelled) return
          const chipIdx = i
          const charCount = c
          setDisplayed(prev => {
            const next = [...prev]
            next[chipIdx] = chips[chipIdx].slice(0, charCount)
            return next
          })
          await sleep(35)
        }
      }
    }

    run()
    return () => { cancelled = true }
  }, [chips])

  return (
    <div
      className="max-w-4xl mx-auto px-4 sm:px-8 pb-4"
      style={{ animation: 'fadeUp 0.3s ease both' }}
    >
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-2.5">
        Refine your search
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
            <button
              key={chip}
              type="button"
              onClick={() => onRefine(chip)}
              className="px-4 py-2 bg-white border border-black/[0.08] rounded-full
                         text-sm text-[#1a1a1a] whitespace-nowrap
                         transition-colors duration-150 cursor-pointer
                         hover:border-[#1768B0] hover:text-[#1768B0]
                         active:scale-[0.98]"
              style={{ animation: 'fadeUp 0.3s ease both', animationDelay: `${i * 120}ms` }}
            >
              {displayed[i]}
            </button>
          ))}
      </div>
    </div>
  )
}
