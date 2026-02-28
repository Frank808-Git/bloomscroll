// Frontend-only Stripe simulation.
// In a production app, this would call a backend API endpoint that uses
// the Stripe secret key to create a PaymentIntent server-side.
// Since bloomscroll is a frontend-only Chrome extension, we simulate the
// Stripe payment flow and response format locally.

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

let sequence = 1;

export async function triggerDonation(charityId: string): Promise<DonationResult> {
  // Simulate Stripe API network latency (600–1000 ms)
  await new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 400));

  const charityName = CHARITY_NAMES[charityId] ?? "American Red Cross";
  const fakeIntentId = `pi_sim_${Date.now()}_${sequence++}`;

  console.log(
    `[Donate] Simulated PaymentIntent ${fakeIntentId} — status: succeeded — charity: ${charityName}`
  );

  return {
    success: true,
    paymentIntentId: fakeIntentId,
    amount: 50, // 50 cents, matching the original Stripe amount
    status: "succeeded",
    message: `$0.50 donated to ${charityName}`,
    charity: charityName,
  };
}
