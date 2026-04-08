/**
 * Client Photo Watermark Utility
 * يضع علامة مائية آلية "صورة مقدمة من العميل" على صور العملاء
 * متطلب إلزامي في التقييم المكتبي بصور (IVS / تقييم)
 */

const WATERMARK_TEXT_AR = "صورة مقدمة من العميل";
const WATERMARK_TEXT_EN = "Client-provided photo";

/**
 * Applies a diagonal watermark to an image File and returns a new watermarked File.
 * Only processes image files; non-images are returned as-is.
 */
export async function applyClientWatermark(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }

      // Draw original image
      ctx.drawImage(img, 0, 0);

      // Calculate font size relative to image (min 16px, max 72px)
      const fontSize = Math.max(16, Math.min(72, Math.floor(img.width / 20)));

      // Semi-transparent watermark overlay
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Diagonal tiled watermark
      const diagonal = Math.sqrt(img.width ** 2 + img.height ** 2);
      const step = fontSize * 6;

      ctx.translate(img.width / 2, img.height / 2);
      ctx.rotate(-Math.PI / 6); // -30 degrees

      for (let y = -diagonal; y < diagonal; y += step) {
        for (let x = -diagonal; x < diagonal; x += step * 2) {
          ctx.strokeText(WATERMARK_TEXT_AR, x, y);
          ctx.fillText(WATERMARK_TEXT_AR, x, y);
          ctx.strokeText(WATERMARK_TEXT_EN, x + step, y + fontSize * 1.3);
          ctx.fillText(WATERMARK_TEXT_EN, x + step, y + fontSize * 1.3);
        }
      }
      ctx.restore();

      // Bottom banner
      const bannerH = fontSize * 2;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, img.height - bannerH, img.width, bannerH);
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.floor(fontSize * 0.7)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        `${WATERMARK_TEXT_AR} — ${WATERMARK_TEXT_EN}`,
        img.width / 2,
        img.height - bannerH / 2
      );

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const watermarked = new File([blob], file.name, { type: "image/jpeg", lastModified: Date.now() });
        resolve(watermarked);
      }, "image/jpeg", 0.92);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Returns true if the file is an image that should be watermarked.
 */
export function isWatermarkableImage(file: File): boolean {
  return file.type.startsWith("image/");
}
