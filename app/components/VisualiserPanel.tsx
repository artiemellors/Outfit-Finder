'use client'

export interface VisualiserContext {
  outfitName: string
  productName: string
  productImageUrl: string
}

export default function VisualiserPanel({
  outfitName,
  productName,
  productImageUrl,
  onClose,
}: VisualiserContext & { onClose: () => void }) {
  return (
    <div
      className="max-w-4xl mx-auto px-4 sm:px-8 pb-16"
      style={{ animation: 'fadeUp 0.35s ease both' }}
    >
      {/* Back link + look context */}
      <div className="flex items-center gap-4 mb-8 pt-2">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-[--text-muted]
                     hover:text-[--text] transition-colors shrink-0"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
          Back to your look
        </button>
        <span className="text-black/20 shrink-0">·</span>
        <div className="flex items-center gap-2.5 min-w-0">
          {productImageUrl && (
            <img
              src={productImageUrl}
              alt={productName}
              className="w-8 h-8 rounded object-cover border border-black/[0.08] shrink-0"
            />
          )}
          <span className="text-sm text-[--text-subtle] truncate">{outfitName}</span>
        </div>
      </div>

      {/* Two-zone grid — upload left/top, output right/bottom */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 mb-6">
        {/* Upload zone */}
        <div
          className="rounded-xl border-2 border-dashed border-black/[0.12]
                     bg-white flex flex-col items-center justify-center
                     min-h-[260px] sm:min-h-[320px] gap-4 p-8
                     hover:border-[--accent] hover:bg-[rgba(23,104,176,0.02)]
                     transition-all duration-200 group cursor-pointer"
        >
          <div
            className="w-14 h-14 rounded-full bg-[rgba(23,104,176,0.06)] flex items-center
                       justify-center group-hover:bg-[rgba(23,104,176,0.1)] transition-colors"
          >
            <i className="fa-solid fa-camera text-xl" style={{ color: 'var(--accent)' }} />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[--text] mb-1">Drop a photo of your room</p>
            <p className="text-xs text-[--text-muted]">
              or tap to browse · JPG, PNG or WEBP · max 10 MB
            </p>
          </div>
        </div>

        {/* Output zone — placeholder */}
        <div
          className="rounded-xl bg-[rgba(26,26,26,0.03)] border border-black/[0.06]
                     flex flex-col items-center justify-center
                     min-h-[260px] sm:min-h-[320px] gap-3 p-8"
        >
          <div
            className="w-14 h-14 rounded-full bg-[rgba(26,26,26,0.05)] flex items-center
                       justify-center"
          >
            <i className="fa-solid fa-sparkles text-xl text-[rgba(26,26,26,0.18)]" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-[rgba(26,26,26,0.28)]">Your room, transformed</p>
            <p className="text-xs text-[rgba(26,26,26,0.18)] mt-1">Upload a photo to get started</p>
          </div>
        </div>
      </div>

      {/* Generate button — disabled until a file is selected (Slice 2) */}
      <button
        disabled
        className="w-full py-4 text-[11px] font-bold tracking-[0.18em] uppercase
                   rounded-lg text-white opacity-40 cursor-not-allowed"
        style={{ background: 'var(--accent)' }}
      >
        Generate →
      </button>
    </div>
  )
}
