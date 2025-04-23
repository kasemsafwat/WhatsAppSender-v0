import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function POST(request: Request) {
  try {
    const { to, message, mediaUrl } = await request.json()

    // Validate inputs
    if (!to || !message) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Check if we're in simulation mode
    if (config.whatsapp.useSimulationMode) {
      console.log("SIMULATION MODE: Would send message to", to)

      // Simulate a successful response after a short delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      return NextResponse.json({
        id: `sim_${Math.random().toString(36).substring(2, 15)}`,
        status: "sent",
        simulation: true,
        message: "Message simulated (Ultramsg account inactive)",
      })
    }

    // Get the Ultramsg API token and instance ID
    const apiToken = process.env.WHATSAPP_API_TOKEN || config.whatsapp.apiToken
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || config.whatsapp.instanceId
    const apiBaseUrl = config.whatsapp.apiBaseUrl

    if (!apiToken || !instanceId) {
      console.error("Ultramsg API credentials not configured")
      return NextResponse.json({ error: "Ultramsg API not properly configured" }, { status: 500 })
    }

    // Prepare the API URL and payload based on whether we have media or not
    let apiUrl: string
    let payload: Record<string, string>

    if (mediaUrl) {
      // If we have media, use the image API endpoint
      apiUrl = `${apiBaseUrl}/${instanceId}/messages/image`
      payload = {
        token: apiToken,
        to,
        image: mediaUrl,
        caption: message,
      }
    } else {
      // Otherwise, use the regular chat message endpoint
      apiUrl = `${apiBaseUrl}/${instanceId}/messages/chat`
      payload = {
        token: apiToken,
        to,
        body: message,
      }
    }

    console.log(`Sending message to ${to} using Ultramsg API`)
    console.log("API URL:", apiUrl)
    console.log("Payload:", JSON.stringify(payload))

    // Send the message using the Ultramsg API
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    // Get the response text for debugging
    const responseText = await response.text()
    console.log("API Response status:", response.status)
    console.log("API Response text:", responseText)

    // Try to parse the response as JSON
    let data
    try {
      data = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", responseText)
      return NextResponse.json(
        {
          error: "Invalid response from Ultramsg API",
          details: responseText,
        },
        { status: 500 },
      )
    }

    // Check for the specific payment error
    if (data.error && data.error.includes("Stopped due to non-payment")) {
      console.error("Ultramsg account payment required:", data.error)

      // If configured to fall back to simulation mode on payment error
      if (config.whatsapp.fallbackOnPaymentError) {
        console.log("Falling back to simulation mode due to payment error")

        // Return a simulated success response
        return NextResponse.json({
          id: `sim_${Math.random().toString(36).substring(2, 15)}`,
          status: "sent",
          simulation: true,
          paymentRequired: true,
          message: "Message simulated (Ultramsg account inactive)",
          originalError: data.error,
        })
      }

      // Otherwise, return the payment error
      return NextResponse.json(
        {
          error: "Ultramsg account inactive",
          details: "Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription.",
          code: "PAYMENT_REQUIRED",
          originalError: data.error,
        },
        { status: 402 }, // 402 Payment Required
      )
    }

    if (!response.ok) {
      console.error("Ultramsg API error:", data)
      return NextResponse.json(
        {
          error: data.error || data.message || "Failed to send WhatsApp message",
          details: data,
        },
        { status: response.status },
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    return NextResponse.json(
      {
        error: "Failed to send WhatsApp message",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
