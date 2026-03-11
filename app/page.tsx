'use client'

import { useState, useEffect } from 'react'
import OutfitResults, { type Outfit } from './components/OutfitResults'

// ─── Editorial rotating copy ────────────────────────────────────────────────

const PHASE_COPY = {
  thinking:  ['Reading your brief…', 'Studying your aesthetic…', 'Understanding the look…'],
  searching: ['Hunting down the best fits…', 'Browsing the racks…', 'Sourcing the pieces…', 'Checking every aisle…'],
  curating:  ['Pulling the look together…', 'Almost dressed…', 'Finishing touches…', 'Nearly ready to wear…'],
}

type Phase = keyof typeof PHASE_COPY

function useRotatingCopy(phase: Phase) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    setIdx(0)
    setVisible(true)
  }, [phase])

  useEffect(() => {
    const lines = PHASE_COPY[phase]
    if (lines.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx(i => (i + 1) % lines.length)
        setVisible(true)
      }, 350)
    }, 2500)
    return () => clearInterval(id)
  }, [phase])

  return { copy: PHASE_COPY[phase][idx], visible }
}

// ─── Loading state ───────────────────────────────────────────────────────────

function LoadingState({ statuses }: { statuses: string[] }) {
  const hasFound     = statuses.some(s => s.startsWith('Found'))
  const hasSearching = statuses.some(s => s.startsWith('Searching'))
  const phase: Phase = hasFound ? 'curating' : hasSearching ? 'searching' : 'thinking'
  const searchCount  = statuses.filter(s => s.startsWith('Searching')).length

  const { copy, visible } = useRotatingCopy(phase)

  const subLabel = {
    thinking:  'One moment…',
    searching: `Across ${searchCount} categor${searchCount === 1 ? 'y' : 'ies'}`,
    curating:  'Selecting the best combinations',
  }[phase]

  return (
    <div className="mt-10" style={{ animation: 'fadeUp 0.4s ease both' }}>
      {/* Phase header */}
      <div className="flex items-baseline gap-3 mb-4">
        <span
          className="font-serif text-2xl font-light text-[#1a1714] transition-opacity duration-[400ms]"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {copy}
        </span>
        <span className="text-sm text-[rgba(26,23,20,0.4)] hidden sm:block">{subLabel}</span>
      </div>

      {/* Indeterminate progress bar */}
      <div className="relative h-px bg-black/[0.06] overflow-hidden mb-10">
        <div
          className="absolute inset-y-0 left-0 w-1/3 bg-[var(--accent)]"
          style={{ animation: 'progressSweep 1.8s ease-in-out infinite' }}
        />
      </div>

      {/* Skeleton layout — mirrors the 2-col results grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Summary sidebar skeleton */}
        <div className="bg-white border border-black/[0.08] rounded-sm p-7">
          <div className="skeleton h-2 w-16 rounded mb-3" />
          <div className="w-10 h-0.5 bg-[#e8e3dc] mb-7" />
          <div className="skeleton h-6 w-3/4 rounded mb-2" />
          <div className="skeleton h-6 w-1/2 rounded mb-7" />
          <div className="space-y-2 mb-8">
            <div className="skeleton h-2.5 w-full rounded" />
            <div className="skeleton h-2.5 w-full rounded" />
            <div className="skeleton h-2.5 w-2/3 rounded" />
          </div>
          <div className="pt-5 border-t border-black/[0.08] flex items-end justify-between">
            <div>
              <div className="skeleton h-2 w-20 rounded mb-2" />
              <div className="skeleton h-9 w-20 rounded" />
            </div>
            <div className="skeleton h-3 w-10 rounded" />
          </div>
          <div className="skeleton h-11 w-full rounded-sm mt-6" />
        </div>

        {/* Item card skeletons */}
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-black/[0.08] p-5 sm:p-6">
              <div className="flex gap-4 sm:gap-6">
                <div className="skeleton w-24 h-[120px] sm:w-[120px] sm:h-[150px] shrink-0 rounded-sm" />
                <div className="flex-1 pt-1 space-y-2.5">
                  <div className="skeleton h-2 w-12 rounded" />
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-full rounded" />
                  <div className="skeleton h-2.5 w-2/3 rounded" />
                  <div className="flex gap-2 pt-2">
                    <div className="skeleton h-7 w-7 rounded-sm" />
                    <div className="skeleton h-7 w-9 rounded-sm" />
                    <div className="skeleton h-7 w-7 rounded-sm" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery]     = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [result, setResult]   = useState<Outfit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setStatuses([])
    setResult(null)
    setError(null)

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })

    const reader  = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()!
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const event = JSON.parse(line.slice(6)) as { type: string; message?: string; result?: unknown }
        if (event.type === 'status')      setStatuses(s => [...s, event.message!])
        else if (event.type === 'done')   { setResult(event.result as Outfit[]); setLoading(false) }
        else if (event.type === 'error')  { setError(event.message!); setLoading(false) }
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f2ee]">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-20 bg-[#f5f2ee] border-b border-black/[0.08]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-14 flex items-center justify-between">
          <span className="font-serif text-[22px] font-normal tracking-[0.08em] text-[#1a1714]">
            Outfit <em style={{ color: 'var(--accent)' }}>Kurator</em>
          </span>
          <span className="hidden sm:block text-[11px] font-medium tracking-[0.15em] uppercase text-[rgba(26,23,20,0.5)]">
            Powered by Kmart
          </span>
        </div>
      </header>

      {/* Hero + search */}
      <section
        className="max-w-4xl mx-auto px-4 sm:px-8 pt-14 pb-10"
        style={{ animation: 'fadeUp 0.7s 0.1s ease both' }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <span className="block w-6 h-px" style={{ background: 'var(--accent)' }} />
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase" style={{ color: 'var(--accent)' }}>
            Style Intelligence
          </span>
        </div>

        <h1 className="font-serif font-light leading-[1.1] mb-10 max-w-[640px] text-[#1a1714]"
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
          Find your complete look —{' '}
          <em style={{ color: 'var(--accent)' }}>instantly.</em>
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex w-full bg-white border border-black/[0.08] rounded-sm overflow-hidden
                     transition-all duration-200 focus-within:border-[#e0208e]
                     focus-within:shadow-[0_0_0_3px_rgba(224,32,142,0.1)]"
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Describe the look you want…"
            disabled={loading}
            className="flex-1 min-w-0 bg-transparent border-none outline-none px-6 py-[18px]
                       text-sm font-light text-[#1a1714] placeholder:text-[rgba(26,23,20,0.3)]
                       disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 px-8 py-[18px] text-[11px] font-semibold tracking-[0.18em] uppercase
                       text-white border-none cursor-pointer transition-all
                       hover:brightness-90 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? 'Working…' : 'Search'}
          </button>
        </form>

        {loading && <LoadingState statuses={statuses} />}

        {error && (
          <p className="mt-6 text-sm text-red-600 bg-white border border-red-200 rounded-sm px-4 py-3">
            {error}
          </p>
        )}
      </section>

      {result && <OutfitResults outfits={result} />}
    </div>
  )
}
