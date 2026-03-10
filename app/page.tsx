'use client'

import { useState } from 'react'

export default function Home() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<unknown>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      setResult(await res.json())
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 32, fontFamily: 'sans-serif', maxWidth: 800 }}>
      <h1>Outfit Finder</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="men's black t-shirt"
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
      {loading && <p style={{ color: '#666' }}>Running scraper — this takes ~45 seconds…</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {result && (
        <pre style={{ background: '#f5f5f5', padding: 16, borderRadius: 6, overflow: 'auto', fontSize: 13 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  )
}
