import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_build', {
  apiVersion: '2026-08-26.dahlia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;
        
        console.log(`✅ Subscription created for user ${userId} on ${plan} plan`);
        // TODO: Grant access in your database
        // await db.user.update({ where: { id: userId }, data: { plan, stripeCustomerId: session.customer } });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        const plan = subscription.metadata?.plan;
        const status = subscription.status;
        
        console.log(`🔄 Subscription ${status} for user ${userId} on ${plan} plan`);
        // TODO: Update user plan status in database
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        console.log(`❌ Subscription cancelled for user ${userId}`);
        // TODO: Downgrade user to free tier
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // subscription_id may be on the invoice or we can get it from the customer's subscriptions
        const subscriptionId = (invoice as any).subscription || (invoice as any).subscription_id;
        const userId = subscriptionId 
          ? (await stripe.subscriptions.retrieve(subscriptionId)).metadata?.userId
          : undefined;
        
        console.log(`⚠️ Payment failed for user ${userId}`);
        // TODO: Notify user, retry logic
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook handler error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}