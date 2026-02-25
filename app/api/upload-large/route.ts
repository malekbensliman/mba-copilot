import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * Server-side upload proxy for large files.
 *
 * Supports two modes:
 *
 * 1. JSON body: { url, filename }
 *    Client uploads directly to Vercel Blob (bypassing 4.5MB serverless body limit),
 *    then sends the blob URL here for processing. The blob is deleted after processing.
 *
 * 2. FormData body: file + filename (legacy, works only for files < 4.5MB on Vercel)
 *    Uploads to Vercel Blob server-side, processes, and cleans up.
 *
 * Flow for JSON mode:
 * 1. Client uploads to Vercel Blob via @vercel/blob/client upload()
 * 2. Client sends { url, filename } here
 * 3. Server calls backend /upload-from-url with the blob URL
 * 4. Server deletes the temporary blob
 * 5. Returns the processing result to client
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Determine the backend URL for processing
    const host = request.headers.get('host');
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const backendUrl = host
      ? `${protocol}://${host}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

    // Headers for backend requests (handle deployment protection)
    const backendHeaders: Record<string, string> = {};
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
      backendHeaders['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    }

    // JSON mode: process from an existing blob URL
    if (contentType.includes('application/json')) {
      const { url, filename } = await request.json();

      if (!url || !filename) {
        return NextResponse.json({ error: 'Missing url or filename' }, { status: 400 });
      }

      console.log(`[upload-large] Processing from blob URL: ${filename}`);

      return await processFromUrl(url, filename, backendUrl, backendHeaders);
    }

    // FormData mode: receive file, upload to blob, then process
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const filename = (formData.get('filename') as string) || file?.name;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!filename) {
      return NextResponse.json({ error: 'No filename provided' }, { status: 400 });
    }

    console.log(`[upload-large] Received file: ${filename} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Try server-side blob upload first
    let blobUrl: string | null = null;
    try {
      const { put } = await import('@vercel/blob');
      const blob = await put(filename, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      blobUrl = blob.url;
      console.log(`[upload-large] Uploaded to blob: ${blobUrl}`);
    } catch (blobError) {
      console.log('[upload-large] Blob upload not available, falling back to direct upload:', blobError);
    }

    if (blobUrl) {
      return await processFromUrl(blobUrl, filename, backendUrl, backendHeaders);
    }

    // Fallback: forward the file directly to the backend
    console.log('[upload-large] Using direct upload fallback');
    const directFormData = new FormData();
    directFormData.append('file', file, filename);
    directFormData.append('filename', filename);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    const response = await fetch(`${backendUrl}/backend/upload`, {
      method: 'POST',
      headers: backendHeaders,
      body: directFormData,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Upload failed: ${response.status}`);
    }

    const result = await response.json();
    console.log(`[upload-large] Direct upload complete:`, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[upload-large] Error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Process a file from a blob URL: call backend, then clean up the blob.
 */
async function processFromUrl(
  blobUrl: string,
  filename: string,
  backendUrl: string,
  backendHeaders: Record<string, string>,
): Promise<NextResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000); // 4 minute timeout

    const response = await fetch(`${backendUrl}/backend/upload-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...backendHeaders,
      },
      body: JSON.stringify({ url: blobUrl, filename }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend processing failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`[upload-large] Processing complete:`, result);

    // Clean up blob
    try {
      const { del } = await import('@vercel/blob');
      await del(blobUrl);
      console.log(`[upload-large] Deleted temporary blob: ${blobUrl}`);
    } catch {
      console.warn(`[upload-large] Failed to delete blob: ${blobUrl}`);
    }

    return NextResponse.json(result);
  } catch (processError) {
    // Clean up blob on error
    try {
      const { del } = await import('@vercel/blob');
      await del(blobUrl);
    } catch {
      // Ignore cleanup errors
    }
    throw processError;
  }
}
