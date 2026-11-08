/**
 * Reduce upload/storage bytes without downscaling small receipt text.
 * Small images and formats the browser may not decode are left untouched.
 */
export async function compressReceiptImage(file: File, signal?: AbortSignal): Promise<File> {
  signal?.throwIfAborted();
  if (file.size <= 1024 * 1024 || file.size > 20 * 1024 * 1024 ||
      !['image/jpeg', 'image/png'].includes(file.type) ||
      typeof createImageBitmap !== 'function') {
    return file;
  }

  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    signal?.throwIfAborted();

    // Bound canvas memory use, especially on phones. Never shrink long receipts
    // merely to meet a byte target; fall back to the original instead.
    if (bitmap.width * bitmap.height > 24_000_000 ||
        Math.max(bitmap.width, bitmap.height) > 16_384) {
      return file;
    }

    canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) return file;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);

    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas!.toBlob(resolve, 'image/webp', 0.85);
    });
    signal?.throwIfAborted();
    // Browsers may return PNG when WebP encoding is unsupported. Keep the
    // original in that case, and avoid lossy conversion for negligible savings.
    if (!compressed || compressed.type !== 'image/webp' ||
        compressed.size === 0 || compressed.size > file.size * 0.9) {
      return file;
    }

    const basename = file.name.replace(/\.[^.]+$/, '') || 'receipt';
    return new File([compressed], `${basename}.webp`, {
      type: compressed.type,
      lastModified: file.lastModified,
    });
  } catch {
    // A failed optimization must not prevent a supported original from uploading.
    signal?.throwIfAborted();
    return file;
  } finally {
    bitmap?.close();
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}
