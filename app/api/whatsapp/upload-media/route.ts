import { NextResponse } from "next/server"

// Flag to enable mock mode for testing
const USE_MOCK_MODE = true // Set to false when your API is properly configured

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // If mock mode is enabled, return a mock successful response
    if (USE_MOCK_MODE) {
      console.log("MOCK MODE: Simulating media upload for", file.name)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Create a mock media ID and URL
      const mediaId = `media_${Math.random().toString(36).substring(2, 15)}`
      const mediaUrl = `https://example.com/media/${mediaId}.jpg`

      return NextResponse.json({
        id: mediaId,
        url: mediaUrl,
        mime_type: file.type,
        file_size: file.size,
      })
    }

    // Get the WhatsApp API token and phone number ID from environment variables
    const apiToken = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!apiToken || !phoneNumberId) {
      console.error("WhatsApp API credentials not configured")
      return NextResponse.json({ error: "WhatsApp API not properly configured" }, { status: 500 })
    }

    // Convert the file to an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // First, upload the media to the WhatsApp Media API
    const uploadResponse = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "multipart/form-data",
      },
      body: createFormData(file, buffer),
    })

    const uploadData = await uploadResponse.json()

    if (!uploadResponse.ok) {
      console.error("WhatsApp Media API error:", uploadData)
      return NextResponse.json(
        {
          error: uploadData.error?.message || "Failed to upload media",
        },
        { status: uploadResponse.status },
      )
    }

    // Now retrieve the media URL
    const mediaId = uploadData.id
    const mediaResponse = await fetch(`https://graph.facebook.com/v17.0/${mediaId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    })

    const mediaData = await mediaResponse.json()

    if (!mediaResponse.ok) {
      console.error("WhatsApp Media API error:", mediaData)
      return NextResponse.json(
        {
          error: mediaData.error?.message || "Failed to retrieve media URL",
        },
        { status: mediaResponse.status },
      )
    }

    return NextResponse.json({
      id: mediaId,
      url: mediaData.url,
      mime_type: mediaData.mime_type,
      file_size: mediaData.file_size,
    })
  } catch (error) {
    console.error("Error uploading media:", error)
    return NextResponse.json({ error: "Failed to upload media" }, { status: 500 })
  }
}

// Helper function to create form data for media upload
function createFormData(file: File, buffer: Buffer) {
  const formData = new FormData()
  formData.append("file", new Blob([buffer], { type: file.type }), file.name)
  formData.append("type", file.type)
  return formData
}
