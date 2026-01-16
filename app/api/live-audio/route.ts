import { GoogleGenAI } from "@google/genai"

const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY

const MODEL = "gemini-2.0-flash"

async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Check if it's a rate limit error
      if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
        const delay = baseDelay * Math.pow(2, attempt)
        console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        // For non-rate-limit errors, don't retry
        throw error
      }
    }
  }

  throw lastError
}

export async function POST(request: Request) {
  if (!API_KEY) {
    return Response.json({ error: "API key not configured" }, { status: 500 })
  }

  try {
    const { audioData, systemInstruction, isStart, isEnd } = await request.json()

    // For starting a new session, return session info
    if (isStart) {
      return Response.json({
        success: true,
        message: "Session initialized",
        config: {
          inputSampleRate: 16000,
          outputSampleRate: 24000,
        },
      })
    }

    // For ending a session
    if (isEnd) {
      return Response.json({ success: true, message: "Session ended" })
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY })

    const response = await retryWithBackoff(async () => {
      return await ai.models.generateContent({
        model: MODEL,
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  systemInstruction ||
                  "You are a helpful automotive technician assistant. Process the audio and respond helpfully.",
              },
              {
                inlineData: {
                  mimeType: "audio/pcm;rate=16000",
                  data: audioData,
                },
              },
            ],
          },
        ],
      })
    })

    const text = response.text || ""

    return Response.json({
      success: true,
      text,
    })
  } catch (error: any) {
    console.error("Live audio API error:", error)

    if (error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("quota")) {
      return Response.json(
        {
          error: "API rate limit reached. Please wait a moment and try again.",
          retryAfter: 10,
        },
        { status: 429 },
      )
    }

    return Response.json({ error: error.message || "Failed to process audio" }, { status: 500 })
  }
}
