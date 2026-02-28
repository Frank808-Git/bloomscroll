const STRIPE_SECRET_KEY = import.meta.env.VITE_STRIPE_SECRET_KEY as string;

export interface DonationResult {
  success: boolean;
  paymentIntentId: string;
  amount: number;
  status: string;
  message: string;
  charity: string;
}

export const CHARITY_NAMES: Record<string, string> = {
  wwf: "World Wildlife Fund",
  dwb: "Doctors Without Borders",
  fa: "Feeding America",
  rc: "American Red Cross",
};

export async function triggerDonation(charityId: string): Promise<DonationResult> {
  const charityName = CHARITY_NAMES[charityId] ?? "American Red Cross";

  const body = new URLSearchParams({
    amount: "50",
    currency: "usd",
    payment_method: "pm_card_visa",
    confirm: "true",
    description: `Doomscrolling detected — $0.50 donated to ${charityName}`,
    "metadata[cause]": charityName,
    "metadata[trigger]": "doomscrolling_detected",
    return_url: "https://bloomscroll.app",
  });

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Stripe request failed");
  }

  console.log(`[Donate] PaymentIntent ${data.id} — status: ${data.status}`);

  return {
    success: data.status === "succeeded" || data.status === "requires_capture",
    paymentIntentId: data.id,
    amount: data.amount,
    status: data.status,
    message: `$0.50 donated to ${charityName}`,
    charity: charityName,
  };
}
