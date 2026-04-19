import type { TiffJobIn, TiffJobOut } from "./tiffWorker";

export type SatelliteImage = {
  id: string;
  fileName: string;
  tile: string;
  year: number;
  month: number;
  dataUrl: string;
};

export type SatelliteByTile = Map<string, SatelliteImage[]>;

// Matches: {TILE}_s2_l2a_{YEAR}_{MONTH}.tif(f) — tile may contain underscores.
// Also tolerates extra suffixes after month (e.g. _v2) and case variants.
// Tile name = everything before `_s2` (allowing 1+ underscores/dashes before s2).
const NAME_RE = /^(.+?)[_-]+s2[_-]+l2a[_-]+(\d{4})[_-]+(\d{1,2})(?:[_-][^.]*)?\.tif{1,2}$/i;

export const parseSatelliteName = (
  fileName: string,
): { tile: string; year: number; month: number } | null => {
  // Strip any folder path the browser may include (webkitRelativePath)
  const base = fileName.split("/").pop() ?? fileName;
  const m = NAME_RE.exec(base);
  if (!m) return null;
  const year = Number(m[2]);
  const month = Number(m[3]);
  if (month < 1 || month > 12) return null;
  return { tile: m[1], year, month };
};

/** Merge new images into an existing byTile map. Same tile+year+month replaces. */
export const mergeSatellite = (
  existing: SatelliteByTile,
  incoming: SatelliteImage[],
): SatelliteByTile => {
  const next: SatelliteByTile = new Map(existing);
  for (const img of incoming) {
    const arr = next.get(img.tile) ?? [];
    const filtered = arr.filter((x) => !(x.year === img.year && x.month === img.month));
    filtered.push(img);
    filtered.sort((a, b) => a.year - b.year || a.month - b.month);
    next.set(img.tile, filtered);
  }
  return next;
};

const createWorker = () =>
  new Worker(new URL("./tiffWorker.ts", import.meta.url), { type: "module" });

export const processTiffFiles = async (
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ images: SatelliteImage[]; skipped: { name: string; reason: string }[] }> => {
  const images: SatelliteImage[] = [];
  const skipped: { name: string; reason: string }[] = [];

  // Pre-validate names
  const valid: { file: File; meta: { tile: string; year: number; month: number } }[] = [];
  for (const file of files) {
    const meta = parseSatelliteName(file.name);
    if (!meta) {
      skipped.push({ name: file.name, reason: "Filename does not match pattern" });
      continue;
    }
    if (file.size > 50 * 1024 * 1024) {
      skipped.push({ name: file.name, reason: "File >50MB" });
      continue;
    }
    valid.push({ file, meta });
  }

  const total = valid.length;
  if (total === 0) return { images, skipped };

  // Pool of workers
  const poolSize = Math.min(4, Math.max(1, navigator.hardwareConcurrency || 2));
  const workers = Array.from({ length: poolSize }, createWorker);
  let done = 0;
  let idx = 0;

  await new Promise<void>((resolveAll) => {
    let active = 0;
    const next = (worker: Worker) => {
      if (idx >= valid.length) {
        if (active === 0) resolveAll();
        return;
      }
      const { file, meta } = valid[idx++];
      const id = `${meta.tile}_${meta.year}_${meta.month}_${idx}`;
      active++;
      const handler = (e: MessageEvent<TiffJobOut>) => {
        const result = e.data;
        if (result.id !== id) return;
        worker.removeEventListener("message", handler);
        if (result.ok === true) {
          images.push({
            id,
            fileName: file.name,
            tile: meta.tile,
            year: meta.year,
            month: meta.month,
            dataUrl: result.dataUrl,
          });
        } else {
          const reason = (result as { error: string }).error;
          skipped.push({ name: file.name, reason });
        }
        done++;
        onProgress?.(done, total);
        active--;
        next(worker);
      };
      worker.addEventListener("message", handler);
      file.arrayBuffer().then((buffer) => {
        const msg: TiffJobIn = { id, buffer };
        worker.postMessage(msg, [buffer]);
      });
    };
    workers.forEach(next);
  });

  workers.forEach((w) => w.terminate());
  return { images, skipped };
};

/**
 * Find images for a GeoJSON tile name with fuzzy prefix matching.
 * Handles cases like GeoJSON "18NVJ_1_6" matching folder "18NVJ_1_6__s2_l2a".
 */
export const findTileImages = (
  byTile: SatelliteByTile,
  geoTile: string,
): SatelliteImage[] => {
  if (byTile.has(geoTile)) return byTile.get(geoTile) ?? [];
  const target = geoTile.toLowerCase().replace(/[_-]+s2[_-]+l2a.*$/, "");
  for (const [key, files] of byTile.entries()) {
    const norm = key.toLowerCase().replace(/[_-]+s2[_-]+l2a.*$/, "");
    if (norm === target || norm.startsWith(target) || target.startsWith(norm)) {
      return files;
    }
  }
  return [];
};

export const groupByTile = (images: SatelliteImage[]): SatelliteByTile => {
  const map: SatelliteByTile = new Map();
  for (const img of images) {
    const arr = map.get(img.tile) ?? [];
    arr.push(img);
    map.set(img.tile, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => a.year - b.year || a.month - b.month);
  }
  return map;
};

export const monthKey = (year: number, month: number) =>
  `${year}-${String(month).padStart(2, "0")}`;

export const formatMonthLabel = (year: number, month: number) => {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
};

/** Find image with the closest (year, month) to target. Returns null if list empty. */
export const findNearest = (
  images: SatelliteImage[],
  year: number,
  month: number,
): { image: SatelliteImage; exact: boolean } | null => {
  if (images.length === 0) return null;
  const target = year * 12 + (month - 1);
  let best = images[0];
  let bestDiff = Math.abs(best.year * 12 + (best.month - 1) - target);
  for (let i = 1; i < images.length; i++) {
    const d = Math.abs(images[i].year * 12 + (images[i].month - 1) - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = images[i];
    }
  }
  return { image: best, exact: bestDiff === 0 };
};
