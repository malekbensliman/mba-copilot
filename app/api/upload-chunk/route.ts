import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { backendBase, internalAuthToken } from '@/lib/backend';

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
 * 2. POST ?action=extract    { parts, filename }         → parsed chunks
 *
 * The extract step sends part URLs to the Python backend which downloads,
 * concatenates, and parses them into chunks (no embedding) — no intermediate
 * combined blob. The browser then embeds those chunks in batches via
 * /api/backend/embed-batch, keeping each request under the serverless limit.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'part':
        return await handlePart(request);
      case 'extract':
        return await handleExtract(request);
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

async function handleExtract(request: NextRequest) {
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

  const backendUrl = backendBase(request);

  const backendHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-Auth': internalAuthToken(),
  };
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    backendHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  try {
    // Send part URLs to Python backend to download + parse into chunks
    console.log(`[upload-chunk] Sending ${sortedUrls.length} part URLs to backend for ${filename}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    const response = await fetch(`${backendUrl}/backend/extract-from-urls`, {
      method: 'POST',
      headers: backendHeaders,
      body: JSON.stringify({ urls: sortedUrls, filename }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend extraction failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[upload-chunk] Extracted ${result.total_chunks ?? '?'} chunks for ${filename}`);
    return NextResponse.json(result);
  } finally {
    // Clean up all part blobs (fire-and-forget)
    try {
      const { del } = await import('@vercel/blob');
      await Promise.all(
        sortedUrls.map((url) =>
          del(url).catch((err) =>
            console.error(`[upload-chunk] Failed to delete part blob ${url}:`, err)
          )
        )
      );
      console.log(`[upload-chunk] Cleaned up ${sortedUrls.length} part blobs`);
    } catch {
      console.warn('[upload-chunk] Failed to clean up some part blobs');
    }
  }
}
