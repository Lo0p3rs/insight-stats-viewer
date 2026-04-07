import type { NextRequest } from 'next/server';
import { getServerConfig } from '@/lib/server-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORWARDED_REQUEST_HEADERS = [
  'accept',
  'authorization',
  'content-type',
  'x-fms-version',
];

const FORWARDED_RESPONSE_HEADERS = ['content-type', 'www-authenticate'];

function buildTargetUrl(pathSegments: string[], search: string) {
  const { insightApiBase } = getServerConfig();
  const base = insightApiBase.endsWith('/')
    ? insightApiBase.slice(0, -1)
    : insightApiBase;
  const path = pathSegments.join('/');
  const targetUrl = new URL(`${base}/${path}`);
  targetUrl.search = search;
  return targetUrl;
}

function createTimeoutSignal(timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId),
  };
}

async function proxyRequest(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  const targetUrl = buildTargetUrl(context.params.path, request.nextUrl.search);
  const headers = new Headers();
  const { insightProxyTimeoutMs } = getServerConfig();

  FORWARDED_REQUEST_HEADERS.forEach((headerName) => {
    const value = request.headers.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  });

  const timeout = createTimeoutSignal(insightProxyTimeoutMs);
  const init: RequestInit = {
    method: request.method,
    headers,
    cache: 'no-store',
    signal: timeout.signal,
  };

  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text();
  }

  try {
    const response = await fetch(targetUrl, init);
    const responseHeaders = new Headers({
      'cache-control': 'no-store',
    });

    FORWARDED_RESPONSE_HEADERS.forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value) {
        responseHeaders.set(headerName, value);
      }
    });

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');

    console.error('Insight proxy request failed', {
      targetUrl: targetUrl.toString(),
      timedOut,
      error,
    });

    return Response.json(
      {
        detail: timedOut
          ? 'The event service took too long to respond.'
          : 'Unable to reach the event service right now.',
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

export async function GET(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return proxyRequest(request, context);
}

export async function POST(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return proxyRequest(request, context);
}

export async function PATCH(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return proxyRequest(request, context);
}

export async function PUT(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return proxyRequest(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { path: string[] } },
) {
  return proxyRequest(request, context);
}
