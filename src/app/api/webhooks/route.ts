import { NextResponse, type NextRequest } from 'next/server';

/**
 * External callbacks (mobile-money confirmations, etc.).
 *
 * Route Handlers are excluded from the middleware matcher, so nothing here is
 * behind the session guard -- every handler must verify the caller itself.
 * Replace `verifySignature` with the scheme your provider actually uses and
 * reject anything that fails before touching the database.
 */

export const runtime = 'nodejs';

function verifySignature(_request: NextRequest, _rawBody: string): boolean {
  // TODO: HMAC the raw body with the provider's shared secret and compare in
  // constant time. Returning false keeps the endpoint closed until then.
  return false;
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!verifySignature(request, rawBody)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // const payload = JSON.parse(rawBody);
  // ... use a service-role client here; there is no user session to rely on.

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
