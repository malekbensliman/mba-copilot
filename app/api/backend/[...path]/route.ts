import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { backendBase, internalAuthToken } from '@/lib/backend';

export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Authenticated proxy to the Python backend.
 *
 * Every backend call from the browser goes through here: we verify the NextAuth
 * session, then forward to the Python function with the shared internal-auth
 * header. Direct hits to /backend/* (which lack the header) are rejected by the
 * backend with a 401, so this is the only authorized path in.
 */
async function forward(
  request: NextRequest,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: BodyInit | null
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const search = method === 'GET' ? new URL(request.url).search : '';
  const target = `${backendBase(request)}/backend/${path}${search}`;

  try {
    const response = await fetch(target, {
      method,
      headers: {
        'Content-Type': request.headers.get('Content-Type') || 'application/json',
        'X-Internal-Auth': internalAuthToken(),
      },
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error(`[api/backend] ${method} ${path} failed:`, error);
    return NextResponse.json({ error: 'Backend request failed' }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  return forward(request, path.join('/'), 'GET');
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  const body = await request.arrayBuffer();
  return forward(request, path.join('/'), 'POST', body);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  const { path } = await context.params;
  return forward(request, path.join('/'), 'DELETE');
}
