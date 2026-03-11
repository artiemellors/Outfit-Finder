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
    <div className="min-h-screen bg-[#F2EFEA]">
      {/* Sticky top-left logo header */}
      <header className="sticky top-0 z-20 bg-[#F2EFEA] border-b border-black/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 h-14 flex items-center">
          <span className="text-xl font-black tracking-tight text-[#111]">Outfit Kurator</span>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-8 pt-10 pb-10">
        <p className="text-sm text-gray-400 mb-6">
          Find a complete look from Kmart, instantly.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Describe your vibe…"
            disabled={loading}
            className="flex-1 min-w-0 px-4 py-3 text-sm bg-white border-2 border-black rounded
                       outline-none focus:border-[#FF90E8] transition-colors
                       disabled:opacity-50 placeholder:text-gray-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="shrink-0 px-6 py-3 bg-[#FF90E8] text-[#111] text-sm font-bold border-2 border-black rounded
                       hover:scale-[1.02] active:scale-[0.97] transition-transform
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* Status strip */}
        {loading && statuses.length > 0 && (
          <div className="mt-6 space-y-2">
            {statuses.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF90E8] shrink-0" />
                <p className="text-sm text-gray-400">{s}</p>
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
          <p className="mt-6 text-sm font-medium text-red-600 bg-white border border-red-300 rounded px-4 py-3">
            {error}
          </p>
        )}
      </div>

      {result && <OutfitResults outfits={result} />}
    </div>
  )
}
