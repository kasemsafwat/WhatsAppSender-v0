// lib/whatsapp-media-api.ts

// Function to upload media for WhatsApp messages
export async function uploadWhatsAppMedia(file: File): Promise<{ url: string; id: string }> {
  try {
    console.log("Starting media upload for file:", file.name, "Size:", file.size, "Type:", file.type)

    // Create a FormData object
    const formData = new FormData()
    formData.append("file", file)

    // Log that we're about to make the request
    console.log("Sending upload request to API...")

    const response = await fetch("/api/whatsapp/upload-media", {
      method: "POST",
      body: formData,
    })

    // Get the response text first for debugging
    const responseText = await response.text()
    console.log("API Response text:", responseText)

    // Try to parse the response as JSON
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (parseError) {
      console.error("Failed to parse response as JSON:", parseError)
      throw new Error(`Invalid response format: ${responseText.substring(0, 100)}...`)
    }

    // Check if the response was successful
    if (!response.ok) {
      const errorMessage = responseData.error || `Upload failed with status: ${response.status}`
      console.error("Upload failed:", errorMessage, responseData)
      throw new Error(errorMessage)
    }

    // Log successful response
    console.log("Upload successful, received:", responseData)

    // If we don't have the expected fields, throw an error
    if (!responseData.url || !responseData.id) {
      console.error("Missing required fields in response:", responseData)
      throw new Error("Invalid response: missing required fields")
    }

    return {
      url: responseData.url,
      id: responseData.id,
    }
  } catch (error) {
    console.error("Error in uploadWhatsAppMedia:", error)
    // Rethrow with a more descriptive message
    if (error instanceof Error) {
      throw new Error(`Media upload failed: ${error.message}`)
    } else {
      throw new Error("Media upload failed: Unknown error")
    }
  }
}
