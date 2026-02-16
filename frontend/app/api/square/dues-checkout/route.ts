import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';
import { cookies } from 'next/headers';

/**
 * POST /api/square/dues-checkout
 *
 * Creates a Square Checkout payment link for a dues batch.
 * The user is redirected to Square's hosted checkout page.
 * After payment, Square fires a webhook to the Spring Boot backend
 * which reconciles the PENDING → COMPLETED transition.
 *
 * Body: { batchId: string, personCount: number, reunionYear?: number }
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
    // ── Auth check: verify caller has a valid session ──
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('JSESSIONID');
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 },
      );
    }

    // Verify the session is actually valid by probing the backend
    const backendBase =
      process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || '';
    const sessionCheck = await fetch(`${backendBase}/api/auth/session-info`, {
      headers: { Cookie: `JSESSIONID=${sessionCookie.value}` },
    });
    if (!sessionCheck.ok) {
      return NextResponse.json(
        { error: 'Session expired or invalid' },
        { status: 401 },
      );
    }
    const { batchId, personCount, totalCents, reunionYear } = await req.json();

    if (!batchId || !personCount || !totalCents) {
      return NextResponse.json(
        { error: 'batchId, personCount, and totalCents are required' },
        { status: 400 },
      );
    }

    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
      return NextResponse.json(
        { error: 'Square is not configured. Please contact an administrator.' },
        { status: 503 },
      );
    }

    const year = reunionYear || new Date().getFullYear();
    const referenceId = `db:${batchId}`;

    // Derive redirect URL from the incoming request origin
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      req.nextUrl.origin;

    const redirectUrl = `${origin}/dues?status=paid&batch=${encodeURIComponent(batchId)}`;

    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: `dues-${batchId}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        referenceId,
        lineItems: [
          {
            name: `${year} Reunion Dues (${personCount} ${personCount === 1 ? 'person' : 'people'})`,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(totalCents), // Total from server-computed batch
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
    console.error('Square dues checkout error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to create checkout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
