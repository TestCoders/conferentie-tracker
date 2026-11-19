// Verkleint een foto in de browser en codeert hem opnieuw als JPEG.
// Gevolg: kleiner dan de uploadlimiet en zonder EXIF-metadata (zoals GPS-locatie).

const MAX_SIDE = 1920;
const QUALITY = 0.85;

export type ResizedImage = { blob: Blob; width: number; height: number; previewUrl: string };

export async function resizeImage(file: File): Promise<ResizedImage> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is geen afbeelding`);
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`${file.name} kan niet worden gelezen (gebruik JPEG, PNG of WebP)`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Afbeelding verwerken wordt niet ondersteund in deze browser');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  );
  if (!blob) throw new Error(`${file.name} kon niet worden omgezet`);
  return { blob, width, height, previewUrl: URL.createObjectURL(blob) };
}
