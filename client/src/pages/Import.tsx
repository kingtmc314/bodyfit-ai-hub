import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Info,
  Activity, Moon, Heart, Scale, ChevronRight, Image, Utensils,
  Loader2, Eye, Save, RefreshCw, Footprints
} from "lucide-react";

type DataType = "body" | "sleep" | "heartrate" | "workout" | "nutrition" | "running";

const DATA_TYPE_INFO: Record<DataType, { label: string; icon: React.ReactNode; color: string; garminPath: string; columns: string[] }> = {
  body: {
    label: "Body Composition",
    icon: <Scale className="w-4 h-4" />,
    color: "text-blue-400",
    garminPath: "Health Stats → Weight → Export",
    columns: ["Date", "Weight", "BMI", "Body Fat", "Skeletal Muscle Mass", "Bone Mass", "Body Water"],
  },
  sleep: {
    label: "Sleep",
    icon: <Moon className="w-4 h-4" />,
    color: "text-purple-400",
    garminPath: "Health Stats → Sleep → Export",
    columns: ["Date", "Sleep Score", "Duration", "Deep Sleep", "REM Sleep", "Body Battery", "Pulse Ox"],
  },
  heartrate: {
    label: "Heart Rate",
    icon: <Heart className="w-4 h-4" />,
    color: "text-red-400",
    garminPath: "Health Stats → Heart Rate → Export",
    columns: ["Date", "Resting HR", "High HR", "Avg HR", "HRV"],
  },
  workout: {
    label: "Workouts",
    icon: <Activity className="w-4 h-4" />,
    color: "text-green-400",
    garminPath: "Activities → Export to CSV",
    columns: ["Activity Type", "Date", "Time", "Distance", "Calories", "Avg HR", "Max HR"],
  },
  nutrition: {
    label: "Nutrition",
    icon: <Utensils className="w-4 h-4" />,
    color: "text-orange-400",
    garminPath: "MyFitnessPal / Cronometer → Export",
    columns: ["Date", "Calories", "Protein", "Carbs", "Fat", "Fiber", "Meal Type"],
  },
  running: {
    label: "Running (Garmin)",
    icon: <Footprints className="w-4 h-4" />,
    color: "text-amber-500",
    garminPath: "Activities → Filter by Running → Export to CSV",
    columns: ["Activity Type", "Date", "Title", "Distance", "Time", "Avg HR", "Max HR", "Avg Pace", "Best Pace", "Avg Run Cadence", "Avg Stride Length", "Calories"],
  },
};

const TYPE_LABELS: Record<string, string> = {
  body: "Body Composition",
  sleep: "Sleep",
  heartrate: "Heart Rate",
  workout: "Workout",
  nutrition: "Nutrition",
  running: "Running",
};

