"use client"

import type React from "react"
import { useState } from "react"
import { Beaker, Clock, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SubscriptionModalProps {
  onSubscribe: () => void
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onSubscribe }) => {
  const [loading, setLoading] = useState(false)
  const [selectedTier, setSelectedTier] = useState<"diy" | "pro">("diy")

  const handleSubscribe = () => {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSubscribe()
    }, 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md p-4 overflow-y-auto">
      <div className="max-w-4xl w-full bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
        {/* Sales Pitch Side */}
        <div className="p-6 md:p-8 md:w-1/2 bg-gradient-to-br from-primary/20 to-background flex flex-col justify-between relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary/50" />

          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
              REVO <span className="text-primary">PRO</span>
            </h1>
            <p className="text-primary font-mono text-sm mb-8 uppercase tracking-widest">Master Technician AI</p>

            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary">
                  <Beaker className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Stop Guessing Parts.</h3>
                  <p className="text-muted-foreground text-sm">
                    {
                      "Don't fire the parts cannon. Revo analyzes symptoms against millions of TSBs and factory repair procedures to pinpoint the actual fault."
                    }
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-primary">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Save Shop Labor.</h3>
                  <p className="text-muted-foreground text-sm">
                    {
                      "At $150/hr, a mechanic's diagnosis is expensive. Revo gives you the diagnostic logic instantly, 24/7."
                    }
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 text-green-500">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">OEM Precision.</h3>
                  <p className="text-muted-foreground text-sm">
                    Torque specs. Fluid capacities. Bolt sizes. Wiring pinouts. No more searching obscure forums.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground italic">
              {
                '"I designed Revo to replace the shelf of dusty shop manuals. Access to this level of data usually costs shops $200+ a month." — Developer\'s Note'
              }
            </p>
          </div>
        </div>

        {/* Pricing Side */}
        <div className="p-6 md:p-8 md:w-1/2 bg-card flex flex-col">
          <h2 className="text-2xl font-bold text-center text-foreground mb-6">Select Your Tier</h2>

          <div className="flex-1 space-y-4">
            {/* DIY Tier */}
            <button
              type="button"
              onClick={() => setSelectedTier("diy")}
              className={`relative w-full p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                selectedTier === "diy"
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border bg-secondary/50 hover:border-muted-foreground"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-foreground">Weekend Wrench</h3>
                <span className="text-xl font-bold text-primary">
                  $14.99<span className="text-sm text-muted-foreground font-normal">/mo</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">Perfect for the home mechanic maintaining 1-3 vehicles.</p>
              {selectedTier === "diy" && (
                <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  POPULAR
                </div>
              )}
            </button>

            {/* Pro Tier */}
            <button
              type="button"
              onClick={() => setSelectedTier("pro")}
              className={`relative w-full p-4 rounded-xl border-2 cursor-pointer transition-all text-left ${
                selectedTier === "pro"
                  ? "border-primary bg-primary/10 shadow-lg"
                  : "border-border bg-secondary/50 hover:border-muted-foreground"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-foreground">Shop Professional</h3>
                <span className="text-xl font-bold text-primary">
                  $49.99<span className="text-sm text-muted-foreground font-normal">/mo</span>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Unlimited VINs. Deep-dive schematics. Priority processing speed.
              </p>
            </button>

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between text-sm text-foreground">
                <span>Due Today (7-Day Trial)</span>
                <span className="font-mono font-bold">$0.00</span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>First charge on {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
                <span className="font-mono">{selectedTier === "diy" ? "$14.99" : "$49.99"}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full min-h-[48px] text-base font-bold"
              size="lg"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Secure Key...
                </span>
              ) : (
                "Start Free 7-Day Trial"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4">
              Secure 256-bit SSL Encrypted. Cancel anytime in app settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SubscriptionModal
