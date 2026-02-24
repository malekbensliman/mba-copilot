import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

/**
 * Server-side upload proxy for large files.
 *
 * This avoids the CORS issues with client-side @vercel/blob uploads
 * by handling the blob upload server-side where CORS doesn't apply.
 *
 * Flow:
 * 1. Client sends file as FormData
 * 2. Server uploads to Vercel Blob using put() (no CORS)
 * 3. Server calls backend /upload-from-url with the blob URL
 * 4. Server deletes the temporary blob
 * 5. Returns the processing result to client
 *
 * Fallback: If Vercel Blob is not configured, forwards the file
 * directly to the backend (works if platform body limit allows it).
 */
export async function POST(request: NextRequest) {
  try {
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
      // Process from blob URL
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
