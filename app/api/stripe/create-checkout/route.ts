import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { userId, email, priceId } = await request.json()

    if (!userId || !email || !priceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if user already has a Stripe customer ID
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .single()

    let customerId = existingSubscription?.stripe_customer_id

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          supabase_user_id: userId,
        },
      })
      customerId = customer.id
    }

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer")?.split("/").slice(0, 3).join("/") ||
      "http://localhost:3000"

    // Create checkout session with 7-day free trial
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          supabase_user_id: userId,
        },
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}?canceled=true`,
      metadata: {
        supabase_user_id: userId,
      },
      allow_promotion_codes: true,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Stripe checkout error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create checkout session" },
      { status: 500 },
    )
  }
}
