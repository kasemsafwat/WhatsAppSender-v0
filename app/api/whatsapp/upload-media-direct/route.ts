import { NextResponse } from "next/server"
import FormData from "form-data"
import fetch from "node-fetch"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Get the WhatsApp API token and phone number ID from environment variables
    const apiToken = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!apiToken || !phoneNumberId) {
      console.error("WhatsApp API credentials not configured")
      return NextResponse.json({ error: "WhatsApp API not properly configured" }, { status: 500 })
    }

    // Convert the file to a buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Create a node-fetch compatible FormData
    const form = new FormData()
    form.append("messaging_product", "whatsapp")
    form.append("file", buffer, {
      filename: file.name,
      contentType: file.type,
    })

    // Log the request details
    console.log(`Uploading media to WhatsApp API using phone number ID: ${phoneNumberId}`)
    console.log(`File: ${file.name}, Size: ${file.size}, Type: ${file.type}`)

    // Upload the media to the WhatsApp Media API
    const uploadResponse = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...form.getHeaders(),
      },
      body: form,
    })

    const uploadText = await uploadResponse.text()
    let uploadData

    try {
      uploadData = JSON.parse(uploadText)
    } catch (e) {
      console.error("Failed to parse response:", uploadText)
      return NextResponse.json({ error: "Invalid response from WhatsApp API" }, { status: 500 })
    }

    if (!uploadResponse.ok) {
      console.error("WhatsApp Media API error:", uploadData)
      return NextResponse.json(
        {
          error: uploadData.error?.message || "Failed to upload media",
          details: uploadData,
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
