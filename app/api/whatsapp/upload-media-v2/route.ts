import { NextResponse } from "next/server"
import axios from "axios"

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

    // Create a form data object for axios
    const axiosFormData = new FormData()
    axiosFormData.append("messaging_product", "whatsapp")
    axiosFormData.append("file", new Blob([buffer], { type: file.type }), file.name)

    try {
      // Upload the media using axios
      const uploadResponse = await axios.post(
        `https://graph.facebook.com/v17.0/${phoneNumberId}/media`,
        axiosFormData,
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      )

      const mediaId = uploadResponse.data.id

      // Get the media URL
      const mediaResponse = await axios.get(`https://graph.facebook.com/v17.0/${mediaId}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      })

      return NextResponse.json({
        id: mediaId,
        url: mediaResponse.data.url,
        mime_type: mediaResponse.data.mime_type,
        file_size: mediaResponse.data.file_size,
      })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error("WhatsApp API error:", error.response.data)
        return NextResponse.json(
          {
            error: error.response.data.error?.message || "API request failed",
            details: error.response.data,
          },
          { status: error.response.status },
        )
      }
      throw error
    }
  } catch (error) {
    console.error("Error uploading media:", error)
    return NextResponse.json(
      {
        error: "Failed to upload media",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
