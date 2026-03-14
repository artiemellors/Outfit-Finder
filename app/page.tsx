'use client'

import { useState, useEffect, useRef } from 'react'
import OutfitResults, { type Outfit } from './components/OutfitResults'
import { ProductCollections, type ProductCollection } from './components/ProductCollections'
import RefinementChips from './components/RefinementChips'

// ─── Editorial rotating copy ────────────────────────────────────────────────

const PHASE_COPY = {
  thinking: [
    'Reading your brief…',
    'Decoding your aesthetic…',
    'Working out what you need…',
    'Getting the picture…',
    'Thinking through the options…',
  ],
  searching: [
    'Hunting down the best fits…',
    'Browsing the racks…',
    'Sourcing the pieces…',
    'Checking every aisle…',
    'Comparing the options…',
    'Filtering out the noise…',
    'On the lookout for something good…',
    'Checking what\'s in stock…',
    'Sifting through the shelves…',
    'Scanning the collection…',
    'Finding the right pieces…',
    'Looking for a good match…',
  ],
  curating: [
    'Pulling the look together…',
    'Almost dressed…',
    'Finishing touches…',
    'Nearly ready to wear…',
    'Making sure it all works…',
    'Pairing things up…',
    'Getting the details right…',
    'Putting the final look together…',
  ],
}

type Phase = keyof typeof PHASE_COPY

function shuffle(arr: string[]): string[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function useRotatingCopy(phase: Phase) {
  const [copy, setCopy] = useState(() => PHASE_COPY[phase][0])
  const [visible, setVisible] = useState(true)
  const queueRef = useRef<string[]>([])
  const idxRef   = useRef(1)

  useEffect(() => {
    const phrases = PHASE_COPY[phase]
    queueRef.current = shuffle(phrases)
    idxRef.current = 1
    setCopy(queueRef.current[0])
    setVisible(true)
  }, [phase])

  useEffect(() => {
    const phrases = PHASE_COPY[phase]
    if (phrases.length <= 1) return
    const id = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        if (idxRef.current >= queueRef.current.length) {
          queueRef.current = shuffle(phrases)
          idxRef.current = 0
        }
        setCopy(queueRef.current[idxRef.current++])
        setVisible(true)
      }, 350)
    }, 3200)
    return () => clearInterval(id)
  }, [phase])

  return { copy, visible }
}

// ─── Gender type ─────────────────────────────────────────────────────────────

type Gender = 'men' | 'women' | null

