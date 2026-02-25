import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Chunked upload endpoint for large files.
 *
 * Vercel serverless functions have a ~4.5MB request body limit, and
 * S3 multipart uploads require >=5MB parts. These are incompatible,
 * so we use individual blob uploads per chunk and combine server-side.
 *
 * Client flow:
 * 1. POST ?action=part     FormData(chunk, filename, partNumber)  → { url, partNumber }  (repeat per chunk)
 * 2. POST ?action=complete  JSON { filename, parts: [{ url, partNumber }] }  → { url }
 * 3. POST /api/upload-large  JSON { url, filename }  → processing result
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
  const filename = formData.get('filename') as string;
  const partNumber = parseInt(formData.get('partNumber') as string, 10);

  if (!chunk || !filename || isNaN(partNumber)) {
    return NextResponse.json({ error: 'Missing chunk, filename, or partNumber' }, { status: 400 });
  }

  // Upload this chunk as an individual blob
  const { put } = await import('@vercel/blob');
  const blob = await put(`_chunks/${filename}/part-${String(partNumber).padStart(5, '0')}`, chunk, {
    access: 'public',
    addRandomSuffix: true,
  });

  console.log(`[upload-chunk] Uploaded part ${partNumber} (${(chunk.size / 1024 / 1024).toFixed(2)} MB) → ${blob.url}`);

  return NextResponse.json({
    url: blob.url,
    partNumber,
  });
}

async function handleComplete(request: NextRequest) {
  const { filename, parts } = await request.json() as {
    filename: string;
    parts: Array<{ url: string; partNumber: number }>;
  };

  if (!filename || !parts?.length) {
    return NextResponse.json({ error: 'Missing filename or parts' }, { status: 400 });
  }

  // Sort parts by partNumber to ensure correct order
  const sortedParts = [...parts].sort((a, b) => a.partNumber - b.partNumber);

  console.log(`[upload-chunk] Combining ${sortedParts.length} parts for ${filename}...`);

  // Download all parts in parallel and combine
  const partBuffers = await Promise.all(
    sortedParts.map(async (part) => {
      const res = await fetch(part.url);
      if (!res.ok) throw new Error(`Failed to download part ${part.partNumber}`);
      return res.arrayBuffer();
    })
  );

  // Concatenate all parts into a single buffer
  const totalSize = partBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const buf of partBuffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  console.log(`[upload-chunk] Combined ${sortedParts.length} parts into ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

  // Upload the combined file as a single blob
  const { put, del } = await import('@vercel/blob');
  const finalBlob = await put(filename, Buffer.from(combined.buffer), {
    access: 'public',
    addRandomSuffix: true,
  });

  console.log(`[upload-chunk] Final blob: ${finalBlob.url}`);

  // Clean up part blobs (best-effort, don't fail if cleanup errors)
  try {
    await del(sortedParts.map((p) => p.url));
    console.log(`[upload-chunk] Deleted ${sortedParts.length} part blobs`);
  } catch (cleanupError) {
    console.warn(`[upload-chunk] Failed to clean up part blobs:`, cleanupError);
  }

  return NextResponse.json({ url: finalBlob.url });
}
