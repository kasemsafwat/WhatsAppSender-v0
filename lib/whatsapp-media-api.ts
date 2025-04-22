// lib/whatsapp-media-api.ts

// Function to upload media for WhatsApp messages
export async function uploadWhatsAppMedia(file: File): Promise<{ url: string; id: string }> {
  try {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/whatsapp/upload-media", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Upload failed with status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error uploading media:", error)
    throw error
  }
}
