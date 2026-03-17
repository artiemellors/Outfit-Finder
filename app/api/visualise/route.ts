import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-2.5-flash-image'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

async function fetchImageAsBase64(url: string): Promise<{ mimeType: string; data: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch product image (${res.status})`)
  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  const mimeType = contentType.split(';')[0].trim()
  const buffer = await res.arrayBuffer()
  const data = Buffer.from(buffer).toString('base64')
  return { mimeType, data }
}

// ─── Route ────────────────────────────────────────────────────────────────────

type VisualiseMode = 'room' | 'outfit'

type SingleBody = {
  userImageBase64: string
  productImageUrl: string
  productName: string
  roomContext?: string
  visualiseMode?: VisualiseMode
}

type FullLookBody = {
  userImageBase64: string
  products: Array<{ imageUrl: string; name: string }>
  roomContext?: string
  visualiseMode?: VisualiseMode
}

function buildPrompt(mode: VisualiseMode, productName: string, contextPhrase: string): string {
  if (mode === 'outfit') {
    return `This photo shows a person. I want to show what the ${productName} would look like on them. ` +
      `IMPORTANT: Keep the person's pose, body, face, skin tone, hair, and background exactly as they are. ` +
      `Only replace or overlay the relevant clothing/accessory item with the ${productName}, ` +
      `matching the existing lighting, shadows, and perspective.`
  }
  return `This is a photo of ${contextPhrase}. I want you to add a ${productName} into the photo. ` +
    `IMPORTANT: Do not alter the scene in any way — preserve the exact walls, floor, ceiling, lighting, furniture, colours, ` +
    `and any people or objects already in the photo. ` +
    `Do not clean up, recolour, or recompose the scene. Only ADD the ${productName} as a new object placed naturally within the existing space, ` +
    `matching the existing perspective, scale, and lighting conditions.`
}

export async function POST(req: NextRequest) {
  // 1. Parse + validate inputs
  let body: Partial<SingleBody & FullLookBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { userImageBase64, roomContext, visualiseMode = 'room' } = body

  if (!userImageBase64) {
    return NextResponse.json({ error: 'Missing required field: userImageBase64.' }, { status: 400 })
  }

  const userImage = parseDataUrl(userImageBase64)
  if (!userImage) {
    return NextResponse.json({ error: 'userImageBase64 must be a valid data URL.' }, { status: 400 })
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[visualise] GOOGLE_AI_API_KEY is not set.')
    return NextResponse.json({ error: 'Image generation is not configured.' }, { status: 500 })
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

  // ─── Multi-product (full look) path — sequential chaining ────────────────
  if (body.products && body.products.length > 0) {
    const { products } = body as FullLookBody

    // Fetch all product images up-front (can be parallel)
    let productImages: Array<{ mimeType: string; data: string }>
    try {
      productImages = await Promise.all(products.map(p => fetchImageAsBase64(p.imageUrl)))
    } catch (err) {
      console.error('[visualise] Product image fetch failed:', err)
      return NextResponse.json({ error: 'Could not retrieve one or more product images.' }, { status: 502 })
    }

    // Chain: add one item at a time, feeding each result as the next base image
    let currentImage: { mimeType: string; data: string } = userImage

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const productImage = productImages[i]
      const contextPhrase = i === 0
        ? (roomContext ? `this ${roomContext}` : 'this room')
        : 'this photo'

      const prompt = buildPrompt(visualiseMode as VisualiseMode, product.name, contextPhrase)

      let result
      try {
        result = await ai.models.generateContent({
          model: MODEL,
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType: currentImage.mimeType, data: currentImage.data } },
              { inlineData: { mimeType: productImage.mimeType, data: productImage.data } },
            ],
          }],
          config: { responseModalities: ['IMAGE', 'TEXT'] },
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[visualise] Gemini API error (full look step ${i + 1}):`, message, err)
        return NextResponse.json({ error: `Image generation failed at step ${i + 1}: ${message}` }, { status: 502 })
      }

      const imagePart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
      if (!imagePart?.inlineData) {
        console.error(`[visualise] Gemini returned no image at step ${i + 1}. Response:`, JSON.stringify(result, null, 2))
        return NextResponse.json({ error: `No image returned at step ${i + 1}. Please try again.` }, { status: 502 })
      }

      currentImage = { mimeType: imagePart.inlineData.mimeType ?? 'image/png', data: imagePart.inlineData.data ?? '' }
    }

    return NextResponse.json({
      imageBase64: `data:${currentImage.mimeType};base64,${currentImage.data}`,
    })
  }

  // ─── Single-product path ──────────────────────────────────────────────────
  const { productImageUrl, productName } = body as Partial<SingleBody>

  if (!productImageUrl || !productName) {
    return NextResponse.json(
      { error: 'Missing required fields: productImageUrl and productName (or use products[] for full look).' },
      { status: 400 }
    )
  }

  // 2. Fetch the product image server-side (avoids CORS, keeps credentials server-only)
  let productImage: { mimeType: string; data: string }
  try {
    productImage = await fetchImageAsBase64(productImageUrl)
  } catch (err) {
    console.error('[visualise] Product image fetch failed:', err)
    return NextResponse.json({ error: 'Could not retrieve the product image.' }, { status: 502 })
  }

  // 3. Call Gemini image generation
  const contextPhrase = roomContext ? `this ${roomContext}` : 'this room'
  const prompt = buildPrompt(visualiseMode as VisualiseMode, productName, contextPhrase)

  let result
  try {
    result = await ai.models.generateContent({
      model: MODEL,
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: userImage.mimeType, data: userImage.data } },
          { inlineData: { mimeType: productImage.mimeType, data: productImage.data } },
        ],
      }],
      config: {
        responseModalities: ['IMAGE', 'TEXT'],
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // Log the full error so it's visible in Render logs
    console.error('[visualise] Gemini API error:', message, err)
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 502 })
  }

  // 4. Extract the generated image from the response
  for (const part of result.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return NextResponse.json({
        imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
      })
    }
  }

  console.error('[visualise] Gemini returned no image part. Full response:', JSON.stringify(result, null, 2))
  return NextResponse.json({ error: 'No image was returned. Please try again.' }, { status: 502 })
}
