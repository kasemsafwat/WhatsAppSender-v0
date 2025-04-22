import { NextResponse } from "next/server"

// Flag to enable mock mode for testing
const USE_MOCK_MODE = true // Set to false when your API is properly configured

export async function POST(request: Request) {
  try {
    const { to, message, mediaUrl } = await request.json()

    // Validate inputs
    if (!to || !message) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // If mock mode is enabled, return a mock successful response
    if (USE_MOCK_MODE) {
      console.log("MOCK MODE: Simulating successful message send to", to)

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Generate a random message ID
      const messageId = `wamid.${Math.random().toString(36).substring(2, 15)}`

      return NextResponse.json({
        messaging_product: "whatsapp",
        contacts: [
          {
            input: to,
            wa_id: to.replace("+", ""),
          },
        ],
        messages: [{ id: messageId }],
      })
    }

    // Get the WhatsApp API token and phone number ID from environment variables
    const apiToken = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!apiToken || !phoneNumberId) {
      console.error("WhatsApp API credentials not configured")
      return NextResponse.json({ error: "WhatsApp API not properly configured" }, { status: 500 })
    }

    // Prepare the message payload
    const payload = mediaUrl ? createMediaMessagePayload(to, message, mediaUrl) : createTextMessagePayload(to, message)

    console.log(`Sending message to ${to} using phone number ID: ${phoneNumberId}`)

    // Send the message using the WhatsApp Business API
    const response = await fetch(`https://graph.facebook.com/v17.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("WhatsApp API error:", data)
      return NextResponse.json(
        {
          error: data.error?.message || "Failed to send WhatsApp message",
        },
        { status: response.status },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    return NextResponse.json({ error: "Failed to send WhatsApp message" }, { status: 500 })
  }
}

// Helper function to create a text message payload
function createTextMessagePayload(to: string, message: string) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: true,
      body: message,
    },
  }
}

// Helper function to create a media message payload
function createMediaMessagePayload(to: string, message: string, mediaUrl: string) {
  // For images, we can use the direct media approach
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "image",
    image: {
      link: mediaUrl,
      caption: message,
    },
  }
}
