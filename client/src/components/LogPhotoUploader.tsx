import { useRef, useState, useEffect, useImperativeHandle, forwardRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Camera, X, Loader2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type PhotoType = "running" | "steps";

/** Staged file before the parent record is saved */
interface StagedFile {
  file: File;
  previewUrl: string;
}

export interface LogPhotoUploaderRef {
  /** Upload all staged files to the newly created log. Returns true on success. */
  uploadStagedFiles: (logId: number) => Promise<boolean>;
  hasStagedFiles: () => boolean;
}

interface LogPhotoUploaderProps {
  /** null = new record (staging mode); number = existing record (direct upload mode) */
  logId: number | null;
  type: PhotoType;
  compact?: boolean;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const LogPhotoUploader = forwardRef<LogPhotoUploaderRef, LogPhotoUploaderProps>(
  ({ logId, type, compact = false }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [lightbox, setLightbox] = useState<string | null>(null);
    const [staged, setStaged] = useState<StagedFile[]>([]);
    const utils = trpc.useUtils();

    // Clean up object URLs on unmount
    useEffect(() => {
      return () => staged.forEach(s => URL.revokeObjectURL(s.previewUrl));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Queries for existing records
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

    const savedPhotos = type === "running" ? (runningPhotos.data ?? []) : (stepsPhotos.data ?? []);

    // Expose imperative API to parent for post-save upload
    useImperativeHandle(ref, () => ({
      uploadStagedFiles: async (newLogId: number) => {
        if (staged.length === 0) return true;
        setUploading(true);
        try {
          for (const { file } of staged) {
            const base64 = await fileToBase64(file);
            if (type === "running") {
              await uploadRunning.mutateAsync({ runningLogId: newLogId, base64, mimeType: file.type });
            } else {
              await uploadSteps.mutateAsync({ stepLogId: newLogId, base64, mimeType: file.type });
            }
          }
          setStaged([]);
          return true;
        } catch {
          toast.error("截圖上載失敗，請在記錄詳情中重試");
          return false;
        } finally {
          setUploading(false);
        }
      },
      hasStagedFiles: () => staged.length > 0,
    }));

    const handleFiles = async (files: FileList | null) => {
      if (!files) return;
      const MAX_SIZE = 10 * 1024 * 1024;
      const validFiles = Array.from(files).filter(f => {
        if (f.size > MAX_SIZE) { toast.error(`${f.name} 超過10MB限制`); return false; }
        return true;
      });
      if (validFiles.length === 0) return;

      if (logId == null) {
        // Staging mode: preview locally, upload after save
        const newStaged = validFiles.map(file => ({
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        setStaged(prev => [...prev, ...newStaged]);
        toast.success(`已選取 ${validFiles.length} 張截圖，儲存時將自動上載`);
      } else {
        // Direct upload mode (editing existing record)
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
      }
    };

    const handleDeleteSaved = async (photoId: number) => {
      try {
        if (type === "running") await deleteRunning.mutateAsync({ photoId });
        else await deleteSteps.mutateAsync({ photoId });
        toast.success("已刪除截圖");
      } catch {
        toast.error("刪除失敗");
      }
    };

    const handleRemoveStaged = (index: number) => {
      setStaged(prev => {
        URL.revokeObjectURL(prev[index].previewUrl);
        return prev.filter((_, i) => i !== index);
      });
    };

    const allPhotos: { id?: number; url: string; staged?: boolean; stagedIndex?: number }[] = [
      ...(savedPhotos as any[]).map((p: any) => ({ id: p.id, url: p.photoUrl })),
      ...staged.map((s, i) => ({ url: s.previewUrl, staged: true, stagedIndex: i })),
    ];

    if (compact && logId != null) {
      // Compact mode: just show thumbnail count for table rows
      if (savedPhotos.length === 0) return null;
      return (
        <div className="flex gap-1 flex-wrap">
          {(savedPhotos as any[]).slice(0, 3).map((p: any) => (
            <img
              key={p.id}
              src={p.photoUrl}
              alt="截圖"
              className="w-8 h-8 rounded object-cover border border-border cursor-pointer"
              onClick={() => setLightbox(p.photoUrl)}
              loading="lazy"
            />
          ))}
          {savedPhotos.length > 3 && (
            <span className="text-xs text-muted-foreground self-center">+{savedPhotos.length - 3}</span>
          )}
          <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
            <DialogContent className="max-w-3xl p-2 bg-black/90 border-border">
              {lightbox && <img src={lightbox} alt="截圖預覽" className="w-full h-auto max-h-[80vh] object-contain rounded" />}
            </DialogContent>
          </Dialog>
        </div>
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
            {uploading ? "上載中..." : "選擇截圖"}
          </Button>
          {allPhotos.length > 0 && (
            <span className="text-xs text-muted-foreground">{allPhotos.length} 張</span>
          )}
          {staged.length > 0 && logId == null && (
            <span className="text-xs text-amber-600 font-medium">儲存後自動上載</span>
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
        {allPhotos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {allPhotos.map((photo, idx) => (
              <div
                key={photo.id ?? `staged-${photo.stagedIndex}`}
                className={`relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted flex-shrink-0 ${photo.staged ? "border-amber-400 border-dashed" : "border-border"}`}
              >
                <img
                  src={photo.url}
                  alt="截圖"
                  className="w-full h-full object-cover cursor-pointer transition-opacity group-hover:opacity-80"
                  onClick={() => setLightbox(photo.url)}
                  loading="lazy"
                />
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => setLightbox(photo.url)}
                >
                  <ZoomIn className="w-4 h-4 text-white drop-shadow" />
                </div>
                <button
                  type="button"
                  onClick={() => photo.staged ? handleRemoveStaged(photo.stagedIndex!) : handleDeleteSaved(photo.id!)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
                {photo.staged && (
                  <div className="absolute bottom-0 left-0 right-0 bg-amber-500/80 text-white text-[8px] text-center leading-tight py-0.5">待上載</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        <Dialog open={!!lightbox} onOpenChange={() => setLightbox(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/90 border-border">
            {lightbox && (
              <img src={lightbox} alt="截圖預覽" className="w-full h-auto max-h-[80vh] object-contain rounded" />
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }
);

LogPhotoUploader.displayName = "LogPhotoUploader";
export default LogPhotoUploader;
