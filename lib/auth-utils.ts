// Simple client-side auth utilities
// In a real app, you would use a proper auth solution

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false

  const userData = localStorage.getItem("whatsapp-sender-user")
  return !!userData
}

export function getUser(): { name?: string; email: string } | null {
  if (typeof window === "undefined") return null

  try {
    const userData = localStorage.getItem("whatsapp-sender-user")
    if (!userData) return null
    return JSON.parse(userData)
  } catch (error) {
    return null
  }
}

export function logout(): void {
  if (typeof window === "undefined") return

  localStorage.removeItem("whatsapp-sender-user")
  window.location.href = "/login"
}
