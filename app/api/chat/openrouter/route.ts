import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    checkApiKey(profile.openrouter_api_key, "OpenRouter")

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${profile.openrouter_api_key}`,
        ...(process.env.OPENROUTER_REFERER && {
          "HTTP-Referer": process.env.OPENROUTER_REFERER
        }),
        ...(process.env.OPENROUTER_TITLE && {
          "X-Title": process.env.OPENROUTER_TITLE
        })
      },
      body: JSON.stringify({
        model: chatSettings.model,
        messages,
        temperature: chatSettings.temperature,
        stream: true
      })
    })

    if (!response.ok) {
      const errorRes = await response.json().catch(() => null)
      const message = errorRes?.error?.message || response.statusText
      throw new Error(message)
    }

    const stream = OpenAIStream(response)

    return new StreamingTextResponse(stream)
  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenRouter API Key not found. Please set it in your profile settings."
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}

