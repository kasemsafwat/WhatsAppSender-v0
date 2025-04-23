"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Send, X, RefreshCw, ImageIcon, FileText, CheckCircle, AlertTriangle, CreditCard } from "lucide-react"
import { sendWhatsAppMessage, sendWhatsAppBulkMessages } from "@/lib/whatsapp-api"
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media-api"
import { config } from "@/lib/config"

// Add this function near the top of the file, after the imports
function formatErrorMessage(error: any): string {
  if (typeof error === "string") {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  // Check for the specific payment error
  if (
    error?.code === "PAYMENT_REQUIRED" ||
    (error?.error && typeof error.error === "string" && error.error.includes("non-payment"))
  ) {
    return "Your Ultramsg account is inactive due to non-payment. Please renew your subscription."
  }

  if (error?.error) {
    // Handle API error responses
    return typeof error.error === "string" ? error.error : JSON.stringify(error.error)
  }

  return "An unknown error occurred"
}

// Flag to indicate if we're in simulation mode - this will be updated from config
const IS_SIMULATION_MODE = config.whatsapp.useSimulationMode

// Country codes for WhatsApp
const countryCodes = [
  { code: "2", country: "Egypt" },
  { code: "966", country: "Saudi Arabia" },
  /*   { code: "1", country: "United States" },
  { code: "44", country: "United Kingdom" },
  { code: "91", country: "India" },
  { code: "55", country: "Brazil" },
  { code: "52", country: "Mexico" },
  { code: "49", country: "Germany" },
  { code: "33", country: "France" },
  { code: "39", country: "Italy" },
  { code: "34", country: "Spain" },
  { code: "7", country: "Russia" },
  { code: "86", country: "China" },
  { code: "81", country: "Japan" },
  { code: "82", country: "South Korea" },
  { code: "966", country: "Saudi Arabia" },
  { code: "971", country: "United Arab Emirates" },
  { code: "20", country: "Egypt" },
  { code: "27", country: "South Africa" },
  { code: "234", country: "Nigeria" },
  { code: "254", country: "Kenya" },
  { code: "61", country: "Australia" }, */
];

// Message templates
const messageTemplates = [
  { id: "welcome", name: "Welcome Message", content: "Welcome to our service! We're glad to have you on board." },
  { id: "reminder", name: "Appointment Reminder", content: "This is a reminder about your upcoming appointment." },
  { id: "confirmation", name: "Order Confirmation", content: "Your order has been confirmed and is being processed." },
  { id: "custom", name: "Custom Message", content: "" },
]

export default function DashboardPage() {
  const [user, setUser] = useState<{ name?: string; email: string } | null>(null)
  const [message, setMessage] = useState("")
  const [countryCode, setCountryCode] = useState("1")
  const [recipientNumbers, setRecipientNumbers] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [processedRecipients, setProcessedRecipients] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState("compose")
  const [selectedTemplate, setSelectedTemplate] = useState("custom")
  const [messageStatus, setMessageStatus] = useState<Record<string, "pending" | "sent" | "failed">>({})
  const [sendingProgress, setSendingProgress] = useState(0)
  const [isSending, setIsSending] = useState(false)
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSimulationMode, setIsSimulationMode] = useState(IS_SIMULATION_MODE)
  const [paymentRequired, setPaymentRequired] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem("whatsapp-sender-user")
    if (!userData) {
      // For demo purposes, create a mock user
      const mockUser = { name: "Demo User", email: "demo@example.com" }
      localStorage.setItem("whatsapp-sender-user", JSON.stringify(mockUser))
      setUser(mockUser)
    } else {
      try {
        setUser(JSON.parse(userData))
      } catch (error) {
        const mockUser = { name: "Demo User", email: "demo@example.com" }
        localStorage.setItem("whatsapp-sender-user", JSON.stringify(mockUser))
        setUser(mockUser)
      }
    }
  }, [])

  // Handle template selection
  useEffect(() => {
    if (selectedTemplate !== "custom") {
      const template = messageTemplates.find((t) => t.id === selectedTemplate)
      if (template) {
        setMessage(template.content)
      }
    }
  }, [selectedTemplate])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setIsLoading(true)
      setUploadError(null)

      // Create preview URL for image
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string)
        }
        reader.readAsDataURL(file)

        try {
          // Check file size
          if (file.size > 5 * 1024 * 1024) {
            // 5MB limit
            throw new Error("File size exceeds 5MB limit. Please choose a smaller image.")
          }

          console.log("Starting file upload process for:", file.name)

          // For Ultramsg, we can use the data URL directly
          try {
            console.log("Preparing image for Ultramsg...")
            const uploadResult = await uploadWhatsAppMedia(file)
            setUploadedImageUrl(uploadResult.url)
            console.log("Image prepared successfully:", uploadResult)

            // Check if this was a simulated response
            if (uploadResult.simulation) {
              setIsSimulationMode(true)
            }

            toast({
              title: "Image ready",
              description: isSimulationMode
                ? "Your image is ready (simulation mode)"
                : "Your image is ready to be sent with Ultramsg.",
            })
          } catch (uploadError) {
            console.error("Image preparation failed:", uploadError)

            // Fallback to using the preview URL directly
            console.log("Falling back to using preview URL...")
            setUploadedImageUrl(reader.result as string)

            toast({
              title: "Using local image",
              description: "Using local image preview for sending.",
            })
          }
        } catch (error) {
          console.error("File handling error:", error)
          setUploadError(error instanceof Error ? error.message : "Unknown error occurred")
          toast({
            title: "Upload failed",
            description: error instanceof Error ? error.message : "Failed to upload image. Please try again.",
            variant: "destructive",
          })
          // Don't clear the file on error so user can see what they uploaded
        } finally {
          setIsLoading(false)
        }
      } else {
        setPreviewUrl(null)
        setIsLoading(false)
        setUploadError("Invalid file type. Please select an image file.")
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        })
        removeFile()
      }
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setUploadedImageUrl(null)
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("whatsapp-sender-user")
    router.push("/login")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!message) {
        throw new Error("Please enter a message")
      }

      if (!recipientNumbers) {
        throw new Error("Please enter at least one recipient number")
      }

      // Split recipient numbers by commas, newlines, or spaces
      const numbers = recipientNumbers
        .split(/[\n,\s]+/)
        .map((num) => num.trim())
        .filter((num) => num.length > 0)

      if (numbers.length === 0) {
        throw new Error("Please enter at least one valid recipient number")
      }

      // Initialize message status for each recipient
      const initialStatus: Record<string, "pending" | "sent" | "failed"> = {}
      numbers.forEach((num) => {
        initialStatus[num] = "pending"
      })

      setMessageStatus(initialStatus)
      setProcessedRecipients(numbers)
      setSendingProgress(0)
      setActiveTab("send")

      toast({
        title: "Recipients processed",
        description: `${numbers.length} recipient(s) ready. Click 'Send Messages' to begin.`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const sendMessages = async () => {
    if (processedRecipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please add recipients first.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setSendingProgress(0)
    setPaymentRequired(false)

    try {
      // Example of sending messages in sequence with progress updates
      for (let i = 0; i < processedRecipients.length; i++) {
        const recipient = processedRecipients[i]
        const fullNumber = `${countryCode}${recipient}`

        try {
          // Update status to indicate we're processing this recipient
          setMessageStatus((prev) => ({ ...prev, [recipient]: "pending" }))

          // Call the WhatsApp API function
          const result = await sendWhatsAppMessage({
            to: fullNumber,
            message: message,
            mediaUrl: uploadedImageUrl,
          })

          // Check if this was a simulated response
          if (result.simulation) {
            setIsSimulationMode(true)

            // Check if this was due to a payment issue
            if (result.paymentRequired) {
              setPaymentRequired(true)
            }
          }

          // Update status to indicate success
          setMessageStatus((prev) => ({ ...prev, [recipient]: "sent" }))

          toast({
            title: isSimulationMode ? "Message simulated" : "Message sent",
            description: `Message ${isSimulationMode ? "simulated" : "sent"} to +${countryCode} ${recipient}`,
          })
        } catch (error) {
          // Check if this is a payment error and update simulation mode
          if (
            error &&
            typeof error === "object" &&
            (("code" in error && error.code === "PAYMENT_REQUIRED") ||
              ("error" in error && typeof error.error === "string" && error.error.includes("non-payment")))
          ) {
            setIsSimulationMode(true)
            setPaymentRequired(true)

            toast({
              title: "Ultramsg Payment Required",
              description:
                "Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription.",
              variant: "destructive",
            })

            // Update all remaining recipients to failed
            const updatedStatus = { ...messageStatus }
            processedRecipients.slice(i).forEach((num) => {
              updatedStatus[num] = "failed"
            })
            setMessageStatus(updatedStatus)

            // Set progress to 100% since we're stopping
            setSendingProgress(100)
            break
          }

          // Update status to indicate failure
          setMessageStatus((prev) => ({ ...prev, [recipient]: "failed" }))

          toast({
            title: "Send failed",
            description: `Failed to send to +${countryCode} ${recipient}: ${formatErrorMessage(error)}`,
            variant: "destructive",
          })
        }

        // Update progress
        setSendingProgress(Math.round(((i + 1) / processedRecipients.length) * 100))

        // Add a small delay between messages to avoid rate limits
        if (i < processedRecipients.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      if (!paymentRequired) {
        toast({
          title: "Process complete",
          description: `Attempted to send messages to ${processedRecipients.length} recipients.`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: formatErrorMessage(error),
        variant: "destructive",
      })
    } finally {
      setIsSending(false)
    }
  }

  const sendBulkMessages = async () => {
    if (processedRecipients.length === 0) {
      toast({
        title: "No recipients",
        description: "Please add recipients first.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setSendingProgress(0)
    setPaymentRequired(false)

    try {
      // Format numbers with country code
      const formattedNumbers = processedRecipients.map((num) => `${countryCode}${num}`)

      // Set all statuses to pending
      const pendingStatus: Record<string, "pending" | "sent" | "failed"> = {}
      processedRecipients.forEach((num) => {
        pendingStatus[num] = "pending"
      })
      setMessageStatus(pendingStatus)

      // Call the bulk send API
      const result = await sendWhatsAppBulkMessages({
        to: formattedNumbers,
        message: message,
        mediaUrl: uploadedImageUrl,
      })

      // Check if this was a simulated response
      if (result.simulation) {
        setIsSimulationMode(true)

        // Check if this was due to a payment issue
        if (result.paymentRequired) {
          setPaymentRequired(true)
        }
      }

      // Update statuses based on the response
      if (result.details) {
        const updatedStatus: Record<string, "pending" | "sent" | "failed"> = {}

        result.details.forEach((detail) => {
          // Extract the number without country code
          const numberWithoutCode = detail.to.startsWith(countryCode)
            ? detail.to.substring(countryCode.length)
            : detail.to

          updatedStatus[numberWithoutCode] = detail.status === "sent" ? "sent" : "failed"
        })

        setMessageStatus(updatedStatus)
      } else {
        // If no details, update based on successful/failed counts
        const updatedStatus: Record<string, "pending" | "sent" | "failed"> = {}
        const successCount = result.successful || 0

        processedRecipients.forEach((num, index) => {
          updatedStatus[num] = index < successCount ? "sent" : "failed"
        })

        setMessageStatus(updatedStatus)
      }

      setSendingProgress(100)

      toast({
        title: isSimulationMode ? "Bulk simulation complete" : "Bulk send complete",
        description: `Successfully ${isSimulationMode ? "simulated" : "sent"}: ${result.successful}, Failed: ${result.failed}`,
        variant: result.failed > 0 ? "destructive" : "default",
      })
    } catch (error) {
      // Check if this is a payment error and update simulation mode
      if (
        error &&
        typeof error === "object" &&
        (("code" in error && error.code === "PAYMENT_REQUIRED") ||
          ("error" in error && typeof error.error === "string" && error.error.includes("non-payment")))
      ) {
        setIsSimulationMode(true)
        setPaymentRequired(true)

        toast({
          title: "Ultramsg Payment Required",
          description: "Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription.",
          variant: "destructive",
        })

        // Mark all as failed
        const failedStatus: Record<string, "pending" | "sent" | "failed"> = {}
        processedRecipients.forEach((num) => {
          failedStatus[num] = "failed"
        })
        setMessageStatus(failedStatus)
      } else {
        toast({
          title: "Bulk send failed",
          description: formatErrorMessage(error),
          variant: "destructive",
        })
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleRenewSubscription = () => {
    window.open("https://ultramsg.com/", "_blank")
  }

  const testConnection = async () => {
    try {
      toast({
        title: "Testing connection",
        description: "Checking connection to Ultramsg API...",
      })

      const response = await fetch("/api/whatsapp/test-connection")
      const data = await response.json()

      if (data.status === "success") {
        toast({
          title: "Connection successful",
          description: "Successfully connected to Ultramsg API.",
        })
        console.log("Connection test result:", data)
      } else {
        toast({
          title: "Connection failed",
          description: data.error || "Failed to connect to Ultramsg API",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Connection test error",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    }
  }

  if (!user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-4 lg:px-6 h-14 flex items-center border-b">
        <div className="flex items-center justify-center">
          <span className="text-xl font-bold">WhatsApp Sender (Ultramsg)</span>
        </div>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <span className="text-sm font-medium">Welcome, {user.name || user.email}</span>
          <button onClick={handleLogout} className="text-sm font-medium hover:underline underline-offset-4">
            Logout
          </button>
        </nav>
      </header>
      <main className="flex-1 py-6">
        <div className="container px-4 md:px-6">
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Status Banners */}
            {paymentRequired && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-red-800">Ultramsg Payment Required</h3>
                  <p className="text-sm text-red-700 mt-1">
                    Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription to send
                    real messages.
                  </p>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-white text-red-600 border-red-300 hover:bg-red-50"
                      onClick={handleRenewSubscription}
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Renew Subscription
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {isSimulationMode && !paymentRequired && (
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-800">Simulation Mode Active</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    The application is running in simulation mode. Messages will be simulated but not actually sent.
                  </p>
                </div>
              </div>
            )}

            {!isSimulationMode && !paymentRequired && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-green-800">Ultramsg API Active</h3>
                  <p className="text-sm text-green-700 mt-1">
                    The application is configured to send real WhatsApp messages using Ultramsg API with your token.
                  </p>
                </div>
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="compose">Compose Message</TabsTrigger>
                <TabsTrigger value="send">Send Messages</TabsTrigger>
              </TabsList>

              <TabsContent value="compose">
                <Card>
                  <CardHeader>
                    <CardTitle>Compose Your Message</CardTitle>
                    <CardDescription>Create your message and add recipients</CardDescription>
                  </CardHeader>
                  <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="template">Message Template</Label>
                        <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {messageTemplates.map((template) => (
                              <SelectItem key={template.id} value={template.id}>
                                {template.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Message Text</Label>
                        <Textarea
                          id="message"
                          placeholder="Enter your message here"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <p className="text-xs text-muted-foreground">This message will be sent to all recipients.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Image Attachment (Optional)</Label>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading}
                          >
                            {isLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ImageIcon className="mr-2 h-4 w-4" />
                            )}
                            {selectedFile ? "Change Image" : "Upload Image"}
                          </Button>
                          <Input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                            accept="image/*"
                          />
                          {selectedFile && (
                            <Button type="button" variant="outline" size="icon" onClick={removeFile}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {previewUrl && (
                          <div className="mt-2">
                            <img
                              src={previewUrl || "/placeholder.svg"}
                              alt="Preview"
                              className="max-h-40 rounded-md border"
                            />
                            {uploadedImageUrl && !uploadError && (
                              <p className="text-xs text-green-600 mt-1">✓ Image ready to send</p>
                            )}
                            {uploadError && (
                              <p className="text-xs text-red-600 mt-1">⚠️ {uploadError} (Using preview image instead)</p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="country-code">Country Code</Label>
                        <Select value={countryCode} onValueChange={setCountryCode}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country code" />
                          </SelectTrigger>
                          <SelectContent>
                            {countryCodes.map((country) => (
                              <SelectItem key={country.code} value={country.code}>
                                +{country.code} ({country.country})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="recipient-numbers">Recipient Numbers</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => document.getElementById("csv-upload")?.click()}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Import CSV
                          </Button>
                          <Input
                            id="csv-upload"
                            type="file"
                            className="hidden"
                            accept=".csv"
                            onChange={(e) => {
                              // In a real app, you would parse the CSV file here
                              toast({
                                title: "CSV Import",
                                description: "CSV import functionality would be implemented here.",
                              })
                            }}
                          />
                        </div>
                        <Textarea
                          id="recipient-numbers"
                          placeholder="Enter recipient numbers (one per line or comma-separated)"
                          value={recipientNumbers}
                          onChange={(e) => setRecipientNumbers(e.target.value)}
                          className="min-h-[100px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Enter numbers without country code (e.g., 1234567890)
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Process Recipients
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </TabsContent>

              <TabsContent value="send">
                <Card>
                  <CardHeader>
                    <CardTitle>Send WhatsApp Messages</CardTitle>
                    <CardDescription>
                      {isSimulationMode
                        ? "Simulate sending your message to all recipients"
                        : "Send your message to all recipients"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 border rounded-md bg-gray-50">
                      <div className="font-medium mb-2">Message Preview:</div>
                      <div className="whitespace-pre-wrap">{message}</div>
                      {previewUrl && (
                        <div className="mt-2">
                          <img
                            src={previewUrl || "/placeholder.svg"}
                            alt="Attachment"
                            className="max-h-40 rounded-md border"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Sending Progress</Label>
                        <span className="text-sm font-medium">{sendingProgress}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-600 transition-all duration-300"
                          style={{ width: `${sendingProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        className="flex-1"
                        onClick={sendMessages}
                        disabled={isSending || processedRecipients.length === 0}
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isSimulationMode ? "Simulating..." : "Sending..."}
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            {isSimulationMode ? "Simulate Sequentially" : "Send Sequentially"}
                          </>
                        )}
                      </Button>

                      <Button
                        className="flex-1"
                        onClick={sendBulkMessages}
                        disabled={isSending || processedRecipients.length === 0}
                        variant="outline"
                      >
                        {isSending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {isSimulationMode ? "Simulating..." : "Sending..."}
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            {isSimulationMode ? "Simulate in Bulk" : "Send in Bulk"}
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label>Recipients ({processedRecipients.length})</Label>
                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                        {processedRecipients.map((recipient, index) => (
                          <div
                            key={index}
                            className={`p-3 border rounded-md flex justify-between items-center ${
                              messageStatus[recipient] === "sent"
                                ? "bg-green-50 border-green-200"
                                : messageStatus[recipient] === "failed"
                                  ? "bg-red-50 border-red-200"
                                  : ""
                            }`}
                          >
                            <span>
                              +{countryCode} {recipient}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                messageStatus[recipient] === "sent"
                                  ? "bg-green-100 text-green-800"
                                  : messageStatus[recipient] === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {messageStatus[recipient] === "sent"
                                ? isSimulationMode
                                  ? "Simulated"
                                  : "Sent"
                                : messageStatus[recipient] === "failed"
                                  ? "Failed"
                                  : "Pending"}
                            </span>
                          </div>
                        ))}
                        {processedRecipients.length === 0 && (
                          <div className="text-center py-4 text-gray-500">No recipients added yet</div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full" onClick={() => setActiveTab("compose")}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Edit Message & Recipients
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>

            <Card>
              <CardHeader>
                <CardTitle>About Ultramsg API</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  This application uses the Ultramsg API to send WhatsApp messages. Ultramsg is a third-party service
                  that provides an interface to the WhatsApp platform.
                </p>
                <p className="text-sm text-muted-foreground">
                  Messages are sent through your connected WhatsApp account. All messages must comply with WhatsApp's
                  Business Policy and Messaging Guidelines.
                </p>

                {paymentRequired && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm font-medium">Ultramsg Payment Required</p>
                    <p className="text-xs text-red-700 mt-1">
                      Your Ultramsg instance has been stopped due to non-payment. Please renew your subscription to send
                      real messages.
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Visit the Ultramsg website to manage your subscription and reactivate your instance.
                    </p>
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-white text-red-600 border-red-300 hover:bg-red-50"
                        onClick={handleRenewSubscription}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Renew Subscription
                      </Button>
                    </div>
                  </div>
                )}

                {isSimulationMode && !paymentRequired && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                    <p className="text-sm font-medium">Simulation Mode Information</p>
                    <p className="text-xs text-amber-700 mt-1">
                      The application is currently running in simulation mode. Messages will be simulated but not
                      actually sent.
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      To send real messages, update the configuration to disable simulation mode and ensure your
                      Ultramsg account is active.
                    </p>
                  </div>
                )}

                {!isSimulationMode && !paymentRequired && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm font-medium">Ultramsg API Information</p>
                    <p className="text-xs text-green-700 mt-1">
                      The application is currently configured to send real WhatsApp messages via Ultramsg.
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Make sure your Ultramsg instance is properly configured and active.
                    </p>
                  </div>
                )}
                <div className="mt-4">
                  <Button onClick={testConnection} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Test Ultramsg Connection
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <footer className="border-t py-6 px-4 md:px-6">
        <div className="container flex flex-col items-center justify-center gap-4 md:flex-row">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            © 2023 WhatsApp Sender. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
