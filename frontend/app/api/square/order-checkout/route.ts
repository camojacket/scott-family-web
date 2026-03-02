import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';
import { cookies } from 'next/headers';

/**
 * POST /api/square/order-checkout
 *
 * Creates a Square Checkout payment link for a store order.
 * The user is redirected to Square's hosted checkout page.
 * After payment, Square fires a webhook to the Spring Boot backend
 * which reconciles the PENDING → PAID transition.
 *
 * Body: {
 *   orderId: number,
 *   items: Array<{ name: string, quantity: number, unitPriceCents: number }>
 * }
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

    const backendBase =
      process.env.NEXT_PUBLIC_API_BASE?.replace(/\/+$/, '') || '';
    const sessionCheck = await fetch(`${backendBase}/api/auth/session-info`, {
      headers: { Cookie: `JSESSIONID=${sessionCookie.value}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!sessionCheck.ok) {
      return NextResponse.json(
        { error: 'Session expired or invalid' },
        { status: 401 },
      );
    }
    const { orderId, items } = await req.json();

    if (!orderId || !items?.length) {
      return NextResponse.json(
        { error: 'orderId and items are required' },
        { status: 400 },
      );
    }

    if (!process.env.SQUARE_ACCESS_TOKEN || !process.env.SQUARE_LOCATION_ID) {
      return NextResponse.json(
        { error: 'Square is not configured. Please contact an administrator.' },
        { status: 503 },
      );
    }

    const referenceId = `order:${orderId}`;

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      req.headers.get('origin') ||
      req.nextUrl.origin;

    const redirectUrl = `${origin}/store/cart?status=paid&order=${orderId}`;

    const lineItems = items.map(
      (item: { name: string; quantity: number; unitPriceCents: number }) => ({
        name: item.name,
        quantity: String(item.quantity),
        basePriceMoney: {
          amount: BigInt(item.unitPriceCents),
          currency: 'USD',
        },
      }),
    );

    const { result } = await squareClient.checkoutApi.createPaymentLink({
      idempotencyKey: `order-${orderId}`,
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        referenceId,
        lineItems,
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
    console.error('Square order checkout error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to create checkout';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
