export const MAX_PHOTOS = 100;
export const photoSource = id => `/media/gallery/${id}.webp`;
export const emptyGallery = () => ({ version: 1, publication: '', photos: [] });

export function validateGallery(value, { allowFiles = false } = {}) {
  if (!value || value.version !== 1 || typeof value.publication !== 'string' || value.publication.length > 100 || !Array.isArray(value.photos) || value.photos.length > MAX_PHOTOS) throw new Error(`The gallery supports up to ${MAX_PHOTOS} photos.`);
  const ids = new Set();
  const photos = value.photos.map(photo => {
    if (!photo || typeof photo.id !== 'string' || (photo.id && !/^[a-f0-9]{64}$/.test(photo.id)) || (!allowFiles && !photo.id)) throw new Error('Reload the gallery before publishing.');
    if (photo.id && ids.has(photo.id)) throw new Error('Use each photo only once in the gallery.');
    if (photo.id) ids.add(photo.id);
    if (typeof photo.caption !== 'string' || photo.caption.length > 500 || typeof photo.alt !== 'string' || photo.alt.length > 500 || typeof photo.visible !== 'boolean') throw new Error('Use captions and image descriptions of up to 500 characters.');
    if (photo.visible && !photo.alt.trim()) throw new Error('Add an image description for each visible photo.');
    if (allowFiles && photo.file !== null && !/^photo-\d{1,3}$/.test(photo.file)) throw new Error('Choose the photos again before publishing.');
    return { id: photo.id, caption: photo.caption.trim(), alt: photo.alt.trim(), visible: photo.visible, ...(allowFiles ? { file: photo.file } : {}), ...(photo.id ? { src: photoSource(photo.id) } : {}) };
  });
  return { version: 1, publication: value.publication, photos };
}
