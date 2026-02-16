import { NextRequest, NextResponse } from 'next/server';
import { Client, Environment } from 'square';
import { cookies } from 'next/headers';

/**
 * POST /api/square/refund
 *
 * Initiates a refund through Square's Refund API.
 * Called by the admin UI before recording the refund on the backend.
 *
 * Body: {
 *   orderId: number,
 *   squarePaymentId: string,
 *   amountCents: number,
 *   reason?: string
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
    });
    if (!sessionCheck.ok) {
      return NextResponse.json(
        { error: 'Session expired or invalid' },
        { status: 401 },
      );
    }

    const { orderId, squarePaymentId, amountCents, reason } = await req.json();

    if (!orderId || !squarePaymentId || !amountCents) {
      return NextResponse.json(
        { error: 'orderId, squarePaymentId, and amountCents are required' },
        { status: 400 },
      );
    }

    if (!process.env.SQUARE_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: 'Square is not configured. Please contact an administrator.' },
        { status: 503 },
      );
    }

    const { result } = await squareClient.refundsApi.refundPayment({
      idempotencyKey: `refund-order-${orderId}-${Date.now()}`,
      paymentId: squarePaymentId,
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      reason: reason || `Refund for order #${orderId}`,
    });

    const refund = result.refund;
    return NextResponse.json({
      refundId: refund?.id,
      status: refund?.status,
      amountCents: refund?.amountMoney?.amount
        ? Number(refund.amountMoney.amount)
        : amountCents,
    });
  } catch (err: unknown) {
    console.error('Square refund error:', err);
    const message =
      err instanceof Error ? err.message : 'Failed to process refund';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
