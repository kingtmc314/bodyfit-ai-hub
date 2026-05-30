import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Upload, FileText, CheckCircle2, AlertCircle, Info,
  Activity, Moon, Heart, Scale, ChevronRight
} from "lucide-react";

type DataType = "body" | "sleep" | "heartrate" | "workout";

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
};

const TYPE_LABELS: Record<string, string> = {
  body: "Body Composition",
  sleep: "Sleep",
  heartrate: "Heart Rate",
  workout: "Workout",
};

export default function Import() {
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

  const effectiveType = (previewResult?.detectedType ?? (dataType !== "auto" ? dataType : null)) as DataType | null;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import Health Data</h1>
        <p className="text-muted-foreground mt-1">
          Bulk import CSV files from Garmin Connect or Apple Health into Supabase.
        </p>
      </div>

      {/* Format Guide */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" />
            Supported Formats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              {previewResult.detectedType && (
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
                        <>Importing... <Progress className="w-16 h-1.5" value={undefined} /></>
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
