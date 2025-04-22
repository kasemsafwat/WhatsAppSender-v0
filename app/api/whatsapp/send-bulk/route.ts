import { NextResponse } from "next/server"

// Flag to enable mock mode for testing
const USE_MOCK_MODE = true // Set to false when your API is properly configured

export async function POST(request: Request) {
  try {
    const { to, message, mediaUrl } = await request.json()

    // Validate inputs
    if (!to || !Array.isArray(to) || to.length === 0 || !message) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }

    // If mock mode is enabled, return a mock successful response
    if (USE_MOCK_MODE) {
      console.log("MOCK MODE: Simulating bulk message send to", to.length, "recipients")

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Simulate 90% success rate
      const successful = Math.floor(to.length * 0.9)
      const failed = to.length - successful

      // Generate details for each recipient
      const details = to.map((recipient, index) => {
        // Simulate some random failures
        const isSuccess = index < successful

        return {
          to: recipient,
          status: isSuccess ? "sent" : "failed",
          ...(isSuccess
            ? {
                message_id: `wamid.${Math.random().toString(36).substring(2, 15)}`,
              }
            : {
                error: "Message sending failed",
              }),
        }
      })

      return NextResponse.json({
        messaging_product: "whatsapp",
        successful,
        failed,
        details,
      })
    }

    // Get the WhatsApp API token and phone number ID from environment variables
    const apiToken = process.env.WHATSAPP_API_TOKEN
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

    if (!apiToken || !phoneNumberId) {
      console.error("WhatsApp API credentials not configured")
      return NextResponse.json({ error: "WhatsApp API not properly configured" }, { status: 500 })
    }

    // Process messages in batches to avoid rate limits
    const batchSize = 10
    const results = {
      successful: 0,
      failed: 0,
      details: [] as Array<{ to: string; status: string; error?: string; message_id?: string }>,
    }

    // Process in batches
    for (let i = 0; i < to.length; i += batchSize) {
      const batch = to.slice(i, i + batchSize)
      const batchPromises = batch.map(async (recipient) => {
        try {
          // Prepare the message payload
          const payload = mediaUrl
            ? createMediaMessagePayload(recipient, message, mediaUrl)
            : createTextMessagePayload(recipient, message)

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
            console.error(`Failed to send to ${recipient}:`, data)
            results.failed++
            results.details.push({
              to: recipient,
              status: "failed",
              error: data.error?.message || "Unknown error",
            })
            return false
          }

          results.successful++
          results.details.push({
            to: recipient,
            status: "sent",
            message_id: data.messages?.[0]?.id,
          })
          return true
        } catch (error) {
          console.error(`Error sending to ${recipient}:`, error)
          results.failed++
          results.details.push({
            to: recipient,
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
          })
          return false
        }
      })

      // Wait for the current batch to complete
      await Promise.all(batchPromises)

      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < to.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      messaging_product: "whatsapp",
      successful: results.successful,
      failed: results.failed,
      details: results.details,
    })
  } catch (error) {
    console.error("Error sending bulk WhatsApp messages:", error)
    return NextResponse.json({ error: "Failed to send bulk WhatsApp messages" }, { status: 500 })
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
