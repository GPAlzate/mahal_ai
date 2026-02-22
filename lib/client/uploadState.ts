/**
 * Module-level store for in-flight Vercel Blob upload promises.
 *
 * This persists across Next.js client-side route transitions because JS modules
 * are not re-initialized on navigation. The home page stores the upload promise
 * here before navigating away; the participants page consumes it to trigger parsing
 * once the blob URL is available.
 */

type BlobResult = { url: string };

const pendingUploads = new Map<number, Promise<BlobResult>>();

export const uploadState = {
  set: (receiptId: number, promise: Promise<BlobResult>) =>
    pendingUploads.set(receiptId, promise),

  get: (receiptId: number): Promise<BlobResult> | undefined =>
    pendingUploads.get(receiptId),

  delete: (receiptId: number) => pendingUploads.delete(receiptId),
};
