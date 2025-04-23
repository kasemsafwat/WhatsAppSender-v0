import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function POST(request: Request) {
  try {
    const { to, message, mediaUrl } = await request.json()

    // Validate inputs
    if (!to || !Array.isArray(to) || to.length === 0 || !message) {
      return NextResponse.json({ error: "Missing or invalid parameters" }, { status: 400 })
    }

    // Check if we're in simulation mode
    if (config.whatsapp.useSimulationMode) {
      console.log("SIMULATION MODE: Would send bulk messages to", to)

      // Simulate a successful response after a short delay
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Create simulated details for each recipient
      const details = to.map((recipient) => ({
        to: recipient,
        status: "sent",
        message_id: `sim_${Math.random().toString(36).substring(2, 15)}`,
      }))

      return NextResponse.json({
        successful: to.length,
        failed: 0,
        details,
        simulation: true,
        message: "Messages simulated (Ultramsg account inactive)",
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
          // Prepare the API URL and payload based on whether we have media or not
          let apiUrl: string
          let payload: Record<string, string>

          if (mediaUrl) {
            // If we have media, use the image API endpoint
            apiUrl = `${apiBaseUrl}/${instanceId}/messages/image`
            payload = {
              token: apiToken,
              to: recipient,
              image: mediaUrl,
              caption: message,
            }
          } else {
            // Otherwise, use the regular chat message endpoint
            apiUrl = `${apiBaseUrl}/${instanceId}/messages/chat`
            payload = {
              token: apiToken,
              to: recipient,
              body: message,
            }
          }

          console.log(`Sending message to ${recipient} using Ultramsg API`)
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
          console.log(`Response for ${recipient}:`, responseText)

          // Try to parse the response as JSON
          let data
          try {
            data = JSON.parse(responseText)
          } catch (parseError) {
            console.error(`Failed to parse response for ${recipient}:`, responseText)
            results.failed++
            results.details.push({
              to: recipient,
              status: "failed",
              error: "Invalid response format",
            })
            return false
          }

          // Check for the specific payment error
          if (data.error && data.error.includes("Stopped due to non-payment")) {
            throw new Error(`Payment required: ${data.error}`)
          }

          if (!response.ok) {
            console.error(`Failed to send to ${recipient}:`, data)
            results.failed++
            results.details.push({
              to: recipient,
              status: "failed",
              error: data.error || data.message || "Unknown error",
            })
            return false
          }

          results.successful++
          results.details.push({
            to: recipient,
            status: "sent",
            message_id: data.id || data.message_id || "unknown",
          })
          return true
        } catch (error) {
          console.error(`Error sending to ${recipient}:`, error)

          // Check if this is a payment error
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          if (errorMessage.includes("Payment required")) {
            throw error // Re-throw to be caught by the outer try/catch
          }

          results.failed++
          results.details.push({
            to: recipient,
            status: "failed",
            error: errorMessage,
          })
          return false
        }
      })

      try {
        // Wait for the current batch to complete
        await Promise.all(batchPromises)
      } catch (batchError) {
        // Check if this is a payment error
        const errorMessage = batchError instanceof Error ? batchError.message : "Unknown error"
        if (errorMessage.includes("Payment required")) {
          // If configured to fall back to simulation mode on payment error
          if (config.whatsapp.fallbackOnPaymentError) {
            console.log("Falling back to simulation mode due to payment error")

            // Create simulated details for each recipient
            const details = to.map((recipient) => ({
              to: recipient,
              status: "sent",
              message_id: `sim_${Math.random().toString(36).substring(2, 15)}`,
            }))

            return NextResponse.json({
              successful: to.length,
              failed: 0,
              details,
              simulation: true,
              paymentRequired: true,
              message: "Messages simulated (Ultramsg account inactive)",
              originalError: errorMessage,
            })
          }

          // Otherwise, return the payment error
          return NextResponse.json(
            {
              error: "Ultramsg account inactive",
              details: "Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription.",
              code: "PAYMENT_REQUIRED",
              originalError: errorMessage,
            },
            { status: 402 }, // 402 Payment Required
          )
        }

        // For other errors, continue processing
        console.error("Error in batch:", batchError)
      }

      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < to.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      successful: results.successful,
      failed: results.failed,
      details: results.details,
    })
  } catch (error) {
    console.error("Error sending bulk WhatsApp messages:", error)

    // Check if this is a payment error
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    if (errorMessage.includes("Payment required")) {
      // If configured to fall back to simulation mode on payment error
      if (config.whatsapp.fallbackOnPaymentError) {
        console.log("Falling back to simulation mode due to payment error in catch block")

        return NextResponse.json({
          error: "Ultramsg account inactive - simulation mode activated",
          details:
            "Your Ultramsg instance has been stopped due to non-payment. The app has switched to simulation mode.",
          code: "PAYMENT_REQUIRED_SIMULATION",
          simulation: true,
        })
      }

      return NextResponse.json(
        {
          error: "Ultramsg account inactive",
          details: "Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription.",
          code: "PAYMENT_REQUIRED",
          originalError: errorMessage,
        },
        { status: 402 }, // 402 Payment Required
      )
    }

    return NextResponse.json(
      {
        error: "Failed to send bulk WhatsApp messages",
        message: errorMessage,
      },
      { status: 500 },
    )
  }
}
