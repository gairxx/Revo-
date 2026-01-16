import { type NextRequest, NextResponse } from "next/server"
import { stripe } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

// Use service role for webhook to bypass RLS
const supabaseAdmin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 })
  }

  let event: import("stripe").Stripe.Event

  try {
    // For development, we'll skip signature verification if no webhook secret is set
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      event = JSON.parse(body) as import("stripe").Stripe.Event
    }
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as import("stripe").Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (!userId) {
          console.error("No user ID in subscription metadata")
          break
        }

        await supabaseAdmin.from("subscriptions").upsert(
          {
            user_id: userId,
            stripe_customer_id: subscription.customer as string,
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
        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as import("stripe").Stripe.Subscription
        const userId = subscription.metadata.supabase_user_id

        if (userId) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "canceled",
            })
            .eq("user_id", userId)
        }
        break
      }

      case "customer.subscription.trial_will_end": {
        // Could send reminder email here
        const subscription = event.data.object as import("stripe").Stripe.Subscription
        console.log(`Trial ending soon for subscription: ${subscription.id}`)
        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice
        if (invoice.subscription) {
          // Update subscription status after successful payment
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "active",
            })
            .eq("stripe_subscription_id", invoice.subscription as string)
        }
        break
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as import("stripe").Stripe.Invoice
        if (invoice.subscription) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "past_due",
            })
            .eq("stripe_subscription_id", invoice.subscription as string)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Webhook handler error:", error)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
