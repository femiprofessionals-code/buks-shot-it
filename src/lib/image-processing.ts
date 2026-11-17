import "server-only";
import sharp from "sharp";

export const VARIANT_WIDTHS = [640, 1280, 2048] as const;

export type Variant = { w: number; h: number; format: "webp" | "jpeg"; bytes: number; data: Buffer };

export type Processed = {
  width: number;
  height: number;
  blurDataUrl: string;
  variants: Variant[];
};

/**
 * Turns an uploaded original into web images.
 * - applies the camera's orientation, then removes all metadata (EXIF, GPS location, camera serials)
 * - converts to sRGB so colours look the same in every browser
 * - makes WebP at 640/1280/2048 px wide and a 2048 px JPEG fallback, never upscaling
 * - makes a tiny blurred placeholder shown while the image loads
 */
export async function processImage(input: Buffer): Promise<Processed> {
  const base = sharp(input, { failOn: "error", limitInputPixels: 300_000_000 }).autoOrient().toColourspace("srgb");
  const meta = await base.clone().metadata();
  // After autoOrient(), use the upright size.
  const oriented = await base.clone().toBuffer({ resolveWithObject: true });
  const width = oriented.info.width;
  const height = oriented.info.height;
  if (!width || !height || !meta.format) throw new Error("UNREADABLE_IMAGE");

  const variants: Variant[] = [];
  for (const w of VARIANT_WIDTHS) {
    const target = Math.min(w, width);
    const { data, info } = await sharp(oriented.data)
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    variants.push({ w: info.width, h: info.height, format: "webp", bytes: info.size, data });
    if (target === width) break; // smaller original: stop at its own size
  }
  const largest = Math.min(2048, width);
  const jpeg = await sharp(oriented.data)
    .resize({ width: largest, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toBuffer({ resolveWithObject: true });
  variants.push({ w: jpeg.info.width, h: jpeg.info.height, format: "jpeg", bytes: jpeg.info.size, data: jpeg.data });

  const blur = await sharp(oriented.data).resize({ width: 16 }).blur(1).webp({ quality: 40 }).toBuffer();
  return { width, height, blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`, variants };
}
