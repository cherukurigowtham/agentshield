import { loadStripe } from '@stripe/stripe-js';

let stripePromise: Promise<ReturnType<typeof loadStripe> | null> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
  }
  return stripePromise;
};

export const redirectToCheckout = async (plan: 'pro' | 'enterprise', userId?: string, email?: string) => {
  const stripe = await getStripe();
  
  if (!stripe) {
    console.error('Stripe failed to load');
    return;
  }

  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan, userId, email }),
  });

  const { url, error } = await response.json();

  if (error) {
    console.error('Checkout error:', error);
    return;
  }

  if (url) {
    window.location.href = url;
  }
};