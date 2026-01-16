"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Wrench, Check, Loader2 } from "lucide-react"

export function SuccessContent() {
  const [isVerifying, setIsVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    const verifySubscription = async () => {
      if (!sessionId) {
        setError("No session ID found")
        setIsVerifying(false)
        return
      }

      try {
        const response = await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to verify subscription")
        }

        setIsVerifying(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        setIsVerifying(false)
      }
    }

    verifySubscription()
  }, [sessionId])

  if (isVerifying) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
          <h1 className="text-xl font-semibold text-foreground">Setting up your account...</h1>
          <p className="text-muted-foreground">Please wait while we activate your subscription.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl text-destructive">!</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.push("/")}>Try Again</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-lg mx-auto flex items-center justify-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-semibold text-xl text-foreground">RevoAI</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto animate-in zoom-in duration-500">
            <Check className="w-12 h-12 text-green-500" />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-foreground">Welcome to RevoAI Pro!</h1>
            <p className="text-muted-foreground text-lg">
              Your 7-day free trial has started. You now have full access to all features.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Trial ends</span>
              <span className="font-medium text-foreground">
                {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <Button size="lg" className="w-full min-h-[52px] text-lg" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>

          <p className="text-xs text-muted-foreground">
            You can manage your subscription anytime from the dashboard settings.
          </p>
        </div>
      </main>
    </div>
  )
}
