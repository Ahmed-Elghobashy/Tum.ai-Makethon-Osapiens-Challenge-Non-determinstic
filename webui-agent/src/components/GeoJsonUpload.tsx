import { useRef, useState } from "react";
import { Upload, FileJson, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseGeoJson, getTileData, type DetectedPolygon } from "@/lib/geojson";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  onVisualize: (polygons: DetectedPolygon[]) => void;
  hasData: boolean;
};

export const GeoJsonUpload = ({ onVisualize, hasData }: Props) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const text = await file.text();
    setFileName(file.name);
    setRaw(text);
  };

  const handleVisualize = async () => {
    if (!raw) {
      toast.error("Please upload a GeoJSON file first");
      return;
    }

    try {
      const polys = parseGeoJson(raw);
      if (polys.length === 0) {
        toast.error("No polygon features found in file");
        return;
      }

      // Compute per-tile stats
      const tileData = getTileData(polys);

      // Visualize polygons
      onVisualize(polys);
      toast.success(`Loaded ${polys.length} predictions across ${tileData.length} tiles`);

      // Update Cognee with rich per-tile data
      try {
        const { data, error } = await supabase.functions.invoke("cognee-remember", {
          body: {
            tileData,
            totalPolygons: polys.length,
          },
        });

        if (error) {
          console.error("cognee-remember error:", error);
          toast.error("Failed to sync with agent");
        } else {
          console.log("Cognee updated:", data);
          toast.success("Agent synced with analysis data");
        }
      } catch (err) {
        console.error("Cognee sync failed:", err);
        // Don't block visualization on Cognee failure
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to parse GeoJSON");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Model Predictions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".geojson,.json,application/geo+json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button variant="outline" className="w-full justify-start" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {fileName ? "Change file" : "Upload GeoJSON Results"}
        </Button>
        {fileName && (
          <div className="flex items-center gap-2 rounded-md border bg-secondary/40 px-2.5 py-1.5 text-xs">
            <FileJson className="h-3.5 w-3.5 text-primary" />
            <span className="truncate font-medium">{fileName}</span>
          </div>
        )}
        <Button className="w-full" onClick={handleVisualize} disabled={!raw} variant={hasData ? "outline" : "default"}>
          {hasData ? "Re-visualize Predictions" : "Visualize Predictions"}
        </Button>
      </CardContent>
    </Card>
  );
};
