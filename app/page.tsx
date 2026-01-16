"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Wrench, Car, MessageSquare, Shield, Check, ChevronRight, Sparkles, Zap, ArrowLeft } from "lucide-react"

type OnboardingStep = "welcome" | "signin" | "signup" | "plan" | "complete"

export default function HomePage() {
  const [step, setStep] = useState<OnboardingStep>("welcome")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          try {
            const { data: subscription } = await supabase
              .from("subscriptions")
              .select("*")
              .eq("user_id", user.id)
              .single()

            if (subscription && (subscription.status === "active" || subscription.status === "trialing")) {
              router.push("/dashboard")
              return
            }
          } catch {
            // Table may not exist or no subscription found - continue to plan step
          }
          setStep("plan")
        }
      } catch (err) {
        console.error("Auth check error:", err)
      } finally {
        setIsCheckingAuth(false)
      }
    }
    checkAuth()
  }, [router])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error

      try {
        const { data: subscription } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", data.user.id)
          .single()

        if (subscription && (subscription.status === "active" || subscription.status === "trialing")) {
          router.push("/dashboard")
          return
        }
      } catch {
        // No subscription found - continue to plan step
      }
      setStep("plan")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Invalid email or password")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || window.location.origin,
          data: {
            full_name: name,
          },
        },
      })
      if (error) throw error

      if (data.user) {
        setStep("plan")
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartFree = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Please sign in first")
        setStep("signin")
        setIsLoading(false)
        return
      }

      // Create free tier subscription directly in database
      const { error: insertError } = await supabase.from("subscriptions").upsert({
        user_id: user.id,
        status: "active",
        plan_type: "free",
        vehicle_limit: 1,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 100 years
      })

      if (insertError) throw insertError

      router.push("/dashboard")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const handleStartTrial = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Please sign in first")
        setStep("signin")
        setIsLoading(false)
        return
      }

      // Create Stripe checkout session via API
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          priceId: "price_1SjZ0FDRXfOazALvTsC8mJ4N",
        }),
      })

      const data = await response.json()

      if (data.error) throw new Error(data.error)

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setEmail("")
    setPassword("")
    setName("")
    setError(null)
  }

  if (isCheckingAuth) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
        <div className="animate-pulse flex items-center gap-2">
          <Wrench className="w-6 h-6 text-primary animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh flex flex-col bg-background">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-muted z-50">
        <div
          className="h-full bg-primary transition-all duration-500 ease-out"
          style={{
            width:
              step === "welcome"
                ? "20%"
                : step === "signin" || step === "signup"
                  ? "50%"
                  : step === "plan"
                    ? "75%"
                    : "100%",
          }}
        />
      </div>

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
        <div className="w-full max-w-lg">
          {/* Welcome Step */}
          {step === "welcome" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="w-10 h-10 text-primary" />
                </div>
                <h1 className="text-3xl font-bold text-foreground text-balance">Your AI Master Technician</h1>
                <p className="text-muted-foreground text-lg text-pretty">
                  Professional automotive diagnostics powered by AI. Get real-time repair guidance for any vehicle.
                </p>
              </div>

              <div className="grid gap-4">
                <FeatureItem
                  icon={<Car className="w-5 h-5" />}
                  title="Vehicle Garage"
                  description="Save vehicles with complete service history"
                />
                <FeatureItem
                  icon={<MessageSquare className="w-5 h-5" />}
                  title="AI Diagnostics"
                  description="Real-time voice and text diagnostic assistance"
                />
                <FeatureItem
                  icon={<Shield className="w-5 h-5" />}
                  title="TSBs & Recalls"
                  description="Instant access to technical bulletins and recalls"
                />
              </div>

              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full min-h-[52px] text-lg"
                  onClick={() => {
                    resetForm()
                    setStep("signup")
                  }}
                >
                  Get Started Free
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full min-h-[52px] bg-transparent"
                  onClick={() => {
                    resetForm()
                    setStep("signin")
                  }}
                >
                  Sign In
                </Button>
              </div>

              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span>Free tier available</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>Pro trial included</span>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Step */}
          {step === "signin" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <button
                onClick={() => setStep("welcome")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
                <p className="text-muted-foreground">Sign in to access your diagnostic assistant</p>
              </div>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="min-h-[44px] bg-input border-border"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password" className="text-foreground">
                        Password
                      </Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="min-h-[44px] bg-input border-border"
                        required
                      />
                    </div>

                    {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}

                    <Button type="submit" size="lg" className="w-full min-h-[52px]" disabled={isLoading}>
                      {isLoading ? "Signing in..." : "Sign In"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                {"Don't have an account? "}
                <button
                  onClick={() => {
                    resetForm()
                    setStep("signup")
                  }}
                  className="text-primary hover:underline"
                >
                  Get started free
                </button>
              </p>
            </div>
          )}

          {/* Sign Up Step */}
          {step === "signup" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <button
                onClick={() => setStep("welcome")}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
                <p className="text-muted-foreground">Get started with AI-powered diagnostics</p>
              </div>

              <Card className="border-border bg-card">
                <CardContent className="pt-6">
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="name" className="text-foreground">
                        Full Name
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="John Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="min-h-[44px] bg-input border-border"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="signup-email" className="text-foreground">
                        Email
                      </Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="min-h-[44px] bg-input border-border"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="signup-password" className="text-foreground">
                        Password
                      </Label>
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="min-h-[44px] bg-input border-border"
                        required
                      />
                    </div>

                    {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}

                    <Button type="submit" size="lg" className="w-full min-h-[52px]" disabled={isLoading}>
                      {isLoading ? "Creating account..." : "Continue"}
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    resetForm()
                    setStep("signin")
                  }}
                  className="text-primary hover:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}

          {step === "plan" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold text-foreground">Choose Your Plan</h1>
                <p className="text-muted-foreground">Start free or unlock all features with Pro</p>
              </div>

              {/* Free Plan */}
              <Card className="border-border bg-card">
                <CardContent className="pt-6 pb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">Free</h3>
                      <p className="text-sm text-muted-foreground">Perfect to get started</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-foreground">$0</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <PlanFeature text="1 vehicle in garage" />
                    <PlanFeature text="AI diagnostic conversations" />
                    <PlanFeature text="Text-based assistant" />
                    <PlanFeature text="Basic TSB search" muted />
                  </div>

                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full min-h-[48px] bg-transparent"
                    onClick={handleStartFree}
                    disabled={isLoading}
                  >
                    {isLoading ? "Setting up..." : "Start Free"}
                  </Button>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-primary border-2 bg-card relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-bl-lg">
                  7 DAY FREE TRIAL
                </div>
                <CardContent className="pt-8 pb-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        <h3 className="text-xl font-bold text-foreground">Pro</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">For professional technicians</p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-bold text-foreground">$29.99</span>
                      <span className="text-muted-foreground">/mo</span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <PlanFeature text="Unlimited vehicles" highlight />
                    <PlanFeature text="AI diagnostic conversations" />
                    <PlanFeature text="Voice & text assistant" highlight />
                    <PlanFeature text="Full TSB & recall database" highlight />
                    <PlanFeature text="Wiring diagrams & repair guides" highlight />
                    <PlanFeature text="OBD-II live data (Bluetooth)" highlight />
                    <PlanFeature text="Priority support" />
                  </div>

                  {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg mb-4">{error}</p>}

                  <Button size="lg" className="w-full min-h-[48px]" onClick={handleStartTrial} disabled={isLoading}>
                    {isLoading ? "Setting up..." : "Start 7-Day Free Trial"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground mt-3">
                    No charge today. Cancel anytime during trial.
                  </p>
                </CardContent>
              </Card>

              <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  <span>Secure payment</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === "complete" && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500 text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-10 h-10 text-green-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">You&apos;re All Set!</h1>
                <p className="text-muted-foreground">Your account is ready. Let&apos;s start diagnosing.</p>
              </div>
              <Button size="lg" className="w-full min-h-[52px] text-lg" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </footer>
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl bg-muted/50">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function PlanFeature({ text, highlight, muted }: { text: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Check
        className={`w-4 h-4 flex-shrink-0 ${highlight ? "text-primary" : muted ? "text-muted-foreground/50" : "text-primary"}`}
      />
      <span className={`text-sm ${muted ? "text-muted-foreground/70" : "text-foreground"}`}>{text}</span>
    </div>
  )
}
