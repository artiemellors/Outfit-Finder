'use client'

import { useState, useRef, useEffect } from 'react'

export interface VisualiserProduct {
  name: string
  imageUrl: string
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024   // 10 MB
const MIN_DIM   = 400                // px

const LOADING_PHRASES = [
  'Dressing you up…',
  'Placing your pieces…',
  'Matching the light…',
  'Getting the scale just right…',
  'Setting the scene…',
  'Almost there…',
]

function useRotatingCopy(phrases: string[], active: boolean) {
  const [index, setIndex]   = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!active) {
      setIndex(0)
      setVisible(true)
      return
    }
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex(i => (i + 1) % phrases.length)
        setVisible(true)
      }, 350)
    }, 3200)
    return () => clearInterval(timer)
  }, [active, phrases.length])

  return { phrase: phrases[index], visible }
}

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

type GenState = 'idle' | 'generating' | 'done'

export default function VisualiserZone({
  products = [],
  roomContext,
  visualiseMode = 'room',
}: {
  products?: VisualiserProduct[]
  roomContext?: string
  visualiseMode?: 'room' | 'outfit'
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview]         = useState<string | null>(null)
  const [base64, setBase64]           = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragging, setDragging]       = useState(false)

  const [selectedIdx, setSelectedIdx] = useState(0)
  const [genState, setGenState]       = useState<GenState>('idle')
  const [genMode, setGenMode]         = useState<'single' | 'full'>('single')
  const [genError, setGenError]       = useState<string | null>(null)
  const [resultImage, setResultImage] = useState<string | null>(null)

  const { phrase, visible } = useRotatingCopy(LOADING_PHRASES, genState === 'generating')

  async function handleFile(file: File) {
    setUploadError(null)
    const result = await validateAndRead(file)
    if ('error' in result) { setUploadError(result.error); return }
    setPreview(result.dataUrl)
    setBase64(result.dataUrl)
    // Clear any previous generation when a new photo is uploaded
    setResultImage(null)
    setGenState('idle')
    setGenError(null)
  }

  function resetPhoto() {
    setPreview(null)
    setBase64(null)
    setUploadError(null)
    setResultImage(null)
    setGenState('idle')
    setGenError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  function selectProduct(i: number) {
    setSelectedIdx(i)
    setResultImage(null)
    setGenState('idle')
    setGenError(null)
  }

  async function runGenerate(body: Record<string, unknown>) {
    setGenState('generating')
    setGenError(null)
    setResultImage(null)
    try {
      const res = await fetch('/api/visualise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userImageBase64: base64, roomContext, visualiseMode, ...body }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setGenError(json.error ?? 'Something went wrong. Please try again.')
        setGenState('idle')
      } else {
        setResultImage(json.imageBase64)
        setGenState('done')
      }
    } catch {
      setGenError('Network error. Please check your connection and try again.')
      setGenState('idle')
    }
  }

  async function handleGenerate() {
    const product = products[selectedIdx]
    if (!base64 || !product) return
    setGenMode('single')
    await runGenerate({ productImageUrl: product.imageUrl, productName: product.name })
  }

  async function handleGenerateFull() {
    if (!base64 || products.length < 2) return
    setGenMode('full')
    setGenState('generating')
    setGenError(null)
    setResultImage(null)

    let currentImage = base64
    for (const product of products) {
      try {
        const res = await fetch('/api/visualise', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userImageBase64: currentImage,
            roomContext,
            visualiseMode,
            productImageUrl: product.imageUrl,
            productName: product.name,
          }),
        })
        const json = await res.json()
        if (!res.ok || json.error) {
          setGenError(json.error ?? 'Something went wrong. Please try again.')
          setGenState('idle')
          return
        }
        currentImage = json.imageBase64
        setResultImage(currentImage)
      } catch {
        setGenError('Network error. Please check your connection and try again.')
        setGenState('idle')
        return
      }
    }
    setGenState('done')
  }

  function handleTryAgain() {
    setResultImage(null)
    setGenState('idle')
    setGenError(null)
  }

  const selectedProduct = products[selectedIdx]
  const canGenerate = !!base64 && !!selectedProduct && genState === 'idle'

  // What to display in the preview slot — result replaces original once done
  const displaySrc = resultImage ?? preview

  return (
    <div className="self-stretch flex flex-col overflow-hidden" style={{ animation: 'fadeUp 0.3s ease both' }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {/* Product picker — only shown when multiple products available */}
      {products.length > 1 && (
        <div className="mb-4">
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[--text-subtle] mb-2">
            Choose a piece to visualise
          </p>
          <div className="flex gap-2 flex-wrap">
            {products.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectProduct(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left
                           ${i === selectedIdx
                             ? 'border-[--accent] bg-[rgba(23,104,176,0.06)]'
                             : 'border-black/[0.1] bg-white hover:border-black/30'
                           }`}
              >
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="" className="w-8 h-8 object-cover rounded shrink-0" />
                )}
                <span
                  className="text-[11px] font-medium leading-tight line-clamp-2 max-w-[90px]"
                  style={{ color: i === selectedIdx ? 'var(--accent)' : 'var(--text)' }}
                >
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload / preview zone */}
      <div
        className={`flex-1 min-h-0 rounded-xl border-2 overflow-hidden transition-all duration-200
                    ${dragging
                      ? 'border-[--accent] bg-[rgba(23,104,176,0.04)]'
                      : displaySrc
                        ? 'border-black/[0.08] bg-white'
                        : 'border-dashed border-black/[0.12] bg-white hover:border-[--accent] hover:bg-[rgba(23,104,176,0.02)] group'
                    }
                    ${genState === 'idle' && !resultImage ? 'cursor-pointer' : 'cursor-default'}`}
        onClick={() => genState === 'idle' && !resultImage && inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        {displaySrc ? (
          <div className="relative w-full h-full min-h-[200px] group/preview">
            <img
              key={resultImage ?? 'preview'}
              src={displaySrc}
              alt={resultImage ? 'Your room with the product' : 'Your room'}
              className="w-full h-full object-cover"
              style={resultImage ? { animation: 'fadeUp 0.5s ease both' } : undefined}
            />

            {/* Shimmer + rotating copy while generating */}
            {genState === 'generating' && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Shimmer sweep */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.28) 50%, transparent 100%)',
                    animation: 'shimmerSweep 2.2s ease-in-out infinite',
                  }}
                />
                {/* Frosted scrim + copy at the bottom */}
                <div
                  className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2.5 pt-10 pb-5 px-4"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
                >
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-white"
                        style={{ animation: `dotPulse 1.4s ease-in-out ${i * 0.22}s infinite` }}
                      />
                    ))}
                  </div>
                  <p
                    className="text-white text-sm font-medium text-center"
                    style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}
                  >
                    {phrase}
                  </p>
                </div>
              </div>
            )}

            {/* Done — actions pinned to the bottom of the image */}
            {genState === 'done' && resultImage && (
              <div
                className="absolute inset-x-0 bottom-0 flex gap-2 p-3"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
                  animation: 'fadeUp 0.4s ease both',
                }}
              >
                <button
                  type="button"
                  onClick={handleTryAgain}
                  className="flex-1 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase
                             rounded bg-white/15 border border-white/30 text-white backdrop-blur-sm
                             hover:bg-white/25 transition-all"
                >
                  Try again
                </button>
                <a
                  href={resultImage}
                  download="my-room.png"
                  className="flex-1 py-2.5 text-[11px] font-bold tracking-[0.15em] uppercase
                             rounded text-white text-center transition-all hover:brightness-90"
                  style={{ background: 'var(--accent)' }}
                >
                  Save image
                </a>
              </div>
            )}

            {/* Change photo button — idle only, no result */}
            {genState === 'idle' && !resultImage && (
              <div className="absolute inset-0 flex items-end justify-center pb-4 bg-black/0 group-hover/preview:bg-black/25 transition-colors duration-200">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); resetPhoto() }}
                  className="px-3 py-1.5 rounded-full bg-white/90 text-[11px] font-semibold
                             text-[--text] shadow-sm translate-y-1
                             opacity-0 group-hover/preview:opacity-100
                             group-hover/preview:translate-y-0
                             transition-all duration-200"
                >
                  Change photo
                </button>
              </div>
            )}
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

      {/* Upload validation error */}
      {uploadError && (
        <p className="mt-2 text-xs text-red-600">{uploadError}</p>
      )}

      {/* API error */}
      {genError && (
        <p className="mt-2 text-xs text-red-600">{genError}</p>
      )}

      {/* Generate button(s) — hidden once we have a result */}
      {genState !== 'done' && (
        <div className="flex flex-col gap-2 mt-4">
          <button
            type="button"
            disabled={!canGenerate}
            onClick={handleGenerate}
            className={`w-full py-4 text-[11px] font-bold tracking-[0.18em] uppercase
                       rounded-lg transition-all duration-200
                       ${canGenerate
                         ? 'text-white hover:brightness-90 cursor-pointer active:scale-[0.99]'
                         : 'cursor-not-allowed text-[rgba(26,26,26,0.35)]'
                       }`}
            style={{ background: canGenerate ? 'var(--accent)' : 'rgba(26,26,26,0.1)' }}
          >
            {genState === 'generating' && genMode === 'single' ? 'Generating…' : 'Generate →'}
          </button>

          {products.length > 1 && (
            <button
              type="button"
              disabled={!canGenerate}
              onClick={handleGenerateFull}
              className={`w-full py-3.5 text-[11px] font-bold tracking-[0.18em] uppercase
                         rounded-lg border transition-all duration-200
                         ${canGenerate
                           ? 'border-[--accent] text-[--accent] hover:bg-[rgba(23,104,176,0.06)] cursor-pointer active:scale-[0.99]'
                           : 'border-black/[0.1] cursor-not-allowed text-[rgba(26,26,26,0.35)]'
                         }`}
            >
              {genState === 'generating' && genMode === 'full' ? 'Generating…' : 'Visualise full look →'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
