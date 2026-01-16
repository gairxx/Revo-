// This file is kept for backward compatibility
// The main app now runs at /dashboard with Supabase authentication
// See app/dashboard/dashboard-client.tsx for the authenticated version

"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

const App: React.FC = () => {
  const router = useRouter()

  useEffect(() => {
    // Redirect to home page when this component is loaded directly
    router.push("/")
  }, [router])

  return null
}

export default App
