/* Medios del panel: validación, compresión en el navegador y subida al cubo privado. */
(function (root) {
  'use strict';

  const PADMIN = (root.PADMIN = root.PADMIN || {});

  const MAX_SIDE = 1800;
  const QUALITY = 0.85;
  const RETRY_QUALITY = 0.7;
  const MAX_FINAL = 1.5 * 1024 * 1024;
  const MAX_SOURCE = 15 * 1024 * 1024;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MEDIA_RE = /^media:([A-Za-z0-9_-]{1,64})$/;

  const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/;
  const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d{6,})/;
  const LEGACY_VIDEO_RE = /^assets\/media\/[\w./-]+\.(mp4|webm|mov)$/i;
  const LEGACY_IMAGE_RE = /^assets\/media\/[\w./-]+\.(jpe?g|png|webp|gif|avif)$/i;

  function fit(width, height, max) {
    const w = Number(width) || 0;
    const h = Number(height) || 0;
    if (w <= 0 || h <= 0) return { width: 0, height: 0 };
    const cap = Number(max) || MAX_SIDE;
    const scale = Math.min(1, cap / Math.max(w, h));
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  function videoError(value) {
    const src = String(value == null ? '' : value).trim();
    if (!src) return 'Pega un enlace de YouTube o Vimeo.';
    if (YOUTUBE_RE.test(src) || VIMEO_RE.test(src) || LEGACY_VIDEO_RE.test(src)) return '';
    return 'Usa un enlace de YouTube o Vimeo.';
  }

  function imageError(value) {
    const src = String(value == null ? '' : value).trim();
    if (!src) return 'Pega un enlace de imagen o sube un archivo.';
    if (/^https?:\/\/\S+$/i.test(src) || LEGACY_IMAGE_RE.test(src)) return '';
    return 'Usa un enlace de imagen o sube un archivo.';
  }

  function assertUpload(bytes, mime, originalBytes) {
    const type = String(mime || '').toLowerCase();
    if (TYPES.indexOf(type) < 0) throw new Error('Usa una imagen JPEG, PNG o WebP.');
    if (Number(originalBytes) > MAX_SOURCE) throw new Error('La imagen original supera 15 MB.');
    if (Number(bytes) > MAX_FINAL) {
      throw new Error('La imagen sigue pesando más de 1.5 MB. Recórtala o usa otra.');
    }
  }

  function mediaIdOf(src) {
    const match = String(src || '').match(MEDIA_RE);
    return match ? match[1] : null;
  }

  function toBankItem(piece, kind, title, service) {
    const src = String((piece && piece.src) || '');
    const mediaId = (piece && piece.mediaId) || mediaIdOf(src);
    const source = mediaId ? 'upload' : (/^assets\//.test(src) ? 'legacy' : 'url');
    return {
      kind,
      title: title || '',
      source,
      media_id: mediaId,
      url: source === 'url' ? src : '',
      service: service || ''
    };
  }

  function supportsWebp() {
    const canvas = root.document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }

  function toBlob(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), mime, quality);
    });
  }

  async function compress(file) {
    assertUpload(0, file && file.type, file && file.size);
    let bitmap;
    try {
      bitmap = await root.createImageBitmap(file);
    } catch (error) {
      throw new Error('No se pudo leer la imagen. Prueba con otro archivo.');
    }
    const size = fit(bitmap.width, bitmap.height, MAX_SIDE);
    if (!size.width || !size.height) throw new Error('La imagen no tiene dimensiones válidas.');
    const canvas = root.document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    if (typeof bitmap.close === 'function') bitmap.close();

    const mime = supportsWebp() ? 'image/webp' : 'image/jpeg';
    let blob = await toBlob(canvas, mime, QUALITY);
    if (!blob) throw new Error('No se pudo comprimir la imagen.');
    if (blob.size > MAX_FINAL) {
      const smaller = await toBlob(canvas, mime, RETRY_QUALITY);
      if (smaller && smaller.size < blob.size) blob = smaller;
    }
    assertUpload(blob.size, blob.type || mime, file.size);
    return { blob, width: size.width, height: size.height, mime: blob.type || mime };
  }

  function extensionFor(mime) {
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/png') return 'png';
    return 'jpg';
  }

  async function upload(file) {
    const packed = await compress(file);
    const owner = await PADMIN.api.userId();
    const id = PADMIN.model.uuid();
    const path = `${owner}/${id}.${extensionFor(packed.mime)}`;
    await PADMIN.api.uploadMedia(path, packed.blob, packed.mime);
    const row = await PADMIN.api.addMedia({
      storage_path: path,
      mime: packed.mime,
      bytes: packed.blob.size,
      width: packed.width,
      height: packed.height
    });
    const signed = await PADMIN.api.signedUrl(path).catch(() => '');
    return {
      id: row.id,
      path,
      src: `media:${row.id}`,
      signed,
      width: packed.width,
      height: packed.height,
      bytes: packed.blob.size
    };
  }

  PADMIN.media = {
    fit,
    compress,
    upload,
    videoError,
    imageError,
    assertUpload,
    toBankItem,
    mediaIdOf,
    MAX_SIDE,
    MAX_FINAL,
    MAX_SOURCE
  };
})(typeof window !== 'undefined' ? window : globalThis);
