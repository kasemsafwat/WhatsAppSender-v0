"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { isLoggedIn } from "@/lib/auth-utils"

interface AuthCheckProps {
  children: React.ReactNode
  redirectTo?: string
}

export function AuthCheck({ children, redirectTo = "/login" }: AuthCheckProps) {
  const router = useRouter()

  useEffect(() => {
    if (!isLoggedIn()) {
      router.push(redirectTo)
    }
  }, [router, redirectTo])

  return <>{children}</>
}
