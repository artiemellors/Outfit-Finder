'use client'

import { useState } from 'react'
import OutfitResults, { type Outfit } from './components/OutfitResults'

export default function Home() {
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [result, setResult] = useState<Outfit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

    const reader = res.body!.getReader()
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
        if (event.type === 'status') setStatuses(s => [...s, event.message!])
        else if (event.type === 'done') { setResult(event.result as Outfit[]); setLoading(false) }
        else if (event.type === 'error') { setError(event.message!); setLoading(false) }
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
          {/* Serif logo: "Outfit" regular + "Kurator" italic accent */}
          <span className="font-serif text-[22px] font-normal tracking-[0.08em] text-[#1a1714]">
            Outfit <em style={{ color: 'var(--accent)' }}>Kurator</em>
          </span>
          <span className="hidden sm:block text-[11px] font-medium tracking-[0.15em] uppercase text-[rgba(26,23,20,0.5)]">
            Powered by Kmart
          </span>
        </div>
      </header>

      {/* Hero */}
      <section
        className="max-w-4xl mx-auto px-4 sm:px-8 pt-14 pb-10"
        style={{ animation: 'fadeUp 0.7s 0.1s ease both' }}
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-2.5 mb-4">
          <span className="block w-6 h-px" style={{ background: 'var(--accent)' }} />
          <span
            className="text-[10px] font-semibold tracking-[0.25em] uppercase"
            style={{ color: 'var(--accent)' }}
          >
            Style Intelligence
          </span>
        </div>

        {/* Title */}
        <h1 className="font-serif font-light leading-[1.1] mb-10 max-w-[640px] text-[#1a1714]"
            style={{ fontSize: 'clamp(32px, 5vw, 52px)' }}>
          Find your complete look —{' '}
          <em style={{ color: 'var(--accent)' }}>instantly.</em>
        </h1>

        {/* Joined search bar */}
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
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Status strip */}
        {loading && statuses.length > 0 && (
          <div className="mt-6 space-y-2">
            {statuses.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                <p className="text-sm text-[rgba(26,23,20,0.5)]">{s}</p>
              </div>
            ))}
            <div className="flex items-center gap-1 pl-3.5 pt-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-gray-400 inline-block"
                  style={{ animation: `dotPulse 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        )}

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
