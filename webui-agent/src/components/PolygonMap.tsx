import { useMemo } from "react";
import { polygonColor, type DetectedPolygon } from "@/lib/geojson";
import type { Polygon, MultiPolygon, Position } from "geojson";

type Props = {
  polygons: DetectedPolygon[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  backgroundImage: string;
  label?: string;
  overlay?: boolean;
};

const getRings = (geom: Polygon | MultiPolygon): Position[][] => {
  if (geom.type === "Polygon") return geom.coordinates;
  return geom.coordinates.flat();
};

export const PolygonMap = ({ polygons, selectedId, onSelect, backgroundImage, label, overlay = true }: Props) => {
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygons.forEach((p) => {
      getRings(p.feature.geometry).forEach((ring) => {
        ring.forEach(([x, y]) => {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        });
      });
    });
    if (!isFinite(minX)) return null;
    const padX = (maxX - minX) * 0.1 || 0.001;
    const padY = (maxY - minY) * 0.1 || 0.001;
    return { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
  }, [polygons]);

  const project = (lng: number, lat: number) => {
    if (!bounds) return [0, 0] as const;
    const { minX, minY, maxX, maxY } = bounds;
    const x = ((lng - minX) / (maxX - minX)) * 1000;
    const y = (1 - (lat - minY) / (maxY - minY)) * 1000;
    return [x, y] as const;
  };

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-muted"
      onClick={() => onSelect(null)}
    >
      <img
        src={backgroundImage}
        alt="Satellite imagery basemap"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {bounds && overlay && (
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {polygons.map((p) => {
            const isSelected = selectedId === p.id;
            const dim = selectedId !== null && !isSelected;
            const color = polygonColor();
            const rings = getRings(p.feature.geometry);
            const d = rings
              .map((ring) =>
                ring
                  .map(([lng, lat], i) => {
                    const [x, y] = project(lng, lat);
                    return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
                  })
                  .join(" ") + " Z",
              )
              .join(" ");
            return (
              <path
                key={p.id}
                d={d}
                fill={color}
                fillOpacity={isSelected ? 0.7 : dim ? 0.12 : 0.45}
                stroke={color}
                strokeWidth={isSelected ? 3 : 1.5}
                opacity={dim ? 0.5 : 1}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
              />
            );
          })}
        </svg>
      )}
      {label && (
        <div className="absolute left-3 top-3 rounded-md bg-background/85 px-2.5 py-1 text-xs font-semibold text-foreground backdrop-blur">
          {label}
        </div>
      )}
    </div>
  );
};
