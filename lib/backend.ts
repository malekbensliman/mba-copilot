import { createHash } from 'node:crypto';
import type { NextRequest } from 'next/server';

/**
 * Shared token the Next.js layer sends to the Python backend, derived from
 * AUTH_SECRET. The backend rejects any request without it, so the Python
 * endpoints can't be hit directly — only through the authenticated proxy.
 */
export function internalAuthToken(): string {
  return createHash('sha256')
    .update(process.env.AUTH_SECRET ?? '')
    .digest('hex');
}

/**
 * Base URL of the Python backend: localhost in dev, the deployment's own origin
 * in prod (where vercel.json routes /backend/* to the Python function).
 */
export function backendBase(request: NextRequest): string {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL;
  const host = request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
  return isLocal ? 'http://localhost:8000' : `${proto}://${host}`;
}
