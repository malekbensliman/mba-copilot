import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Chunked upload endpoint for large files.
 *
 * Vercel serverless functions have a ~4.5MB request body limit.
 * Each chunk is uploaded as an individual small blob via put() (no minimum
 * size requirement), avoiding the 5MB-per-part minimum of S3 multipart.
 *
 * Client flow:
 * 1. POST ?action=part      FormData(chunk, partNumber) → { url, partNumber }
 * 2. POST ?action=complete   { parts, filename }         → processing result
 *
 * The complete step sends part URLs to the Python backend which downloads,
 * concatenates, and processes them directly — no intermediate combined blob.
 */
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'part':
        return await handlePart(request);
      case 'complete':
        return await handleComplete(request);
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error(`[upload-chunk] Error (action=${action}):`, error);
    const message = error instanceof Error ? error.message : 'Chunk upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handlePart(request: NextRequest) {
  const formData = await request.formData();
  const chunk = formData.get('chunk') as Blob | null;
  const partNumber = parseInt(formData.get('partNumber') as string, 10);

  if (!chunk || isNaN(partNumber)) {
    return NextResponse.json({ error: 'Missing chunk or partNumber' }, { status: 400 });
  }

  const { put } = await import('@vercel/blob');
  const blob = await put(`chunk-part-${partNumber}-${Date.now()}`, chunk, {
    access: 'public',
    addRandomSuffix: true,
  });

  console.log(`[upload-chunk] Uploaded part ${partNumber} (${(chunk.size / 1024 / 1024).toFixed(2)} MB) → ${blob.url}`);

  return NextResponse.json({ url: blob.url, partNumber });
}

async function handleComplete(request: NextRequest) {
  const { parts, filename } = await request.json() as {
    parts: Array<{ url: string; partNumber: number }>;
    filename: string;
  };

  if (!parts?.length || !filename) {
    return NextResponse.json({ error: 'Missing parts or filename' }, { status: 400 });
  }

  // Sort parts by partNumber, extract URLs in order
  const sortedUrls = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => p.url);

  // Build the backend URL
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const backendUrl = host
    ? `${protocol}://${host}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

  const backendHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    backendHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  try {
    // Send part URLs to Python backend for download + processing
    console.log(`[upload-chunk] Sending ${sortedUrls.length} part URLs to backend for ${filename}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    const response = await fetch(`${backendUrl}/backend/upload-from-urls`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify({ urls: sortedUrls, filename }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend processing failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[upload-chunk] Processing complete:`, result);
    return NextResponse.json(result);
  } finally {
    // Clean up all part blobs (fire-and-forget)
    try {
      const { del } = await import('@vercel/blob');
      await Promise.all(sortedUrls.map((url) => del(url).catch(() => {})));
      console.log(`[upload-chunk] Cleaned up ${sortedUrls.length} part blobs`);
    } catch {
      console.warn('[upload-chunk] Failed to clean up some part blobs');
    }
  }
}
