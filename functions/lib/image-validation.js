import { GalleryError } from './gallery-error.js';

// Validate the still-WebP container and dimensions rather than trusting its extension.
export function validateWebp(bytes) {
  if (bytes.length < 20 || bytes.length > 2 * 1024 * 1024) throw new GalleryError('Each optimized photo must be a WebP image up to 2 MB.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WEBP' || view.getUint32(4, true) + 8 !== bytes.length) throw new GalleryError('This file is not a valid WebP image.');
  let frame = false, dimensions;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw new GalleryError('The image file is incomplete.');
    const type = tag(offset), size = view.getUint32(offset + 4, true), start = offset + 8;
    const next = start + size + (size % 2);
    if (next > bytes.length || !['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(type)) throw new GalleryError('Use a still photo without embedded metadata or animation.');
    let width, height;
    if (type === 'VP8 ') {
      if (frame || size < 10 || (bytes[start] & 1) || bytes[start + 3] !== 0x9d || bytes[start + 4] !== 0x01 || bytes[start + 5] !== 0x2a) throw new GalleryError('The WebP image frame is invalid.');
      width = view.getUint16(start + 6, true) & 0x3fff; height = view.getUint16(start + 8, true) & 0x3fff; frame = true;
    } else if (type === 'VP8L') {
      if (frame || size < 5 || bytes[start] !== 0x2f || bytes[start + 4] >> 5) throw new GalleryError('The WebP image frame is invalid.');
      const bits = view.getUint32(start + 1, true); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; frame = true;
    } else if (type === 'VP8X') {
      if (offset !== 12 || size !== 10 || (bytes[start] & ~0x10)) throw new GalleryError('Use a still photo without embedded metadata or animation.');
      width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
      height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
    }
    if (width !== undefined) {
      if (!width || !height || Math.max(width, height) > 1920 || dimensions && (dimensions[0] !== width || dimensions[1] !== height)) throw new GalleryError('Photos must be resized to at most 1920 pixels before publishing.');
      dimensions = [width, height];
    }
    offset = next;
  }
  if (!frame) throw new GalleryError('The WebP photo has no image frame.');
}
