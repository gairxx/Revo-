import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 })
    }

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    })

    if (session.payment_status !== "paid" && session.status !== "complete") {
      // For trials, the payment_status might be 'no_payment_required'
      if (session.payment_status !== "no_payment_required") {
        return NextResponse.json({ error: "Payment not completed" }, { status: 400 })
      }
    }

    const userId = session.metadata?.supabase_user_id
    if (!userId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 })
    }

    const subscription = session.subscription as import("stripe").Stripe.Subscription
    const customer = session.customer as import("stripe").Stripe.Customer

    const supabase = await createClient()

    // Upsert subscription record
    const { error: dbError } = await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        stripe_price_id: subscription.items.data[0]?.price.id,
        status: subscription.status,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      {
        onConflict: "user_id",
      },
    )

    if (dbError) {
      console.error("Database error:", dbError)
      return NextResponse.json({ error: "Failed to save subscription" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Session verification error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify session" },
      { status: 500 },
    )
  }
}
