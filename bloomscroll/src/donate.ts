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

  console.log(`[Donate] triggerDonation called — charityId="${charityId}" → "${charityName}"`);

  // ── Key check ────────────────────────────────────────────────────────────
  if (!STRIPE_SECRET_KEY) {
    console.error("[Donate] STRIPE_SECRET_KEY is missing/empty — VITE_STRIPE_SECRET_KEY env var not set");
    throw new Error("Stripe secret key is not configured (VITE_STRIPE_SECRET_KEY)");
  }
  console.log(
    `[Donate] Stripe key present — starts with "${STRIPE_SECRET_KEY.slice(0, 8)}…" ` +
    `(length ${STRIPE_SECRET_KEY.length})`
  );

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

  console.log("[Donate] POST https://api.stripe.com/v1/payment_intents — body:", body.toString());

  let res: Response;
  try {
    res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
  } catch (fetchErr) {
    console.error("[Donate] fetch() threw (network error / CORS?):", fetchErr);
    throw fetchErr;
  }

  console.log(`[Donate] Response status: ${res.status} ${res.statusText}`);

  let data: Record<string, unknown>;
  try {
    data = await res.json();
  } catch (jsonErr) {
    console.error("[Donate] Failed to parse JSON response:", jsonErr);
    throw new Error("Stripe returned non-JSON response");
  }

  console.log("[Donate] Response body:", data);

  if (!res.ok) {
    const msg = (data?.error as Record<string, unknown>)?.message ?? "Stripe request failed";
    console.error(`[Donate] Stripe error (${res.status}):`, data?.error ?? data);
    throw new Error(String(msg));
  }

  const paymentStatus = String(data.status ?? "");
  const succeeded     = paymentStatus === "succeeded" || paymentStatus === "requires_capture";

  console.log(
    `[Donate] PaymentIntent ${data.id} — status="${paymentStatus}" succeeded=${succeeded}`
  );

  if (!succeeded) {
    console.warn(
      "[Donate] Payment NOT marked as succeeded — status was:", paymentStatus,
      "Full data:", data
    );
  }

  return {
    success: succeeded,
    paymentIntentId: String(data.id ?? ""),
    amount: Number(data.amount ?? 0),
    status: paymentStatus,
    message: `$0.50 donated to ${charityName}`,
    charity: charityName,
  };
}
