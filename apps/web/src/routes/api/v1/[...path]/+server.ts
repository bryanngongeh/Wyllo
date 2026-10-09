import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const apiOrigin = env.API_INTERNAL_URL ?? 'http://localhost:4174';
const forwardedHeaders = ['accept', 'authorization', 'content-type', 'if-none-match'];
const responseHeaders = ['cache-control', 'content-type', 'etag', 'retry-after'];

const proxy: RequestHandler = async ({ request, params, url }) => {
  const target = new URL(`/api/v1/${params.path}${url.search}`, apiOrigin);
  const headers = new Headers();
  for (const name of forwardedHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    body = await request.arrayBuffer();
    if (body.byteLength > 1_000_000) return new Response(JSON.stringify({ error: 'Request body too large.' }), { status: 413 });
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000)
    });
    const resultHeaders = new Headers();
    for (const name of responseHeaders) {
      const value = response.headers.get(name);
      if (value) resultHeaders.set(name, value);
    }
    return new Response(response.body, { status: response.status, headers: resultHeaders });
  } catch {
    return new Response(JSON.stringify({ error: 'The Wyllo API is temporarily unavailable.' }), {
      status: 503,
      headers: { 'content-type': 'application/json', 'retry-after': '5' }
    });
  }
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;