// ─── CSV Import Component ─────────────────────────────────────────────────────
function CsvImportTab() {
  const [csvText, setCsvText] = useState("");
  const [dataType, setDataType] = useState<DataType | "auto">("auto");
  const [previewResult, setPreviewResult] = useState<{
    detectedType: DataType | null;
    headers: string[];
    preview: Record<string, unknown>[] | null;
    totalRows: number;
    validRows: number;
  } | null>(null);
  const [importResult, setImportResult] = useState<{ inserted: number; skipped: number; total: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = trpc.csvImport.preview.useMutation({
    onSuccess: (data) => {
      setPreviewResult({
        detectedType: data.detectedType as DataType | null,
        headers: data.headers,
        preview: (data.preview ?? []) as Record<string, unknown>[],
        totalRows: data.totalRows,
        validRows: (data as { validRows?: number }).validRows ?? 0,
      });
      if (!data.detectedType) {
        toast.error("Cannot detect data type. Please select manually.");
      } else {
        toast.success(`Detected: ${TYPE_LABELS[data.detectedType]} — ${data.validRows} valid rows found`);
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const importMutation = trpc.csvImport.importData.useMutation({
    onSuccess: (data) => {
      setImportResult(data);
      toast.success(`Import complete! ${data.inserted} rows inserted, ${data.skipped} skipped.`);
    },
    onError: (e) => toast.error(e.message),
  });

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      toast.error("Please upload a CSV file.");
      return;
    }
    if (file.size > 5_000_000) {
      toast.error("File too large (max 5 MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      setPreviewResult(null);
      setImportResult(null);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handlePreview = () => {
    if (!csvText.trim()) { toast.error("Please upload or paste a CSV file first."); return; }
    previewMutation.mutate({ csvText, dataType });
  };

  const handleImport = () => {
    const type = (previewResult?.detectedType ?? (dataType !== "auto" ? dataType : null)) as DataType | null;
    if (!type) { toast.error("Please select a data type first."); return; }
    if (!csvText.trim()) { toast.error("No CSV data to import."); return; }
    importMutation.mutate({ csvText, dataType: type });
  };

  return (
    <div className="space-y-4">
      {/* Format Guide */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            Supported Formats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {(Object.entries(DATA_TYPE_INFO) as [DataType, typeof DATA_TYPE_INFO[DataType]][]).map(([key, info]) => (
              <div key={key} className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className={`flex items-center gap-1.5 font-medium text-sm ${info.color}`}>
                  {info.icon}
                  {info.label}
                </div>
                <p className="text-xs text-muted-foreground">{info.garminPath}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {info.columns.slice(0, 3).map(c => (
                    <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">{c}</Badge>
                  ))}
                  {info.columns.length > 3 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">+{info.columns.length - 3}</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload CSV File</CardTitle>
          <CardDescription>Drag & drop, click to browse, or paste CSV text below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drag & Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-muted/20"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">Drop CSV file here or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Max 5 MB · CSV format only</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          {/* Paste Area */}
          <Tabs defaultValue="file">
            <TabsList className="mb-2">
              <TabsTrigger value="file"><FileText className="w-3 h-3 mr-1" />File Upload</TabsTrigger>
              <TabsTrigger value="paste"><FileText className="w-3 h-3 mr-1" />Paste CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              {csvText && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-sm text-green-400">
                    File loaded — {csvText.split("\n").length - 1} rows detected
                  </span>
                </div>
              )}
            </TabsContent>
            <TabsContent value="paste">
              <Textarea
                placeholder="Paste your CSV data here (including header row)..."
                className="font-mono text-xs h-40 resize-none"
                value={csvText}
                onChange={(e) => { setCsvText(e.target.value); setPreviewResult(null); setImportResult(null); }}
              />
            </TabsContent>
          </Tabs>

          {/* Data Type Selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium shrink-0">Data Type:</label>
            <Select value={dataType} onValueChange={(v) => setDataType(v as DataType | "auto")}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto-detect</SelectItem>
                <SelectItem value="body">Body Composition</SelectItem>
                <SelectItem value="sleep">Sleep</SelectItem>
                <SelectItem value="heartrate">Heart Rate</SelectItem>
                <SelectItem value="workout">Workouts</SelectItem>
                <SelectItem value="nutrition">Nutrition</SelectItem>
                <SelectItem value="running">Running</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={previewMutation.isPending || !csvText}
            >
              {previewMutation.isPending ? "Parsing..." : "Preview"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview Results */}
      {previewResult && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Preview
              </CardTitle>
              {previewResult.detectedType && DATA_TYPE_INFO[previewResult.detectedType] && (
                <Badge className={`${DATA_TYPE_INFO[previewResult.detectedType].color} bg-muted`}>
                  {DATA_TYPE_INFO[previewResult.detectedType].label}
                </Badge>
              )}
            </div>
            <CardDescription>
              {previewResult.validRows} valid rows out of {previewResult.totalRows} total rows
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {previewResult.detectedType === null ? (
              <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="text-sm text-yellow-400">
                  Could not auto-detect data type. Please select manually above and click Preview again.
                </span>
              </div>
            ) : (
              <>
                {/* Preview table */}
                <div className="overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {Object.keys((previewResult.preview ?? [])[0] ?? {}).map((k) => (
                          <th key={k} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(previewResult.preview ?? []).map((row, i) => (
                        <tr key={i} className="border-t border-border/30">
                          {Object.values(row).map((v, j) => (
                            <td key={j} className="px-3 py-2 text-foreground/80 whitespace-nowrap">
                              {v === undefined || v === null ? (
                                <span className="text-muted-foreground/50">—</span>
                              ) : String(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Import button */}
                {!importResult && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">
                      Ready to import <strong className="text-foreground">{previewResult.validRows}</strong> rows into Supabase
                    </p>
                    <Button
                      onClick={handleImport}
                      disabled={importMutation.isPending}
                      className="gap-2"
                    >
                      {importMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" />Importing...</>
                      ) : (
                        <>Import All <ChevronRight className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import Result */}
      {importResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-400">Import Successful!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  <strong className="text-foreground">{importResult.inserted}</strong> rows inserted into Supabase.
                  {importResult.skipped > 0 && (
                    <> <strong className="text-yellow-400">{importResult.skipped}</strong> rows skipped (duplicates or errors).</>
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => { setCsvText(""); setPreviewResult(null); setImportResult(null); }}
                >
                  Import Another File
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Image Import Component ───────────────────────────────────────────────────
type ExtractedData = {
  detectedType: string;
  date: string | null;
  body: { weight: number | null; bmi: number | null; bodyFatPct: number | null; muscleMass: number | null; visceralFat: number | null };
  sleep: { sleepScore: number | null; sleepDuration: number | null; deepSleep: number | null; remSleep: number | null; bodyBattery: number | null; pulseOx: number | null; stress: number | null };
  heartrate: { restingHr: number | null; highHr: number | null; avgHr: number | null; hrv: number | null };
  nutrition: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; fiber: number | null };
  confidence: string;
  notes: string;
  imageUrl: string;
};

function ImageImportTab() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState("image/jpeg");
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [editDate, setEditDate] = useState("");
  const [saveType, setSaveType] = useState<"body" | "sleep" | "heartrate" | "nutrition">("body");
  const [isDragging, setIsDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractMutation = trpc.imageImport.extract.useMutation({
    onSuccess: (data) => {
      setExtracted(data as ExtractedData);
      setEditDate(data.date ?? new Date().toISOString().split("T")[0]);
      const dt = data.detectedType;
      if (dt === "body" || dt === "sleep" || dt === "heartrate" || dt === "nutrition") {
        setSaveType(dt);
      }
      toast.success(`AI extracted data (confidence: ${data.confidence})`);
    },
    onError: (e) => toast.error("Extraction failed: " + e.message),
  });

  const saveMutation = trpc.imageImport.save.useMutation({
    onSuccess: () => {
      setSaved(true);
      toast.success("Data saved to Supabase successfully!");
    },
    onError: (e) => toast.error("Save failed: " + e.message),
  });

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file (JPG, PNG, HEIC, etc.)");
      return;
    }
    if (file.size > 10_000_000) {
      toast.error("Image too large (max 10 MB).");
      return;
    }
    setImageMime(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setImageBase64(base64);
      setExtracted(null);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleExtract = () => {
    if (!imageBase64) { toast.error("Please upload an image first."); return; }
    extractMutation.mutate({ base64: imageBase64, mimeType: imageMime });
  };

  const handleSave = () => {
    if (!extracted || !editDate) return;
    saveMutation.mutate({
      date: editDate,
      dataType: saveType,
      body: extracted.body,
      sleep: extracted.sleep,
      heartrate: extracted.heartrate,
      nutrition: extracted.nutrition,
    });
  };

  const confidenceColor = extracted?.confidence === "high"
    ? "text-green-400 bg-green-500/10 border-green-500/20"
    : extracted?.confidence === "medium"
    ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
    : "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            How Image Import Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 text-xs">1</div>
              <div>
                <p className="font-medium">Upload a screenshot or photo</p>
                <p className="text-muted-foreground text-xs mt-0.5">Garmin Connect, Apple Health, body scale display, sleep tracker app, or any health app screenshot</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 text-xs">2</div>
              <div>
                <p className="font-medium">AI extracts the data</p>
                <p className="text-muted-foreground text-xs mt-0.5">Vision AI reads all visible numbers — weight, HR, sleep score, calories, etc.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0 text-xs">3</div>
              <div>
                <p className="font-medium">Review & save</p>
                <p className="text-muted-foreground text-xs mt-0.5">Verify the extracted values, adjust the date if needed, then save to your database</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload Health Screenshot or Photo</CardTitle>
          <CardDescription>JPG, PNG, HEIC — max 10 MB</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragging ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-muted/20"
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {imagePreview ? (
              <div className="flex flex-col items-center gap-3">
                <img src={imagePreview} alt="Preview" className="max-h-48 max-w-full rounded-lg object-contain border border-border/50" />
                <p className="text-xs text-muted-foreground">Click to change image</p>
              </div>
            ) : (
              <>
                <Image className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">Drop image here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">Supports screenshots from Garmin, Apple Health, body scales, and more</p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
          </div>

          {imagePreview && !extracted && (
            <div className="flex justify-end">
              <Button
                onClick={handleExtract}
                disabled={extractMutation.isPending}
                className="gap-2"
              >
                {extractMutation.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Extracting with AI...</>
                ) : (
                  <><Eye className="w-4 h-4" />Extract Data with AI</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Extracted Results */}
      {extracted && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                Extracted Data
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge className={`text-xs border ${confidenceColor}`}>
                  Confidence: {extracted.confidence}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setExtracted(null); setSaved(false); }}
                  className="h-7 px-2 text-xs gap-1"
                >
                  <RefreshCw className="w-3 h-3" />Re-extract
                </Button>
              </div>
            </div>
            {extracted.notes && (
              <CardDescription>{extracted.notes}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date & Type selectors */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium shrink-0">Date:</label>
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-40 h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium shrink-0">Save as:</label>
                <Select value={saveType} onValueChange={(v) => setSaveType(v as typeof saveType)}>
                  <SelectTrigger className="w-44 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="body">Body Composition</SelectItem>
                    <SelectItem value="sleep">Sleep</SelectItem>
                    <SelectItem value="heartrate">Heart Rate</SelectItem>
                    <SelectItem value="nutrition">Nutrition</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Data preview grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Body */}
              {Object.values(extracted.body).some(v => v !== null) && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1"><Scale className="w-3 h-3" />Body Composition</p>
                  <div className="space-y-1">
                    {extracted.body.weight !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Weight</span><span className="font-medium">{extracted.body.weight} kg</span></div>}
                    {extracted.body.bmi !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">BMI</span><span className="font-medium">{extracted.body.bmi}</span></div>}
                    {extracted.body.bodyFatPct !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Body Fat</span><span className="font-medium">{extracted.body.bodyFatPct}%</span></div>}
                    {extracted.body.muscleMass !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Muscle Mass</span><span className="font-medium">{extracted.body.muscleMass} kg</span></div>}
                    {extracted.body.visceralFat !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Visceral Fat</span><span className="font-medium">{extracted.body.visceralFat}</span></div>}
                  </div>
                </div>
              )}
              {/* Sleep */}
              {Object.values(extracted.sleep).some(v => v !== null) && (
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1"><Moon className="w-3 h-3" />Sleep</p>
                  <div className="space-y-1">
                    {extracted.sleep.sleepScore !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Sleep Score</span><span className="font-medium">{extracted.sleep.sleepScore}</span></div>}
                    {extracted.sleep.sleepDuration !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Duration</span><span className="font-medium">{extracted.sleep.sleepDuration}h</span></div>}
                    {extracted.sleep.deepSleep !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Deep Sleep</span><span className="font-medium">{extracted.sleep.deepSleep}h</span></div>}
                    {extracted.sleep.remSleep !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">REM Sleep</span><span className="font-medium">{extracted.sleep.remSleep}h</span></div>}
                    {extracted.sleep.bodyBattery !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Body Battery</span><span className="font-medium">{extracted.sleep.bodyBattery}</span></div>}
                    {extracted.sleep.pulseOx !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Pulse Ox</span><span className="font-medium">{extracted.sleep.pulseOx}%</span></div>}
                  </div>
                </div>
              )}
              {/* Heart Rate */}
              {Object.values(extracted.heartrate).some(v => v !== null) && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1"><Heart className="w-3 h-3" />Heart Rate</p>
                  <div className="space-y-1">
                    {extracted.heartrate.restingHr !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Resting HR</span><span className="font-medium">{extracted.heartrate.restingHr} bpm</span></div>}
                    {extracted.heartrate.highHr !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">High HR</span><span className="font-medium">{extracted.heartrate.highHr} bpm</span></div>}
                    {extracted.heartrate.avgHr !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Avg HR</span><span className="font-medium">{extracted.heartrate.avgHr} bpm</span></div>}
                    {extracted.heartrate.hrv !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">HRV</span><span className="font-medium">{extracted.heartrate.hrv} ms</span></div>}
                  </div>
                </div>
              )}
              {/* Nutrition */}
              {Object.values(extracted.nutrition).some(v => v !== null) && (
                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                  <p className="text-xs font-semibold text-orange-400 mb-2 flex items-center gap-1"><Utensils className="w-3 h-3" />Nutrition</p>
                  <div className="space-y-1">
                    {extracted.nutrition.calories !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Calories</span><span className="font-medium">{extracted.nutrition.calories} kcal</span></div>}
                    {extracted.nutrition.protein !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Protein</span><span className="font-medium">{extracted.nutrition.protein}g</span></div>}
                    {extracted.nutrition.carbs !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Carbs</span><span className="font-medium">{extracted.nutrition.carbs}g</span></div>}
                    {extracted.nutrition.fat !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Fat</span><span className="font-medium">{extracted.nutrition.fat}g</span></div>}
                    {extracted.nutrition.fiber !== null && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Fiber</span><span className="font-medium">{extracted.nutrition.fiber}g</span></div>}
                  </div>
                </div>
              )}
            </div>

            {/* Save button */}
            {!saved ? (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Saving as <strong className="text-foreground">{TYPE_LABELS[saveType]}</strong> for <strong className="text-foreground">{editDate}</strong>
                </p>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="gap-2"
                >
                  {saveMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" />Save to Supabase</>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-400">Saved successfully!</p>
                  <p className="text-xs text-muted-foreground">Data has been added to your Supabase database.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setImagePreview(null); setImageBase64(null); setExtracted(null); setSaved(false); }}
                >
                  Import Another
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Import Page ─────────────────────────────────────────────────────────
export default function Import() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Health Data</h1>
        <p className="text-muted-foreground mt-1">
          Import data from CSV files, or upload screenshots for AI-powered extraction.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="csv">
        <TabsList className="mb-4">
          <TabsTrigger value="csv" className="gap-2">
            <FileText className="w-4 h-4" />
            CSV Import
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-2">
            <Image className="w-4 h-4" />
            Image Import
            <Badge className="ml-1 text-[10px] px-1 py-0 bg-primary/20 text-primary border-0">AI</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="csv">
          <CsvImportTab />
        </TabsContent>
        <TabsContent value="image">
          <ImageImportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
