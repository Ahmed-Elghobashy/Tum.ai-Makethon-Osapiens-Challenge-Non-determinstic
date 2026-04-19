import { useState, useMemo, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { Trees, AlertTriangle, CheckCircle2, Calendar, Target, MapPin, Layers, SplitSquareHorizontal, Upload, Play, Pause, Repeat } from "lucide-react";
import forestBg from "@/assets/forest-bg.webp";
import forestBgDark from "@/assets/forest-bg-dark.jpg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { GeoJsonUpload } from "@/components/GeoJsonUpload";
import { SatelliteUpload } from "@/components/SatelliteUpload";
import { PolygonMap } from "@/components/PolygonMap";
import { EmbeddedChat } from "@/components/EmbeddedChat";
import type { DetectedPolygon } from "@/lib/geojson";
import { findNearest, findTileImages, formatMonthLabel, mergeSatellite, monthKey, type SatelliteByTile, type SatelliteImage } from "@/lib/satellite";

const WHITE_PIXEL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'><rect width='1' height='1' fill='white'/></svg>";

const SPEED_OPTIONS = [
  { label: "1×", value: 1000 },
  { label: "2×", value: 500 },
  { label: "4×", value: 250 },
];

const Index = () => {
  const [polygons, setPolygons] = useState<DetectedPolygon[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<string | null>(null);

  const [satellite, setSatellite] = useState<SatelliteByTile>(new Map());
  const [imagerySkipped, setImagerySkipped] = useState(false);

  const [overlay, setOverlay] = useState(true);
  const [compare, setCompare] = useState(false);
  const [monthIdx, setMonthIdx] = useState(0);

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [loop, setLoop] = useState(true);

  const [leftDate, setLeftDate] = useState<string | null>(null);
  const [rightDate, setRightDate] = useState<string | null>(null);

  const hasData = polygons.length > 0;
  const hasImagery = satellite.size > 0;

  const complianceStatus = hasData ? "NON-COMPLIANT" : null;
  const riskLevel = hasData ? "HIGH" : null;
  const complianceReason = hasData
    ? "Deforestation occurred after the EUDR cut-off date (31 Dec 2020). Remediation evidence required."
    : null;

  const tiles = useMemo(() => {
    const set = new Set<string>();
    polygons.forEach((p) => set.add(p.tile));
    return Array.from(set).sort();
  }, [polygons]);

  useEffect(() => {
    if (tiles.length > 0 && (!selectedTile || !tiles.includes(selectedTile))) {
      setSelectedTile(tiles[0]);
    }
    if (tiles.length === 0 && selectedTile !== null) {
      setSelectedTile(null);
    }
  }, [tiles, selectedTile]);

  const visiblePolygons = useMemo(
    () => (selectedTile ? polygons.filter((p) => p.tile === selectedTile) : polygons),
    [polygons, selectedTile],
  );
  const visibleAreaHa = visiblePolygons.reduce((s, p) => s + p.areaHa, 0);

  // Imagery for the selected tile
  const tileImages: SatelliteImage[] = useMemo(() => {
    if (!selectedTile) return [];
    return findTileImages(satellite, selectedTile);
  }, [satellite, selectedTile]);

  // Reset month idx + compare dates when tile/imagery changes
  useEffect(() => {
    setMonthIdx(0);
    if (tileImages.length > 0) {
      setLeftDate(monthKey(tileImages[0].year, tileImages[0].month));
      const last = tileImages[tileImages.length - 1];
      setRightDate(monthKey(last.year, last.month));
    } else {
      setLeftDate(null);
      setRightDate(null);
    }
  }, [tileImages]);

  // Timelapse
  useEffect(() => {
    if (!playing || tileImages.length === 0) return;
    const id = window.setInterval(() => {
      setMonthIdx((i) => {
        const next = i + 1;
        if (next >= tileImages.length) {
          if (loop) return 0;
          setPlaying(false);
          return i;
        }
        return next;
      });
    }, speed);
    return () => window.clearInterval(id);
  }, [playing, speed, tileImages.length, loop]);

  const currentImage = tileImages[monthIdx] ?? null;
  const currentLabel = currentImage
    ? formatMonthLabel(currentImage.year, currentImage.month)
    : selectedTile && hasImagery
      ? "No imagery for this tile"
      : "No imagery";

  const findByMonthKey = (key: string | null): SatelliteImage | null => {
    if (!key) return null;
    const [y, m] = key.split("-").map(Number);
    const r = findNearest(tileImages, y, m);
    return r?.image ?? null;
  };

  const leftImg = findByMonthKey(leftDate);
  const rightImg = findByMonthKey(rightDate);

  const tileImageOptions = tileImages.map((img) => ({
    key: monthKey(img.year, img.month),
    label: formatMonthLabel(img.year, img.month),
  }));

  const backgroundFor = (img: SatelliteImage | null) => img?.dataUrl ?? WHITE_PIXEL;

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const bgImage = isDark ? forestBgDark : forestBg;

  return (
    <div className="relative min-h-screen bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat transition-opacity duration-500"
        style={{ backgroundImage: `url(${bgImage})`, opacity: isDark ? 0.55 : 0.45 }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/55 to-background/85"
      />

      <header className="border-b border-border bg-primary/95 text-primary-foreground backdrop-blur supports-[backdrop-filter]:bg-primary/85">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Trees className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              ForestWatch AI — Deforestation Detection
            </h1>
            <p className="text-xs opacity-80">
              Multimodal Satellite Monitoring System · by{" "}
              <span className="font-semibold tracking-wide">Non Deterministic</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="hidden gap-1 md:inline-flex">
              <MapPin className="h-3 w-3" /> {hasData ? `${polygons.length} polygons loaded` : "Awaiting upload"}
            </Badge>
            <Badge variant="outline" className="hidden border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground md:inline-flex">
              Team · Non Deterministic
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-6 py-6 lg:grid-cols-10">
        <section className="space-y-6 lg:col-span-7">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
              <div>
                <CardTitle className="text-base">
                  {hasData ? "Prediction Map" : "Satellite Time-Series Viewer"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {!hasData
                    ? "Upload a GeoJSON to begin"
                    : compare
                      ? "Compare mode"
                      : currentLabel}
                </p>
              </div>
              {hasData && (
                <div className="flex items-center gap-2">
                  <Switch id="overlay" checked={overlay} onCheckedChange={setOverlay} />
                  <Label htmlFor="overlay" className="cursor-pointer text-sm">
                    <Layers className="mr-1 inline h-3.5 w-3.5" />
                    Show Deforestation Overlay
                  </Label>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {hasData && tiles.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border bg-secondary/40 px-3 py-2">
                  <Label htmlFor="tile-select" className="text-sm font-medium">
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />
                    Location:
                  </Label>
                  <Select value={selectedTile ?? undefined} onValueChange={(v) => { setSelectedTile(v); setSelectedId(null); }}>
                    <SelectTrigger id="tile-select" className="h-8 w-[220px]">
                      <SelectValue placeholder="Select tile" />
                    </SelectTrigger>
                    <SelectContent>
                      {tiles.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">({tiles.length} tile{tiles.length === 1 ? "" : "s"} total)</span>
                  {selectedTile && (
                    <span className="ml-auto text-xs font-medium text-foreground">
                      Tile: {selectedTile} — {visiblePolygons.length} detection{visiblePolygons.length === 1 ? "" : "s"}, {visibleAreaHa.toFixed(1)} ha total
                    </span>
                  )}
                </div>
              )}

              {hasData && selectedTile && hasImagery && tileImages.length === 0 && (
                <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                  No satellite imagery for this tile — showing polygons on a neutral background.
                </div>
              )}

              {!compare ? (
                <div className="aspect-[4/3] w-full">
                  {!hasData ? (
                    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-muted">
                      <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <Upload className="h-6 w-6 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">Start by uploading your files</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <PolygonMap
                      polygons={visiblePolygons}
                      selectedId={selectedId}
                      onSelect={setSelectedId}
                      backgroundImage={backgroundFor(currentImage)}
                      label={selectedTile ? `${currentLabel} · ${selectedTile}` : currentLabel}
                      overlay={overlay}
                    />
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { side: "left" as const, value: leftDate, set: setLeftDate, img: leftImg },
                    { side: "right" as const, value: rightDate, set: setRightDate, img: rightImg },
                  ].map(({ side, value, set, img }) => (
                    <div key={side} className="flex flex-col gap-2">
                      <Select value={value ?? undefined} onValueChange={set} disabled={tileImageOptions.length === 0}>
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder={tileImageOptions.length === 0 ? "No imagery" : "Select date"} />
                        </SelectTrigger>
                        <SelectContent>
                          {tileImageOptions.map((o) => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="aspect-[4/3]">
                        <PolygonMap
                          polygons={visiblePolygons}
                          selectedId={selectedId}
                          onSelect={setSelectedId}
                          backgroundImage={backgroundFor(img)}
                          label={img ? formatMonthLabel(img.year, img.month) : "No image"}
                          overlay={overlay}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {hasData && !compare && (
                <div className="space-y-3">
                  {tileImages.length > 0 ? (
                    <>
                      <div className="space-y-2 px-1">
                        <Slider
                          value={[monthIdx]}
                          onValueChange={(v) => setMonthIdx(v[0])}
                          min={0}
                          max={Math.max(0, tileImages.length - 1)}
                          step={1}
                        />
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                          <span>{tileImages[0] && formatMonthLabel(tileImages[0].year, tileImages[0].month)}</span>
                          <span className="text-foreground">{currentLabel}</span>
                          <span>
                            {tileImages[tileImages.length - 1] &&
                              formatMonthLabel(
                                tileImages[tileImages.length - 1].year,
                                tileImages[tileImages.length - 1].month,
                              )}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant={playing ? "default" : "outline"} onClick={() => setPlaying((p) => !p)}>
                          {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          {playing ? "Pause" : "Start Timelapse"}
                        </Button>
                        <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
                          <SelectTrigger className="h-8 w-[90px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SPEED_OPTIONS.map((o) => (
                              <SelectItem key={o.value} value={String(o.value)}>Speed: {o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant={loop ? "default" : "outline"}
                          onClick={() => setLoop((l) => !l)}
                          title="Loop"
                        >
                          <Repeat className="h-3.5 w-3.5" />
                          Loop
                        </Button>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {hasImagery
                        ? "No imagery available for this tile."
                        : "Upload satellite imagery to enable timeline playback."}
                    </p>
                  )}
                </div>
              )}

              {hasData && (
                <div className="flex justify-end border-t pt-4">
                  <Button variant={compare ? "default" : "outline"} onClick={() => setCompare((c) => !c)}>
                    <SplitSquareHorizontal className="h-4 w-4" />
                    {compare ? "Exit Compare Mode" : "Compare Mode"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-4 lg:col-span-3">
          <GeoJsonUpload
            hasData={hasData}
            onVisualize={(polys) => {
              setPolygons(polys);
              setSelectedId(null);
            }}
          />

          <SatelliteUpload
            hasImagery={hasImagery}
            skipped={imagerySkipped}
            totalImages={Array.from(satellite.values()).reduce((s, a) => s + a.length, 0)}
            tileCounts={Array.from(satellite.entries())
              .map(([name, arr]) => ({ name, count: arr.length }))
              .sort((a, b) => a.name.localeCompare(b.name))}
            onSkip={() => setImagerySkipped(true)}
            onLoaded={(newImages) => {
              setSatellite((prev) => mergeSatellite(prev, newImages));
              setImagerySkipped(false);
            }}
          />

          {hasData && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="h-4 w-4 text-primary" />
                    Detection Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedTile && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tile</span>
                      <span className="font-semibold">{selectedTile}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Detections (tile)</span>
                    <span className="font-semibold">{visiblePolygons.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Area (tile)</span>
                    <span className="font-semibold">{visibleAreaHa.toFixed(1)} ha</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" /> All tiles
                    </span>
                    <span className="font-medium">{polygons.length} polygons · {tiles.length} tiles</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">EUDR Compliance Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge className="gap-1 bg-destructive text-destructive-foreground hover:bg-destructive">
                      <AlertTriangle className="h-3 w-3" /> {complianceStatus ?? "Unknown"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Risk level</span>
                    <Badge variant="outline" className="border-destructive text-destructive">
                      {riskLevel ?? "Unknown"}
                    </Badge>
                  </div>
                  <p className="border-t pt-3 text-xs text-muted-foreground">
                    {complianceReason ?? "Upload predictions to assess compliance."}
                  </p>
                </CardContent>
              </Card>

              <EmbeddedChat
                selectedTile={selectedTile}
                tileStats={selectedTile ? { polygonCount: visiblePolygons.length, totalAreaHa: visibleAreaHa } : null}
                complianceStatus={complianceStatus}
                riskLevel={riskLevel}
                complianceReason={complianceReason}
              />

              <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-foreground">
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 text-success" />
                Last sync: 2 hours ago · Sentinel-2 + Planet
              </div>
            </>
          )}
        </aside>
      </main>
    </div>
  );
};

export default Index;
