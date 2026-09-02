import QRCode from 'qrcode';

/**
 * A printed document's reference as a crisp inline-SVG QR code (A-FR-7.7).
 *
 * What is encoded is the human reference -- SAL-2026-0001, ORD-…, RTN-…, COL-…,
 * ALT-… -- and never the UUID. The reference is what search looks up (A-FR-7.6)
 * and what a parent is holding; the UUID is never shown or printed (A-FR-7.4).
 * So a parent who brings the paper back is found by scanning rather than typing.
 *
 * Built server-side and handed to the (client) print components as a string, so
 * the encoder never ships in the client bundle. `QRCode.create` is synchronous,
 * which is why this can be a plain function rather than async.
 *
 * Rendered with a full quiet zone, crispEdges and an explicit white ground so a
 * low-DPI office printer -- or a dark UI theme bleeding through -- still scans.
 */
export function referenceQrSvg(reference: string): string {
  const qr = QRCode.create(reference, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const quiet = 4; // modules; the QR spec's minimum quiet zone
  const dim = size + quiet * 2;

  // One path of 1×1 squares for the dark modules -- far fewer nodes than a rect
  // per module, and it prints identically.
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) {
        path += `M${x + quiet},${y + quiet}h1v1h-1z`;
      }
    }
  }

  // viewBox is in module units; the consumer sizes it in CSS.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}"` +
    ` shape-rendering="crispEdges" role="img" aria-label="${reference}">` +
    `<rect width="${dim}" height="${dim}" fill="#fff"/>` +
    `<path d="${path}" fill="#000"/></svg>`
  );
}
