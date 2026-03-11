'use client'

import { useState } from 'react'

export default function Home() {
  const [query, setQuery] = useState('')
  const [statuses, setStatuses] = useState<string[]>([])
  const [result, setResult] = useState<unknown>(null)
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
        else if (event.type === 'done') { setResult(event.result); setLoading(false) }
        else if (event.type === 'error') { setError(event.message!); setLoading(false) }
      }
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Outfit Finder</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="I want a casual men's black outfit"
          style={{ flex: 1, padding: '8px 12px', fontSize: 16, border: '1px solid #ddd', borderRadius: 6 }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ padding: '8px 20px', fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {statuses.map((s, i) => (
        <p key={i} style={{ color: '#666', margin: '4px 0' }}>→ {s}</p>
      ))}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {result && (
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 12, marginTop: 16 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  )
}