const OCCASION_TILES: Record<NonNullable<Gender> | 'all', { label: string; query: string }[]> = {
  men: [
    { label: 'Stag Night',      query: 'night out for a stag party' },
    { label: 'Job Interview',   query: 'smart casual outfit for a job interview' },
    { label: 'Summer Casual',   query: 'casual summer outfit for men' },
    { label: 'Gym',             query: 'gym look for a guy' },
    { label: 'Beach Day',       query: 'beach day with the kids' },
    { label: 'Streetwear',      query: 'streetwear outfit for men' },
    { label: 'Workwear',        query: "workwear that doesn't feel boring" },
    { label: 'Weekend Brunch',  query: 'weekend brunch, something relaxed' },
  ],
  women: [
    { label: 'Job Interview',   query: 'smart casual outfit for a job interview' },
    { label: 'Gym',             query: 'gym look for a woman' },
    { label: 'Beach Day',       query: 'beach day with the kids' },
    { label: 'Date Night',      query: 'date night, a bit dressed up' },
    { label: 'Winter Layers',   query: 'cosy winter layers' },
    { label: 'Weekend Brunch',  query: 'weekend brunch, something relaxed' },
    { label: 'Workwear',        query: "workwear that doesn't feel boring" },
    { label: 'Garden Party',    query: 'garden party outfit' },
  ],
  all: [
    { label: 'Job Interview',   query: 'smart casual outfit for a job interview' },
    { label: 'Weekend Brunch',  query: 'weekend brunch, something relaxed' },
    { label: 'Beach Day',       query: 'beach day with the kids' },
    { label: 'Date Night',      query: 'date night, a bit dressed up' },
    { label: 'Night Out',       query: 'night out outfit' },
    { label: 'Gym',             query: 'gym outfit' },
    { label: 'Winter Layers',   query: 'cosy winter layers' },
    { label: 'Workwear',        query: "workwear that doesn't feel boring" },
  ],
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
          className="font-sans text-xl font-semibold text-[#1a1a1a] transition-opacity duration-[400ms]"
          style={{ opacity: visible ? 1 : 0 }}
        >
          {copy}
        </span>
        <span className="text-sm text-[rgba(26,26,26,0.4)] hidden sm:block">{subLabel}</span>
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
        <div className="bg-white border border-black/[0.08] rounded p-7">
          <div className="skeleton h-2 w-16 rounded mb-3" />
          <div className="w-10 h-0.5 bg-[#e0e0e0] mb-7" />
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
          <div className="skeleton h-11 w-full rounded mt-6" />
        </div>

        {/* Item card skeletons */}
        <div className="flex flex-col gap-0.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-black/[0.08] p-5 sm:p-6">
              <div className="flex gap-4 sm:gap-6">
                <div className="skeleton w-24 h-[120px] sm:w-[120px] sm:h-[150px] shrink-0 rounded" />
                <div className="flex-1 pt-1 space-y-2.5">
                  <div className="skeleton h-2 w-12 rounded" />
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-2.5 w-full rounded" />
                  <div className="skeleton h-2.5 w-2/3 rounded" />
                  <div className="flex gap-2 pt-2">
                    <div className="skeleton h-7 w-7 rounded-full" />
                    <div className="skeleton h-7 w-9 rounded" />
                    <div className="skeleton h-7 w-7 rounded-full" />
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
  const [query, setQuery]         = useState('')
  const [statuses, setStatuses]   = useState<string[]>([])
  const [result, setResult]       = useState<Outfit[] | null>(null)
  const [collections, setCollections] = useState<ProductCollection[] | null>(null)
  const [refinements, setRefinements] = useState<string[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [gender, setGender]       = useState<Gender>(null)
  const [shuffledOccasions, setShuffledOccasions] = useState(
    () => shuffle([...OCCASION_TILES['all']])
  )
  useEffect(() => {
    setShuffledOccasions(shuffle([...OCCASION_TILES[gender ?? 'all']]))
  }, [gender])

  async function runSearch(q: string) {
    if (!q.trim()) return
    setQuery(q)
    setLoading(true)
    setStatuses([])
    setResult(null)
    setCollections(null)
    setRefinements(null)
    setError(null)

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q, gender }),
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
        if (event.type === 'status')           setStatuses(s => [...s, event.message!])
        else if (event.type === 'done')        { setResult(event.result as Outfit[]); setLoading(false) }
        else if (event.type === 'collections') setCollections(event.result as ProductCollection[])
        else if (event.type === 'refinements') setRefinements(event.result as string[])
        else if (event.type === 'error')       { setError(event.message!); setLoading(false) }
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    runSearch(query)
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Sticky header */}
      <header
        className="sticky top-0 z-20 bg-white border-b border-black/[0.06]"
        style={{ animation: 'fadeDown 0.6s ease both' }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between">
          <span className="font-sans text-xl font-bold tracking-tight text-[#1a1a1a]">
            Outfit <span style={{ color: 'var(--accent)' }}>Kurator</span>
          </span>
          <span className="hidden sm:block text-[11px] font-semibold tracking-[0.12em] uppercase text-[rgba(26,26,26,0.4)]">
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

        <h1 className="font-sans font-bold leading-[1.1] mb-10 max-w-[640px] text-[#1a1a1a]"
            style={{ fontSize: 'clamp(28px, 5vw, 48px)' }}>
          Find your complete look —{' '}
          <span style={{ color: 'var(--accent)' }}>instantly.</span>
        </h1>

        <form
          onSubmit={handleSubmit}
          className="flex w-full bg-white border border-black/[0.08] rounded-tl-[8px] rounded-bl-[8px]
                     transition-all duration-200 focus-within:border-[#1768B0]
                     focus-within:shadow-[0_0_0_3px_rgba(23,104,176,0.1)]"
        >
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder=""
            disabled={loading}
            className="flex-1 min-w-0 bg-transparent border-none outline-none px-6 py-[18px]
                       text-[16px] sm:text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)]
                       disabled:opacity-50"
          />

          {/* Divider — desktop only */}
          <div className="hidden sm:block w-px self-stretch my-3 bg-black/[0.08] shrink-0" />

          {/* Gender segmented control — desktop only (right side of bar) */}
          <div className="hidden sm:flex items-center pl-1 pr-3 shrink-0 gap-0.5">
            {(['men', 'women'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(prev => prev === g ? null : g)}
                disabled={loading}
                className="px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase
                           rounded transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                style={gender === g
                  ? { background: 'rgba(23,104,176,0.08)', color: 'var(--accent)' }
                  : { color: 'rgba(26,26,26,0.4)', background: 'transparent' }
                }
              >
                {g === 'men' ? 'Men' : 'Women'}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="shrink-0 px-7 py-[18px] text-base rounded-tr-[8px] rounded-br-[8px]
                       text-white border-none cursor-pointer transition-all
                       hover:brightness-90 active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--accent)' }}
          >
            <i className={`fa-solid fa-magnifying-glass${loading ? ' animate-search-rock' : ''}`} />
          </button>
        </form>

        {/* Gender toggle — mobile only (below bar) */}
        <div className="sm:hidden flex gap-2 mt-3">
          {(['men', 'women'] as const).map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(prev => prev === g ? null : g)}
              disabled={loading}
              className="px-4 py-1.5 text-[10px] font-semibold tracking-[0.18em] uppercase rounded-[4px]
                         border transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={gender === g
                ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(23,104,176,0.06)' }
                : { borderColor: 'rgba(26,26,26,0.12)', color: 'rgba(26,26,26,0.45)', background: 'transparent' }
              }
            >
              {g === 'men' ? 'Men' : 'Women'}
            </button>
          ))}
        </div>

        {/* Occasion tiles — visible on empty state only */}
        {!loading && !result && (
          <div className="mt-8" style={{ animation: 'fadeUp 0.5s 0.25s ease both', opacity: 0 }}>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-3">
              Popular occasions
            </p>
            <div className="flex flex-nowrap overflow-x-auto sm:flex-wrap sm:overflow-x-visible scrollbar-hide gap-2 pb-1">
              {shuffledOccasions.map(tile => (
                <button
                  key={tile.label}
                  type="button"
                  onClick={() => runSearch(tile.query)}
                  className="flex-shrink-0 px-4 py-2 bg-white border border-black/[0.08] rounded-full
                             text-sm font-light text-[#1a1a1a]
                             transition-all duration-150 cursor-pointer
                             hover:border-[#1768B0] hover:text-[#1768B0]
                             active:scale-[0.98]"
                >
                  {tile.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading && <LoadingState statuses={statuses} />}

        {error && (
          <p className="mt-6 text-sm text-red-600 bg-white border border-red-200 rounded px-4 py-3">
            {error}
          </p>
        )}
      </section>

      {result && refinements && (
        <RefinementChips
          chips={refinements}
          onRefine={chip => runSearch(`${query} — ${chip}`)}
        />
      )}
      {result && <OutfitResults outfits={result} />}
      {result && <ProductCollections collections={collections} />}
    </div>
  )
}
