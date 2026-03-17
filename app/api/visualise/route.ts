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

type SingleBody = {
  userImageBase64: string
  productImageUrl: string
  productName: string
  roomContext?: string
}

type FullLookBody = {
  userImageBase64: string
  products: Array<{ imageUrl: string; name: string }>
  roomContext?: string
}

export async function POST(req: NextRequest) {
  // 1. Parse + validate inputs
  let body: Partial<SingleBody & FullLookBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { userImageBase64, roomContext } = body

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

  // ─── Multi-product (full look) path ───────────────────────────────────────
  if (body.products && body.products.length > 0) {
    const { products } = body as FullLookBody

    let productImages: Array<{ mimeType: string; data: string }>
    try {
      productImages = await Promise.all(products.map(p => fetchImageAsBase64(p.imageUrl)))
    } catch (err) {
      console.error('[visualise] Product image fetch failed:', err)
      return NextResponse.json({ error: 'Could not retrieve one or more product images.' }, { status: 502 })
    }

    const nameList = products.map(p => p.name).join(', ')
    const contextPhrase = roomContext ? `this ${roomContext}` : 'this room'
    const prompt = `This is a photo of ${contextPhrase}. I want you to add the following items into the photo: ${nameList}. ` +
      `IMPORTANT: Do not alter the room in any way — preserve the exact walls, floor, ceiling, lighting, furniture, colours, and any people or objects already in the photo. ` +
      `Do not clean up, recolour, or recompose the scene. Only ADD the listed items as new objects placed naturally within the existing space, ` +
      `matching the existing perspective, scale, and lighting conditions.`

    let result
    try {
      result = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: userImage.mimeType, data: userImage.data } },
            ...productImages.map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          ],
        }],
        config: { responseModalities: ['IMAGE', 'TEXT'] },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error('[visualise] Gemini API error (full look):', message, err)
      return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 502 })
    }

    for (const part of result.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return NextResponse.json({
          imageBase64: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
        })
      }
    }

    console.error('[visualise] Gemini returned no image (full look). Response:', JSON.stringify(result, null, 2))
    return NextResponse.json({ error: 'No image was returned. Please try again.' }, { status: 502 })
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
  const prompt = `This is a photo of ${contextPhrase}. I want you to add a ${productName} into the photo. ` +
    `IMPORTANT: Do not alter the room in any way — preserve the exact walls, floor, ceiling, lighting, furniture, colours, and any people or objects already in the photo. ` +
    `Do not clean up, recolour, or recompose the scene. Only ADD the ${productName} as a new object placed naturally within the existing space, ` +
    `matching the existing perspective, scale, and lighting conditions.`

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
