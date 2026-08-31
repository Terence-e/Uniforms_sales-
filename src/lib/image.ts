/**
 * Center-crops an image file to a small square JPEG data URL, so avatars stay a
 * few KB and can live directly on the profile row. Browser-only.
 */
export async function fileToSquareDataUrl(
  file: File,
  size = 256,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();

  return canvas.toDataURL('image/jpeg', quality);
}
