// Turns a screen capture (PNG, large) into a small JPEG that is cheap to keep
// with a report: one per step, and a run can have dozens.

import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const MAX_WIDTH = 600;
const QUALITY = 72;

// Shrinks by averaging the source pixels under each output pixel, which keeps
// text legible where simply dropping pixels would not.
function shrink({ data, width, height }, targetWidth) {
  const scale = targetWidth / width;
  const targetHeight = Math.max(1, Math.round(height * scale));
  const out = Buffer.alloc(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y += 1) {
    const y0 = Math.floor(y / scale);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((y + 1) / scale)));

    for (let x = 0; x < targetWidth; x += 1) {
      const x0 = Math.floor(x / scale);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((x + 1) / scale)));

      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;

      for (let sy = y0; sy < y1; sy += 1) {
        for (let sx = x0; sx < x1; sx += 1) {
          const at = (sy * width + sx) * 4;
          r += data[at];
          g += data[at + 1];
          b += data[at + 2];
          count += 1;
        }
      }

      const to = (y * targetWidth + x) * 4;
      out[to] = r / count;
      out[to + 1] = g / count;
      out[to + 2] = b / count;
      out[to + 3] = 255;
    }
  }

  return { data: out, width: targetWidth, height: targetHeight };
}

// PNG buffer -> { base64, width, height } of a JPEG no wider than 600px.
export function toStepImage(png, { maxWidth = MAX_WIDTH, quality = QUALITY } = {}) {
  const source = PNG.sync.read(png);
  const target = Math.min(maxWidth, source.width);
  const picture = target === source.width ? source : shrink(source, target);
  const encoded = jpeg.encode({ data: picture.data, width: picture.width, height: picture.height }, quality);

  return {
    base64: encoded.data.toString("base64"),
    width: picture.width,
    height: picture.height,
  };
}
