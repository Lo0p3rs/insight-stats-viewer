import type { NextRequest } from 'next/server';
import { getServerConfig } from '@/lib/server-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const { tbaApiBase, tbaApiKey, tbaProxyTimeoutMs } = getServerConfig();
  const timeout = createTimeoutSignal(tbaProxyTimeoutMs);
  const eventKey = encodeURIComponent(context.params.eventKey);
  const base = tbaApiBase.endsWith('/') ? tbaApiBase.slice(0, -1) : tbaApiBase;
  const targetUrl = `${base}/event/${eventKey}/matches`;

  try {
    const response = await fetch(targetUrl, {
      headers: {
        Accept: 'application/json',
        'X-TBA-Auth-Key': tbaApiKey,
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

    console.error('TBA proxy request failed', {
      targetUrl,
      timedOut,
      error,
    });

    return Response.json(
      {
        detail: timedOut
          ? 'The match service took too long to respond.'
          : 'Unable to reach the match service right now.',
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
