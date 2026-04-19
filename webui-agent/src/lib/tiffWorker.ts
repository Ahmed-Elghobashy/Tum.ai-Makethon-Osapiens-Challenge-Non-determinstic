/// <reference lib="webworker" />
import { fromArrayBuffer } from "geotiff";

export type TiffJobIn = { id: string; buffer: ArrayBuffer };
export type TiffJobOut =
  | { id: string; ok: true; dataUrl: string; mode: "rgb" | "gray" }
  | { id: string; ok: false; error: string };

const normalize = (v: number, max = 3000) => {
  const n = Math.round((v / max) * 255);
  return n < 0 ? 0 : n > 255 ? 255 : n;
};

const toDataUrl = (width: number, height: number, rgba: Uint8ClampedArray) => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d")!;
  const img = new ImageData(rgba as unknown as Uint8ClampedArray<ArrayBuffer>, width, height);
  ctx.putImageData(img, 0, 0);
  return canvas.convertToBlob({ type: "image/png" }).then(
    (blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      }),
  );
};

self.onmessage = async (e: MessageEvent<TiffJobIn>) => {
  const { id, buffer } = e.data;
  try {
    const tiff = await fromArrayBuffer(buffer);
    const image = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();
    const sampleCount = image.getSamplesPerPixel();

    let mode: "rgb" | "gray" = "rgb";
    let rRaw: ArrayLike<number> | undefined;
    let gRaw: ArrayLike<number> | undefined;
    let bRaw: ArrayLike<number> | undefined;

    // Auto-detect: prefer first 3 samples as R,G,B
    if (sampleCount >= 3) {
      try {
        const rasters = (await image.readRasters({ samples: [0, 1, 2] })) as unknown as ArrayLike<number>[];
        rRaw = rasters[0];
        gRaw = rasters[1];
        bRaw = rasters[2];
      } catch {
        mode = "gray";
      }
    } else {
      mode = "gray";
    }

    if (mode === "gray") {
      const rasters = (await image.readRasters({ samples: [0] })) as unknown as ArrayLike<number>[];
      rRaw = gRaw = bRaw = rasters[0];
    }

    const len = width * height;
    const rgba = new Uint8ClampedArray(len * 4);
    for (let i = 0; i < len; i++) {
      rgba[i * 4] = normalize(rRaw![i]);
      rgba[i * 4 + 1] = normalize(gRaw![i]);
      rgba[i * 4 + 2] = normalize(bRaw![i]);
      rgba[i * 4 + 3] = 255;
    }

    const dataUrl = await toDataUrl(width, height, rgba);
    const out: TiffJobOut = { id, ok: true, dataUrl, mode };
    (self as unknown as Worker).postMessage(out);
  } catch (err) {
    const out: TiffJobOut = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(out);
  }
};
