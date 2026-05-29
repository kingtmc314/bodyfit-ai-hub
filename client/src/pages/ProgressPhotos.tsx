import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Camera, Upload, Trash2, X, Loader2, Image as ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";

const POSE_OPTIONS = ["front", "back", "side_left", "side_right", "other"];

export default function ProgressPhotos() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState("image/jpeg");
  const [form, setForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), angle: "front", notes: "", weight: "" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: photos = [], isLoading } = trpc.photos.getAll.useQuery();
  const uploadMutation = trpc.photos.upload.useMutation({
    onSuccess: () => { utils.photos.getAll.invalidate(); toast.success("Photo saved!"); setShowUploadDialog(false); resetForm(); },
    onError: () => toast.error("Upload failed"),
  });
  const deleteMutation = trpc.photos.delete.useMutation({
    onSuccess: () => { utils.photos.getAll.invalidate(); toast.success("Deleted"); setShowViewDialog(false); },
  });

  const resetForm = () => { setPhotoPreview(null); setPhotoBase64(null); setForm({ date: format(new Date(), "yyyy-MM-dd"), angle: "front", notes: "", weight: "" }); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setPhotoPreview(result);
      setPhotoBase64(result.split(",")[1]);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = () => {
    if (!photoBase64) return toast.error("Please select a photo");
    uploadMutation.mutate({
      base64: photoBase64,
      mimeType: photoMime,
      date: form.date,
      angle: form.angle as any,
      notes: form.notes || undefined,
      weight: form.weight ? Number(form.weight) : undefined,
    });
  };

  // Group photos by month
  const grouped = photos.reduce((acc: Record<string, typeof photos>, p) => {
    const month = p.date.slice(0, 7);
    if (!acc[month]) acc[month] = [];
    acc[month].push(p);
    return acc;
  }, {});

  const currentIndex = selectedPhoto ? photos.findIndex(p => p.id === selectedPhoto.id) : -1;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Progress Photos</h1>
          <p className="text-muted-foreground text-sm">Visual body composition timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { cameraInputRef.current?.click(); setShowUploadDialog(true); }}>
            <Camera className="w-4 h-4" /> Camera
          </Button>
          <Button size="sm" className="gap-2" onClick={() => { resetForm(); setShowUploadDialog(true); }}>
            <Plus className="w-4 h-4" /> Upload Photo
          </Button>
        </div>
      </div>

      {/* Gallery */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <ImageIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No progress photos yet</p>
          <p className="text-muted-foreground text-sm mt-1">Upload your first photo to start tracking visual progress</p>
          <Button className="mt-4 gap-2" onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4" /> Upload Photo
          </Button>
        </div>
      ) : (
        Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthPhotos]) => (
          <div key={month}>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
              {format(new Date(month + "-01"), "MMMM yyyy")}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {monthPhotos.map(photo => (
                <div key={photo.id} className="group relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer bg-muted/30"
                  onClick={() => { setSelectedPhoto(photo); setShowViewDialog(true); }}>
                  <img src={photo.photoUrl} alt={photo.angle || "progress"} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white text-xs font-medium">{photo.date}</p>
                      {photo.angle && <Badge variant="secondary" className="text-xs mt-1 capitalize">{photo.angle.replace("_", " ")}</Badge>}
                      {photo.weight && <p className="text-white/80 text-xs mt-0.5">{Number(photo.weight).toFixed(1)} kg</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Progress Photo</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!photoPreview ? (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center space-y-3">
                <Camera className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Select or capture a photo</p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" /> Upload
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}>
                    <Camera className="w-4 h-4 mr-2" /> Camera
                  </Button>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              </div>
            ) : (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-xl" />
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 w-7 h-7 bg-black/50 hover:bg-black/70"
                  onClick={() => { setPhotoPreview(null); setPhotoBase64(null); }}>
                  <X className="w-3.5 h-3.5 text-white" />
                </Button>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Pose</label>
                <Select value={form.angle} onValueChange={v => setForm(f => ({ ...f, angle: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSE_OPTIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Weight (kg)</label>
                <Input type="number" step="0.1" placeholder="Optional" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                <Input placeholder="Optional" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowUploadDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending || !photoBase64}>
              {uploadMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          {selectedPhoto && (
            <div className="relative">
              <img src={selectedPhoto.photoUrl} alt="Progress" className="w-full max-h-[70vh] object-contain bg-black" />
              {/* Navigation */}
              {currentIndex > 0 && (
                <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setSelectedPhoto(photos[currentIndex - 1])}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              {currentIndex < photos.length - 1 && (
                <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setSelectedPhoto(photos[currentIndex + 1])}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-white font-medium">{selectedPhoto.date}</p>
                    <div className="flex gap-2 mt-1">
                      {selectedPhoto.angle && <Badge variant="secondary" className="text-xs capitalize">{selectedPhoto.angle.replace("_", " ")}</Badge>}
                      {selectedPhoto.weight && <span className="text-white/80 text-xs">{Number(selectedPhoto.weight).toFixed(1)} kg</span>}
                    </div>
                    {selectedPhoto.notes && <p className="text-white/70 text-xs mt-1">{selectedPhoto.notes}</p>}
                  </div>
                  <Button variant="destructive" size="sm" className="gap-1"
                    onClick={() => deleteMutation.mutate({ id: selectedPhoto.id })}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
