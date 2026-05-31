import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, X, Loader2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type PhotoType = "running" | "steps";

interface LogPhotoUploaderProps {
  logId: number | null; // null when creating new log (upload after save)
  type: PhotoType;
  compact?: boolean; // compact mode for table rows
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LogPhotoUploader({ logId, type, compact = false }: LogPhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const utils = trpc.useUtils();

  // Queries and mutations differ by type
  const runningPhotos = trpc.running.getLogPhotos.useQuery(
    { runningLogId: logId! },
    { enabled: type === "running" && logId != null }
  );
  const stepsPhotos = trpc.steps.getLogPhotos.useQuery(
    { stepLogId: logId! },
    { enabled: type === "steps" && logId != null }
  );

  const uploadRunning = trpc.running.uploadLogPhoto.useMutation({
    onSuccess: () => utils.running.getLogPhotos.invalidate({ runningLogId: logId! }),
  });
  const uploadSteps = trpc.steps.uploadLogPhoto.useMutation({
    onSuccess: () => utils.steps.getLogPhotos.invalidate({ stepLogId: logId! }),
  });
  const deleteRunning = trpc.running.deleteLogPhoto.useMutation({
    onSuccess: () => utils.running.getLogPhotos.invalidate({ runningLogId: logId! }),
  });
  const deleteSteps = trpc.steps.deleteLogPhoto.useMutation({
    onSuccess: () => utils.steps.getLogPhotos.invalidate({ stepLogId: logId! }),
  });

  const photos = type === "running" ? (runningPhotos.data ?? []) : (stepsPhotos.data ?? []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || !logId) return;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const validFiles = Array.from(files).filter(f => {
      if (f.size > MAX_SIZE) { toast.error(`${f.name} 超過10MB限制`); return false; }
      return true;
    });
    if (validFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of validFiles) {
        const base64 = await fileToBase64(file);
        if (type === "running") {
          await uploadRunning.mutateAsync({ runningLogId: logId, base64, mimeType: file.type });
        } else {
          await uploadSteps.mutateAsync({ stepLogId: logId, base64, mimeType: file.type });
        }
      }
      toast.success(`已上載 ${validFiles.length} 張截圖`);
    } catch {
      toast.error("上載失敗，請重試");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (photoId: number) => {
    try {
      if (type === "running") await deleteRunning.mutateAsync({ photoId });
      else await deleteSteps.mutateAsync({ photoId });
      toast.success("已刪除截圖");
    } catch {
      toast.error("刪除失敗");
    }
  };

  if (!logId) {
    return (
      <p className="text-xs text-muted-foreground italic">儲存記錄後可上載截圖</p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Upload button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1.5 text-xs"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {uploading ? "上載中..." : "上載截圖"}
        </Button>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground">{photos.length} 張</span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* Thumbnail strip */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(photos as any[]).map((photo: any) => (
            <div key={photo.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border bg-muted flex-shrink-0">
              <img
                src={photo.photoUrl}
                alt={photo.caption ?? "截圖"}
                className="w-full h-full object-cover cursor-pointer transition-opacity group-hover:opacity-80"
                onClick={() => setLightbox(photo.photoUrl)}
                loading="lazy"
              />
              {/* Zoom icon */}
              <div
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => setLightbox(photo.photoUrl)}
              >
                <ZoomIn className="w-4 h-4 text-white drop-shadow" />
              </div>
              {/* Delete button */}
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-3xl p-2 bg-black/90 border-border">
          {lightbox && (
            <img
              src={lightbox}
              alt="截圖預覽"
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
