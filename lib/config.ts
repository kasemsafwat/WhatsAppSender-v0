// Configuration for WhatsApp Business API

// This file centralizes all environment variable access
// and provides defaults for development/testing

export const config = {
  // WhatsApp Business API configuration
  whatsapp: {
    // The API token for WhatsApp Business API
    apiToken: process.env.WHATSAPP_API_TOKEN || "",

    // The phone number ID for your WhatsApp Business account
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",

    // Whether to use mock responses instead of real API calls
    // This is useful for development and testing
    useMockResponses: true, // Set to false in production
  },
}
