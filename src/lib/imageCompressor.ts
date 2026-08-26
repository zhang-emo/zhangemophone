/**
 * Smart Canvas Image Compressor for IndexedDB storage.
 * Prevents QuotaExceededError and OOM crashes during JSZip export on mobile webviews.
 */

export async function compressImageBase64(
  dataUrl: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> {
  // Return immediately if not a compressable image (e.g. SVG or empty)
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image') || dataUrl.startsWith('data:image/svg+xml')) {
    return dataUrl;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // Skip compression if image is already small in both dimensions
        if (width <= maxWidth && height <= maxHeight && dataUrl.length < 150000) {
          resolve(dataUrl);
          return;
        }

        // Calculate aspect ratio & new dimensions
        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compact JPEG format
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

        // Return compressed data if smaller, otherwise return original
        if (compressedDataUrl && compressedDataUrl.length < dataUrl.length) {
          resolve(compressedDataUrl);
        } else {
          resolve(dataUrl);
        }
      } catch (err) {
        console.warn('Canvas compression error, fallback to original:', err);
        resolve(dataUrl);
      }
    };

    img.onerror = () => {
      resolve(dataUrl);
    };

    img.src = dataUrl;
  });
}

/**
 * Reads a File object and compresses it directly into a compact Base64 string.
 */
export function compressFileImage(
  file: File,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.8
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawBase64 = e.target?.result as string;
      if (file.type === 'image/svg+xml') {
        resolve(rawBase64);
        return;
      }
      try {
        const compressed = await compressImageBase64(rawBase64, maxWidth, maxHeight, quality);
        resolve(compressed);
      } catch (_) {
        resolve(rawBase64);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
