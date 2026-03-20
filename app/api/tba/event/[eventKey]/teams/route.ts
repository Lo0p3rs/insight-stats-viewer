import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TBA_API_BASE =
  process.env.TBA_API_BASE ??
  'https://www.thebluealliance.com/api/v3';

const TBA_API_KEY =
  process.env.TBA_API_KEY ??
  'R6A3yk0pc4VnGNoEWvdN2jIsGUhlOCVIKAgJ0uaUotH6Vbw2GaSKrdcMoW232UtP';

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

export async function GET(
  _request: NextRequest,
  context: { params: { eventKey: string } },
) {
  const timeout = createTimeoutSignal(20000);
  const eventKey = encodeURIComponent(context.params.eventKey);
  const base = TBA_API_BASE.endsWith('/') ? TBA_API_BASE.slice(0, -1) : TBA_API_BASE;
  const targetUrl = `${base}/event/${eventKey}/teams/simple`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
        'X-TBA-Auth-Key': TBA_API_KEY,
      },
      cache: 'no-store',
      signal: timeout.signal,
    });

    const responseHeaders = new Headers({
      'cache-control': 'no-store',
      'content-type': response.headers.get('content-type') ?? 'application/json',
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');

    console.error('TBA team proxy request failed', {
      targetUrl,
      timedOut,
      error,
    });

    return Response.json(
      {
        detail: timedOut
          ? 'The team service took too long to respond.'
          : 'Unable to reach the team service right now.',
      },
      {
        status: 503,
        headers: {
          'cache-control': 'no-store',
          'x-insight-error': timedOut ? 'timeout' : 'network',
        },
      },
    );
  } finally {
    timeout.clear();
  }
}
