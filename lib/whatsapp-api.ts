// WhatsApp Business API implementation

interface SendMessageParams {
  to: string
  message: string
  mediaUrl?: string | null
}

interface SendBulkMessageParams {
  to: string[]
  message: string
  mediaUrl?: string | null
}

interface MessageResponse {
  id: string
  status?: string
}

interface BulkMessageResponse {
  successful: number
  failed: number
  details?: Array<{
    to: string
    status: string
    error?: string
    message_id?: string
  }>
}

// Function to send a WhatsApp message using the Business API
export async function sendWhatsAppMessage({ to, message, mediaUrl }: SendMessageParams): Promise<MessageResponse> {
  try {
    const response = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message,
        mediaUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Failed to send message: ${response.status}`)
    }

    const data = await response.json()
    return {
      id: data.messages?.[0]?.id || "unknown",
      status: "sent",
    }
  } catch (error) {
    console.error("Error sending WhatsApp message:", error)
    throw error
  }
}

// Function to send bulk WhatsApp messages
export async function sendWhatsAppBulkMessages({
  to,
  message,
  mediaUrl,
}: SendBulkMessageParams): Promise<BulkMessageResponse> {
  try {
    const response = await fetch("/api/whatsapp/send-bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to,
        message,
        mediaUrl,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Failed to send bulk messages: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error sending bulk WhatsApp messages:", error)
    throw error
  }
}

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
