import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Chunked upload endpoint for large files.
 *
 * Vercel serverless functions have a ~4.5MB request body limit.
 * This endpoint uses @vercel/blob's multipart upload API to accept
 * files in chunks, each small enough to fit within the body limit.
 *
 * Client flow:
 * 1. POST ?action=create   { filename }           → { uploadId, key }
 * 2. POST ?action=part     FormData(chunk) + meta  → { etag, partNumber }  (repeat per chunk)
 * 3. POST ?action=complete { uploadId, key, parts } → { url }
 * 4. POST /api/upload-large { url, filename }       → processing result
 */
export async function POST(request: NextRequest) {
  const action = request.nextUrl.searchParams.get('action');

  try {
    switch (action) {
      case 'create':
        return await handleCreate(request);
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

async function handleCreate(request: NextRequest) {
  const { filename } = await request.json();

  if (!filename) {
    return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
  }

  const { createMultipartUpload } = await import('@vercel/blob');
  const multipart = await createMultipartUpload(filename, {
    access: 'public',
  });

  console.log(`[upload-chunk] Created multipart upload: key=${multipart.key}, uploadId=${multipart.uploadId}`);

  return NextResponse.json({
    uploadId: multipart.uploadId,
    key: multipart.key,
  });
}

async function handlePart(request: NextRequest) {
  const formData = await request.formData();
  const chunk = formData.get('chunk') as Blob | null;
  const uploadId = formData.get('uploadId') as string;
  const key = formData.get('key') as string;
  const partNumber = parseInt(formData.get('partNumber') as string, 10);

  if (!chunk || !uploadId || !key || isNaN(partNumber)) {
    return NextResponse.json({ error: 'Missing chunk, uploadId, key, or partNumber' }, { status: 400 });
  }

  const { uploadPart } = await import('@vercel/blob');
  const part = await uploadPart(key, chunk, {
    access: 'public',
    uploadId,
    key,
    partNumber,
  });

  console.log(`[upload-chunk] Uploaded part ${partNumber} (${(chunk.size / 1024 / 1024).toFixed(2)} MB)`);

  return NextResponse.json({
    etag: part.etag,
    partNumber: part.partNumber,
  });
}

async function handleComplete(request: NextRequest) {
  const { uploadId, key, parts } = await request.json();

  if (!uploadId || !key || !parts?.length) {
    return NextResponse.json({ error: 'Missing uploadId, key, or parts' }, { status: 400 });
  }

  const { completeMultipartUpload } = await import('@vercel/blob');
  const blob = await completeMultipartUpload(key, parts, {
    access: 'public',
    uploadId,
    key,
  });

  console.log(`[upload-chunk] Multipart upload complete: ${blob.url}`);

  return NextResponse.json({ url: blob.url });
}
