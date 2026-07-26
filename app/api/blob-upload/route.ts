import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse, type NextRequest } from 'next/server';
import { callerKey, rateLimit } from '@/lib/server/rateLimit';

/**
 * POST /api/blob-upload
 * Handles client-side Vercel Blob uploads by generating short-lived tokens.
 * Called automatically by the @vercel/blob/client `upload()` function.
 *
 * This has to stay open to anonymous callers: the upload is kicked off in
 * parallel with receipt creation, so there is no receipt (and no share code) to
 * authorize against yet. Abuse is bounded by the per-caller rate limit and the
 * content-type restriction on the issued token rather than by identity.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const limited = rateLimit(`blob:upload:${callerKey(request)}`, 20, 60_000);

  if (limited) {
    return limited;
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif'],
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
