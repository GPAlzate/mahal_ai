import { put } from '@vercel/blob';
import { auth } from '@clerk/nextjs/server';
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
];

/**
 * POST /api/blob-upload/mobile
 *
 * Server-side image upload for native clients. The web app uploads directly to
 * Vercel Blob via `@vercel/blob/client`'s browser `upload()`, which isn't
 * available in React Native — so the mobile app POSTs a multipart file here and
 * the server stores it with `put()`. Returns the blob URL to pass to the
 * existing `POST /api/receipts/{id}/parse` flow.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported image type: ${file.type}` }, { status: 400 });
  }

  try {
    const blob = await put(`receipts/${file.name || 'receipt.jpg'}`, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
