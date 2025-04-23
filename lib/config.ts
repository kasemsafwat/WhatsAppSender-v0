// Configuration for WhatsApp API using Ultramsg

export const config = {
  // WhatsApp API configuration
  whatsapp: {
    // The API token for Ultramsg
    apiToken: process.env.WHATSAPP_API_TOKEN || "2q0k1ra2l3yt0xah",

    // The instance ID for Ultramsg (your specific instance)
    instanceId: process.env.WHATSAPP_INSTANCE_ID || "instance115952",

    // Base URL for Ultramsg API
    apiBaseUrl: "https://api.ultramsg.com",

    // Whether to use simulation mode instead of real API calls
    // Set to false to attempt sending real messages
    useSimulationMode: false,

    // Whether to fall back to simulation mode if the API returns a payment error
    // This allows the app to continue functioning even if the account is inactive
    fallbackOnPaymentError: true,
  },
}
