'use client'

import { useState, useRef } from 'react'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024   // 10 MB
const MIN_DIM   = 400                // px

async function validateAndRead(file: File): Promise<{ dataUrl: string } | { error: string }> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { error: 'Please use a JPG, PNG or WEBP image.' }
  }
  if (file.size > MAX_BYTES) {
    return { error: 'Image must be under 10 MB.' }
  }

  const dataUrl = await new Promise<string>(resolve => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target!.result as string)
    reader.readAsDataURL(file)
  })

  const valid = await new Promise<boolean>(resolve => {
    const img = new Image()
    img.onload  = () => resolve(img.naturalWidth >= MIN_DIM && img.naturalHeight >= MIN_DIM)
    img.onerror = () => resolve(false)
    img.src = dataUrl
  })

  if (!valid) return { error: `Image must be at least ${MIN_DIM} × ${MIN_DIM} px.` }

  return { dataUrl }
}

export default function VisualiserZone() {
  const inputRef              = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [base64, setBase64]   = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File) {
    setError(null)
    const result = await validateAndRead(file)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setPreview(result.dataUrl)
    setBase64(result.dataUrl)
  }

  function reset() {
    setPreview(null)
    setBase64(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="self-stretch flex flex-col" style={{ animation: 'fadeUp 0.3s ease both' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Upload / preview zone */}
      <div
        className={`flex-1 rounded-xl border-2 overflow-hidden transition-all duration-200 cursor-pointer
                    ${dragging
                      ? 'border-[--accent] bg-[rgba(23,104,176,0.04)]'
                      : preview
                        ? 'border-black/[0.08] bg-white'
                        : 'border-dashed border-black/[0.12] bg-white hover:border-[--accent] hover:bg-[rgba(23,104,176,0.02)] group'
                    }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        {preview ? (
          /* Preview state — image fills the zone, overlay appears on hover */
          <div className="relative w-full h-full min-h-[200px] group/preview">
            <img
              src={preview}
              alt="Your room"
              className="w-full h-full object-cover"
            />
            <div
              className="absolute inset-0 flex items-end justify-center pb-4
                         bg-black/0 group-hover/preview:bg-black/25 transition-colors duration-200"
            >
              <button
                type="button"
                onClick={e => { e.stopPropagation(); reset() }}
                className="px-3 py-1.5 rounded-full bg-white/90 text-[11px] font-semibold
                           text-[--text] shadow-sm translate-y-1
                           opacity-0 group-hover/preview:opacity-100
                           group-hover/preview:translate-y-0
                           transition-all duration-200"
              >
                Change photo
              </button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center gap-4 p-8 h-full min-h-[200px]">
            <div
              className="w-14 h-14 rounded-full bg-[rgba(23,104,176,0.06)] flex items-center
                         justify-center group-hover:bg-[rgba(23,104,176,0.1)] transition-colors"
            >
              <i className="fa-solid fa-camera text-xl" style={{ color: 'var(--accent)' }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[--text] mb-1">Drop a photo of your room</p>
              <p className="text-xs text-[--text-muted]">or tap to browse · JPG, PNG or WEBP · max 10 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Validation error */}
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}

      {/* Generate button */}
      <button
        disabled={!base64}
        className={`w-full mt-4 py-4 text-[11px] font-bold tracking-[0.18em] uppercase
                   rounded-lg transition-all duration-200
                   ${base64
                     ? 'text-white hover:brightness-90 cursor-pointer active:scale-[0.99]'
                     : 'cursor-not-allowed text-[rgba(26,26,26,0.35)]'
                   }`}
        style={{ background: base64 ? 'var(--accent)' : 'rgba(26,26,26,0.1)' }}
      >
        Generate →
      </button>
    </div>
  )
}
