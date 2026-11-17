/**
 * Photo pipeline against an S3-compatible server (moto locally; R2 in production).
 * Start one first:  moto_server -p 5005
 * Run:  R2_ENDPOINT=http://127.0.0.1:5005 npx vitest run
 */
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.R2_ENDPOINT ?? "http://127.0.0.1:5005";
Object.assign(process.env, {
  R2_ENDPOINT: endpoint,
  R2_ACCESS_KEY_ID: "test",
  R2_SECRET_ACCESS_KEY: "test",
  R2_PUBLIC_BUCKET: "bsi-public",
  R2_PRIVATE_BUCKET: "bsi-private",
  R2_PUBLIC_BASE_URL: "https://images.example.com",
});

const storage = await import("@/lib/storage");
const { processImage, VARIANT_WIDTHS } = await import("@/lib/image-processing");

// A 3000x2000 JPEG taken "sideways" (EXIF orientation 6) with GPS coordinates in its metadata.
async function cameraJpeg() {
  return sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 180, g: 140, b: 100 } } })
    .jpeg({ quality: 90 })
    .withExif({
      IFD0: { Make: "TestCam", Model: "X100" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "38/1 53/1 0/1", GPSLongitudeRef: "W", GPSLongitude: "77/1 2/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

beforeAll(async () => {
  const s3 = new S3Client({ region: "auto", endpoint, forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } });
  for (const Bucket of ["bsi-public", "bsi-private"]) {
    await s3.send(new CreateBucketCommand({ Bucket })).catch(() => undefined);
  }
});

describe("photo pipeline", () => {
  it("source photo really has GPS and orientation metadata", async () => {
    const meta = await sharp(await cameraJpeg()).metadata();
    expect(meta.orientation).toBe(6);
    expect(meta.exif?.toString("latin1")).toContain("TestCam");
  });

  it("uploads through a one-time link, processes, stores sizes and serves a signed download", async () => {
    const original = await cameraJpeg();
    const key = storage.newKey("originals/gallery-1", "JPG");
    expect(key).toMatch(/^originals\/gallery-1\/[0-9a-f-]{36}\.jpg$/);

    // Browser step: PUT straight to storage with the presigned link.
    const url = await storage.presignUpload("private", key, "image/jpeg");
    const put = await fetch(url, { method: "PUT", body: new Uint8Array(original), headers: { "Content-Type": "image/jpeg" } });
    expect(put.status).toBe(200);

    // Server step: read the original back and make the web sizes.
    const bytes = await storage.getObjectBytes("private", key);
    expect(bytes.equals(original)).toBe(true);
    const out = await processImage(bytes);

    // Orientation applied: the sideways 3000x2000 becomes a 2000x3000 portrait.
    expect([out.width, out.height]).toEqual([2000, 3000]);
    const webp = out.variants.filter((v) => v.format === "webp").map((v) => v.w);
    expect(webp).toEqual([...VARIANT_WIDTHS].map((w) => Math.min(w, 2000)));
    expect(out.variants.find((v) => v.format === "jpeg")?.w).toBe(2000);
    expect(out.blurDataUrl.startsWith("data:image/webp;base64,")).toBe(true);

    // Privacy: no EXIF (GPS, camera details) survives in any public image.
    for (const v of out.variants) {
      const m = await sharp(v.data).metadata();
      expect(m.exif).toBeUndefined();
      expect(m.orientation ?? 1).toBe(1);
    }

    // Store the sizes in the public bucket, then fetch one through a signed link.
    for (const v of out.variants) {
      await storage.putObject("public", `portfolio/test-${v.w}.${v.format === "webp" ? "webp" : "jpg"}`, v.data, `image/${v.format}`, "public, max-age=31536000, immutable");
    }
    const dl = await storage.presignDownload("public", "portfolio/test-640.webp", "photo.webp");
    const got = await fetch(dl);
    expect(got.status).toBe(200);
    expect(Buffer.from(await got.arrayBuffer()).equals(out.variants[0].data)).toBe(true);

    // Deleting removes the file.
    await storage.deleteObject("private", key);
    await expect(storage.getObjectBytes("private", key)).rejects.toThrow();
  });

  it("never upscales a small photo", async () => {
    const small = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#777" } }).jpeg().toBuffer();
    const out = await processImage(small);
    expect(Math.max(...out.variants.map((v) => v.w))).toBe(800);
  });

  it("rejects a file that is not an image", async () => {
    await expect(processImage(Buffer.from("not an image at all"))).rejects.toThrow();
  });

  it("builds public URLs safely", () => {
    expect(storage.publicUrl("portfolio/a b/c.webp")).toBe("https://images.example.com/portfolio/a%20b/c.webp");
  });
});
