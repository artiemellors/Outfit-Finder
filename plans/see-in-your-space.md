# Plan: "See in your space" — Home & Living visualisation

## What we're building

A page-state transition (no modal, no navigation) that lets users upload a photo of their room
and see a selected product composited into it using Nano Banana 2 (Google Gemini image
generation). Home & Living category only for this iteration.

---

## API: Nano Banana 2 (Google AI Studio)

- **Endpoint:** Gemini API via `@google/generative-ai` SDK (same key style as AI Studio)
- **Input:** `scene_image` (user's room photo, base64) + `product_image` (Kmart product URL) + text prompt
- **Output:** composited image as base64
- **New env var:** `GOOGLE_AI_API_KEY`
- **Cost:** ~$0.039/output image
- **Latency:** ~10–20s — needs a proper loading state

---

## Slices

---

### Slice 1 — UI Shell (no API, no real files)

**Goal:** The full page-state transition exists and feels right, but with no real images yet.

**What gets built:**
- A "See in your space →" button appears on each room look card — **home category only**
  (gate by `category === 'home'` or a new `supportsVisualise: true` flag in category config)
- Clicking it triggers a page-state transition: the results area morphs into a visualiser panel
  - The search bar and category header stay fixed at the top (no scroll jump)
  - The look's name + selected product thumbnail are shown as context in the panel
- The panel has two zones: **upload zone** (left/top) and **output zone** (right/bottom)
  - Upload zone: dashed border, camera icon, "Drop a photo of your room" copy — no real handler yet
  - Output zone: placeholder grey box with "Your room, transformed" text
- Hash navigation: pushing `#visualise` on open, `popstate` listener closes and restores results
- "← Back to your look" explicit back link in the panel header

**Acceptance criteria:**
- [ ] Button only appears on `/home` — not on `/outfits`, `/kitchen`, `/parties`
- [ ] Click → smooth transition to visualiser panel (no page reload)
- [ ] Browser back button → returns to results view correctly
- [ ] "← Back to your look" link does the same
- [ ] Works on mobile (upload zone is full-width, stacked layout)

**No API calls. No file handling. Purely structural.**

---

### Slice 2 — File Handling (pick, preview, validate — still no API)

**Goal:** The upload zone actually works. User picks a photo and sees it previewed.

**What gets built:**
- File input wired up: click-to-browse + drag-and-drop onto the upload zone
- Once a file is selected:
  - Show a thumbnail preview of the user's room photo inside the upload zone
  - "Change photo" link to re-select
- Client-side validation:
  - Accept: `image/jpeg`, `image/png`, `image/webp`
  - Max size: 10 MB — show inline error if exceeded
  - Min dimensions: 400×400px — show inline error if too small
- Extract base64 string from the file (ready to send to API in Slice 4)
- "Generate →" button activates once a valid file is selected (disabled/greyed before)
- Output zone remains a placeholder

**Acceptance criteria:**
- [ ] Drag-and-drop works on desktop
- [ ] Tap-to-browse works on mobile
- [ ] Oversized files show a clear error message (not a silent fail)
- [ ] Preview appears immediately after selection
- [ ] "Generate →" is disabled until a valid file is chosen
- [ ] base64 is extractable from the selected file (can verify in DevTools)

**No API calls yet.**

---

### Slice 3 — API Route (server-side, tested independently)

**Goal:** A working `/api/visualise` POST endpoint, verifiable with curl before any UI is wired.

**What gets built:**
- New file: `app/api/visualise/route.ts`
- Request body:
  ```json
  {
    "userImageBase64": "data:image/jpeg;base64,...",
    "productImageUrl": "https://www.kmart.com.au/wcsstore/...",
    "productName": "Grey Velvet Cushion 45x45cm",
    "roomContext": "cosy living room refresh"
  }
  ```
- Server-side steps:
  1. Validate inputs (all required, base64 format check, URL format check)
  2. Fetch the product image from Kmart CDN → convert to base64 (server-side fetch avoids CORS)
  3. Call Nano Banana 2 via `@google/generative-ai` SDK with:
     - Both images as inline parts
     - Prompt: *"Place the [productName] naturally into this room photo. Match the existing
       lighting, perspective, and scale. Keep the room photo otherwise unchanged."*
  4. Return the generated image as base64
- Error handling: structured JSON errors with HTTP status codes (400 for bad input, 502 for API failure)
- Add `GOOGLE_AI_API_KEY` to `.env.local.example`

**Acceptance criteria:**
- [ ] `curl -X POST /api/visualise -d '{"userImageBase64":...}'` returns a valid base64 image
- [ ] Missing fields return 400 with a readable error message
- [ ] Invalid Kmart image URL returns 502 with a clear error
- [ ] `GOOGLE_AI_API_KEY` missing → startup warning in console, 500 on request

**No UI changes in this slice.**

---

### Slice 4 — Wire & Polish (full end-to-end flow)

**Goal:** Click "Generate →", wait, see the result. The feature is fully working.

**What gets built:**
- "Generate →" button calls `/api/visualise` with the base64 image + the selected product's
  `imageUrl` and `name` from the outfit item's alternatives
- Loading state in the output zone:
  - Blurred version of the user's room photo as background
  - Animated copy cycling through: *"Analysing your space…"* → *"Placing the [productName]…"*
    → *"Adding finishing touches…"*
  - A progress shimmer overlay
- On success: output zone displays the generated image at full width
- Action bar below the result:
  - **"Try a different product"** — stays in visualiser, resets to the upload state with the
    user's room photo still loaded (just pick a different item from the look)
  - **"Try another photo"** — resets to upload zone, clears photo
  - **"Download"** — triggers browser download of the generated image
- On error: output zone shows an inline error with a "Try again" button (does not leave the panel)
- Add copy to category config:
  ```typescript
  visualise: {
    ctaLabel: 'See in your space →',
    uploadPrompt: 'Drop a photo of your room',
    uploadSubPrompt: 'or tap to browse · JPG, PNG or WEBP · max 10 MB',
    generatingCopy: ['Analysing your space…', 'Placing the items…', 'Adding finishing touches…'],
  }
  ```

**Acceptance criteria:**
- [ ] End-to-end: upload photo → click generate → see result
- [ ] Loading state is visible for the full duration of the API call (~10–20s)
- [ ] Generated image fills the output zone with no layout shift
- [ ] "Download" saves a file named `[look-name]-in-your-space.jpg`
- [ ] "Try a different product" reuses the uploaded photo (no re-upload needed)
- [ ] Error state is recoverable without leaving the panel
- [ ] Feature is invisible on `/outfits`, `/kitchen`, `/parties`

---

## Dependency order

```
Slice 1 (shell)
    └─→ Slice 2 (file handling)   ← can start alongside Slice 3
    └─→ Slice 3 (API route)       ← independent, can be built in parallel with Slice 2
            └─→ Slice 4 (wire + polish)  ← needs both 2 and 3 done
```

## Out of scope for this iteration

- Outfits / clothing try-on (separate feature, uses Google Virtual Try-On instead)
- Kitchen or Parties categories
- Iterative refinement ("move the lamp to the left")
- Saving results to a gallery
- Sharing results via a link
