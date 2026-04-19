import { useRef, useState } from "react";
import { Upload, Image as ImageIcon, Check, AlertTriangle, SkipForward, FolderOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { processTiffFiles, type SatelliteImage } from "@/lib/satellite";

type Props = {
  onLoaded: (newImages: SatelliteImage[]) => void;
  onSkip: () => void;
  hasImagery: boolean;
  skipped: boolean;
  totalImages: number;
  tileCounts: { name: string; count: number }[];
};

// Add the non-standard webkitdirectory attribute to JSX
declare module "react" {
  interface InputHTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

export const SatelliteUpload = ({
  onLoaded,
  onSkip,
  hasImagery,
  skipped,
  totalImages,
  tileCounts,
}: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => /\.tiff?$/i.test(f.name));
    if (files.length === 0) {
      toast.error("No .tif/.tiff files found in selection");
      return;
    }
    if (files.length > 100) {
      toast.warning(`Loading ${files.length} files — this may take a while`);
    }
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    try {
      const { images, skipped: bad } = await processTiffFiles(files, (done, total) =>
        setProgress({ done, total }),
      );
      onLoaded(images);
      if (bad.length > 0) {
        toast.warning(`${bad.length} file${bad.length === 1 ? "" : "s"} skipped`);
        console.warn("Skipped files:", bad);
      }
      if (images.length > 0) {
        toast.success(`Added ${images.length} image${images.length === 1 ? "" : "s"}`);
      } else if (bad.length > 0) {
        toast.error("No valid images. Check filename pattern: {TILE}_s2_l2a_{YEAR}_{MONTH}.tif");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process imagery");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4 text-primary" />
          Satellite Imagery <span className="text-xs font-normal text-muted-foreground">(Optional)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".tif,.tiff,image/tiff"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {!hasImagery && !skipped && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-border bg-secondary/30"
            }`}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Drop a folder or <code className="font-mono">.tif</code> files here
            </p>
            <p className="text-[10px] text-muted-foreground">
              Pattern: <code className="font-mono">{"{TILE}_s2_l2a_{YEAR}_{MONTH}.tif"}</code>
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="flex-1 justify-center"
            onClick={() => folderInputRef.current?.click()}
            disabled={busy}
          >
            <FolderOpen className="h-4 w-4" />
            {hasImagery ? "Add folder" : "Upload Folder"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 justify-center"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-4 w-4" />
            {hasImagery ? "Add files" : "Browse Files"}
          </Button>
          {!hasImagery && !skipped && (
            <Button variant="ghost" onClick={onSkip} disabled={busy} title="Use white background">
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          )}
        </div>

        {busy && (
          <div className="space-y-1.5">
            <Progress value={(progress.done / Math.max(1, progress.total)) * 100} />
            <p className="text-xs text-muted-foreground">
              Processing {progress.done}/{progress.total} images…
            </p>
          </div>
        )}

        {skipped && !hasImagery && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/40 p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              Imagery skipped — polygons will render on a white background.
            </span>
          </div>
        )}

        {totalImages > 0 && (
          <div className="space-y-1.5 rounded-md border bg-secondary/40 p-2.5">
            <p className="text-xs font-medium">
              Loaded {totalImages} image{totalImages === 1 ? "" : "s"} across {tileCounts.length} tile
              {tileCounts.length === 1 ? "" : "s"}
            </p>
            <ul className="max-h-40 space-y-0.5 overflow-y-auto">
              {tileCounts.map((t) => (
                <li key={t.name} className="flex items-center gap-1.5 text-xs">
                  <Check className="h-3 w-3 text-success" />
                  <span className="font-mono">{t.name}</span>
                  <span className="text-muted-foreground">
                    ({t.count} image{t.count === 1 ? "" : "s"})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
