import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-2.0-flash-preview-image-generation'

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

export async function POST(req: NextRequest) {
  // 1. Parse + validate inputs
  let body: { userImageBase64?: string; productImageUrl?: string; productName?: string; roomContext?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { userImageBase64, productImageUrl, productName, roomContext } = body

  if (!userImageBase64 || !productImageUrl || !productName) {
    return NextResponse.json(
      { error: 'Missing required fields: userImageBase64, productImageUrl, productName.' },
      { status: 400 }
    )
  }

  const userImage = parseDataUrl(userImageBase64)
  if (!userImage) {
    return NextResponse.json({ error: 'userImageBase64 must be a valid data URL.' }, { status: 400 })
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error('[visualise] GOOGLE_AI_API_KEY is not set.')
    return NextResponse.json({ error: 'Image generation is not configured.' }, { status: 500 })
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
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY })

  const prompt = roomContext
    ? `Place the ${productName} naturally into this ${roomContext} photo. Match the existing lighting, perspective, and scale. Keep the rest of the room unchanged.`
    : `Place the ${productName} naturally into this room photo. Match the existing lighting, perspective, and scale. Keep the rest of the room unchanged.`

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
    console.error('[visualise] Gemini API error:', err)
    return NextResponse.json({ error: 'Image generation failed. Please try again.' }, { status: 502 })
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
