import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';

/**
 * POST /api/square/guest-donation-checkout
 *
 * Creates a Square Checkout payment link for a GUEST (unauthenticated) donation.
 * No session validation — anyone can donate without an account.
 *
 * Body: { donationId: number, amountCents: number, name: string, note?: string }
 */

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN || '',
  environment:
    process.env.SQUARE_ENVIRONMENT === 'production'
      ? Environment.Production
      : Environment.Sandbox,
});

export async function POST(req: NextRequest) {
  try {
    const { donationId, amountCents, name, note } = await req.json();

    if (!donationId || !amountCents || !name) {
      return NextResponse.json(
        { error: 'donationId, amountCents, and name are required' },
        { status: 400 },
      );
    }

    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
      return NextResponse.json(
        { error: 'Square is not configured. Please contact an administrator.' },
        { status: 503 },
      );
    }

    const referenceId = `donation:${donationId}`;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      req.nextUrl.origin;

    const redirectUrl = `${origin}/donate?status=paid&donationId=${donationId}`;

    const itemName = note
      ? `Donation from ${name} — ${note.substring(0, 50)}`
      : `Donation from ${name}`;

    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: `guest-donation-${donationId}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        referenceId,
        lineItems: [
          {
            name: itemName,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(amountCents),
              currency: 'USD',
            },
          },
        ],
      },
      checkoutOptions: {
        redirectUrl,
      },
      paymentNote: referenceId,
    });

    const checkoutUrl = result.paymentLink?.url;
    if (!checkoutUrl) {
      return NextResponse.json(
        { error: 'Failed to create checkout link' },
        { status: 502 },
      );
    }

    return NextResponse.json({ checkoutUrl });
  } catch (err: unknown) {
    console.error('Square guest donation checkout error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to create checkout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
