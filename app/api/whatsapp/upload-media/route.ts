import { NextResponse } from "next/server"
import { config } from "@/lib/config"

export async function POST(request: Request) {
  try {
    console.log("Media upload API called")

    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      console.error("No file provided in request")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log("Received file:", file.name, "Size:", file.size, "Type:", file.type)

    // Check if we're in simulation mode
    if (config.whatsapp.useSimulationMode) {
      console.log("SIMULATION MODE: Processing image")

      // Convert the file to a data URL for simulation
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const base64 = buffer.toString("base64")
      const dataUrl = `data:${file.type};base64,${base64}`

      // Generate a unique ID for the media
      const mediaId = `sim_${Math.random().toString(36).substring(2, 15)}`

      return NextResponse.json({
        id: mediaId,
        url: dataUrl,
        mime_type: file.type,
        file_size: file.size,
        simulation: true,
        message: "Image processed in simulation mode",
      })
    }

    // Get the Ultramsg API token and instance ID
    const apiToken = process.env.WHATSAPP_API_TOKEN || config.whatsapp.apiToken
    const instanceId = process.env.WHATSAPP_INSTANCE_ID || config.whatsapp.instanceId

    if (!apiToken || !instanceId) {
      console.error("Ultramsg API credentials not configured")
      return NextResponse.json({ error: "Ultramsg API not properly configured" }, { status: 500 })
    }

    // For Ultramsg, we can use a data URL or a public URL
    // Convert the file to a data URL
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const dataUrl = `data:${file.type};base64,${base64}`

    // Generate a unique ID for the media
    const mediaId = `media_${Math.random().toString(36).substring(2, 15)}`

    console.log("Created data URL for file, length:", dataUrl.length)

    return NextResponse.json({
      id: mediaId,
      url: dataUrl,
      mime_type: file.type,
      file_size: file.size,
    })
  } catch (error) {
    console.error("Error in upload-media API route:", error)
    return NextResponse.json(
      {
        error: "Failed to process media",
        message: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    )
  }
}
