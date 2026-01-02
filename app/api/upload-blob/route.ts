import { put, del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Handle large file uploads via Vercel Blob
 * This endpoint receives the file, uploads it to Blob storage temporarily,
 * triggers the backend to process it, then DELETES the blob to save storage costs.
 */
export async function POST(request: NextRequest) {
  let blobUrl: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const filename = (formData.get('filename') as string) || file.name;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`[Blob Upload] Starting upload for ${filename}, size: ${file.size} bytes`);

    // Upload to Vercel Blob (temporary storage)
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    blobUrl = blob.url;
    console.log(`[Blob Upload] File uploaded to: ${blobUrl}`);

    // Now call the backend to process this file from the blob URL
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    const response = await fetch(`${backendUrl}/backend/upload-from-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: blob.url,
        filename: filename,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || 'Backend processing failed');
    }

    const result = await response.json();

    // DELETE the blob after successful processing to save storage costs
    console.log(`[Blob Upload] Deleting temporary blob: ${blobUrl}`);
    await del(blobUrl);

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('[Blob Upload] Error:', error);

    // Try to cleanup blob even on error
    if (blobUrl) {
      try {
        await del(blobUrl);
        console.log(`[Blob Upload] Cleaned up blob after error: ${blobUrl}`);
      } catch (delError) {
        console.error('[Blob Upload] Failed to cleanup blob:', delError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json(
      { error: 'Upload failed', detail: errorMessage },
      { status: 500 }
    );
  }
}
