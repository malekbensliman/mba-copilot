import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Generate a client upload token for direct browser-to-blob uploads.
 * This bypasses the 4.5MB Vercel request body limit.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as HandleUploadBody;

  // Capture the host from the request for use in onUploadCompleted
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const requestUrl = host ? `${protocol}://${host}` : null;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Validate and return metadata
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        return {
          allowedContentTypes: [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain',
            'text/markdown',
            'text/csv',
          ],
          addRandomSuffix: true, // Prevent "blob already exists" errors
          tokenPayload: JSON.stringify({
            pathname,
            originalFilename: payload.originalFilename || pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Just log - the client handles processing via /api/upload-large
        // after the blob upload completes. This avoids race conditions
        // between this async callback and client-initiated processing.
        const { originalFilename } = JSON.parse(tokenPayload || '{}');
        console.log('[Blob] Upload completed:', blob.url, 'filename:', originalFilename);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    console.error('[Blob] Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
