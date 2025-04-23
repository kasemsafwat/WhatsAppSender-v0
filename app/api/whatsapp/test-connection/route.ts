import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function GET(request: Request) {
  try {
    // Get the Ultramsg API token and instance ID
    const apiToken = process.env.WHATSAPP_API_TOKEN || config.whatsapp.apiToken
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || config.whatsapp.instanceId
    const apiBaseUrl = config.whatsapp.apiBaseUrl

    if (!apiToken || !instanceId) {
      console.error("Ultramsg API credentials not configured")
      return NextResponse.json({ error: "Ultramsg API not properly configured" }, { status: 500 })
    }

    // Construct the API URL for checking instance status
    const apiUrl = `${apiBaseUrl}/${instanceId}/instance/status`

    console.log("Testing connection to Ultramsg API")
    console.log("API URL:", apiUrl)
    console.log("Token:", apiToken)

    // Send a request to check the instance status
    const response = await fetch(`${apiUrl}?token=${apiToken}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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

    // Return the response data
    return NextResponse.json({
      status: "success",
      message: "Connection test completed",
      apiUrl,
      instanceId,
      response: data,
    })
  } catch (error) {
    console.error("Error testing Ultramsg connection:", error)
    return NextResponse.json(
      {
        error: "Failed to test Ultramsg connection",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
