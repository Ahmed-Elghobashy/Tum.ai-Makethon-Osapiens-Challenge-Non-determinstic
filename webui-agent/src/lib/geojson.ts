import area from "@turf/area";
import type { Feature, FeatureCollection, Polygon, MultiPolygon } from "geojson";

export type DetectedPolygon = {
  id: string;
  tile: string;
  areaHa: number;
  feature: Feature<Polygon | MultiPolygon>;
};

export const parseGeoJson = (raw: string): DetectedPolygon[] => {
  const data = JSON.parse(raw) as FeatureCollection;
  if (!data || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("Invalid GeoJSON: expected a FeatureCollection");
  }
  return data.features
    .filter(
      (f): f is Feature<Polygon | MultiPolygon> =>
        f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon",
    )
    .map((f, i) => {
      const tile = (f.properties?.tile as string) ?? `TILE_${i + 1}`;
      const areaM2 = area(f);
      const areaHa = areaM2 / 10_000;
      return {
        id: `${tile}_${i}`,
        tile,
        areaHa,
        feature: f,
      };
    });
};

export const getUniqueTiles = (polygons: DetectedPolygon[]): string[] => {
  return Array.from(new Set(polygons.map((p) => p.tile))).sort();
};

export type TileData = { name: string; polygonCount: number; totalAreaHa: number };

export const getTileData = (polygons: DetectedPolygon[]): TileData[] => {
  const map = new Map<string, TileData>();
  for (const p of polygons) {
    const t = map.get(p.tile) ?? { name: p.tile, polygonCount: 0, totalAreaHa: 0 };
    t.polygonCount += 1;
    t.totalAreaHa += p.areaHa;
    map.set(p.tile, t);
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export const polygonColor = () => "#dc2626"; // Single red color for all deforestation
