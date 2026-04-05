import { useState, useCallback, useRef } from "react";
import TopBar from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import {
  FileText, Loader2, X, Upload,
  File, Image as ImageIcon, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Brain,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type FileStatus = "pending" | "uploading" | "uploaded" | "error";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  storagePath?: string;
}

type Phase = "idle" | "uploading" | "processing" | "review";

interface ExtractedAsset {
  id: string;
  name: string;
  type: string;
  quantity: number;
  specs: string;
  condition: string;
  confidence: number;
  source_file: string;
  flagged: boolean;
}

export default function ValuationWorkspacePage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [assets, setAssets] = useState<ExtractedAsset[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [aiAlerts, setAiAlerts] = useState<string[]>([]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].includes(ext || "")) return ImageIcon;
    if (["xls", "xlsx", "csv"].includes(ext || "")) return FileSpreadsheet;
    return File;
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: UploadedFile[] = Array.from(fileList).map(f => ({
      file: f, name: f.name, size: f.size, status: "pending",
    }));
    setFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const startProcessing = async () => {
    if (files.length === 0) return;
    setPhase("uploading");
    setProgress(0);

    const total = files.length;
    const uploaded: string[] = [];

    for (let i = 0; i < total; i++) {
      const f = files[i];
      setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p));

      const path = `intake/${crypto.randomUUID()}/${f.name}`;
      const { error } = await supabase.storage
        .from("valuation-files")
        .upload(path, f.file, { upsert: true });

      if (error) {
        setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "error" } : p));
      } else {
        uploaded.push(path);
        setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploaded", storagePath: path } : p));
      }
      setProgress(Math.round(((i + 1) / total) * 100));
    }

    if (uploaded.length === 0) {
      toast.error("فشل رفع جميع الملفات");
      setPhase("idle");
      return;
    }

    // Trigger AI extraction
    setPhase("processing");
    setProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke("asset-extraction-orchestrator", {
        body: { file_paths: uploaded, assignment_id: null },
      });

      if (error) throw error;

      setJobId(data?.job_id || null);
      // Poll for results
      await pollForResults(data?.job_id);
    } catch (err: any) {
      toast.error("خطأ في المعالجة: " + (err.message || ""));
      setPhase("idle");
    }
  };

  const pollForResults = async (jid: string) => {
    if (!jid) { setPhase("idle"); return; }
    
    let attempts = 0;
    const maxAttempts = 60;

    const poll = async () => {
      const { data } = await supabase
        .from("processing_jobs")
        .select("status, result_summary")
        .eq("id", jid)
        .single();

      if (!data) return;

      if (data.status === "completed") {
        // Fetch extracted assets
        const { data: assetRows } = await supabase
          .from("extracted_assets")
          .select("*")
          .eq("job_id", jid)
          .order("asset_index");

        const mapped: ExtractedAsset[] = (assetRows || []).map((a: any) => ({
          id: a.id,
          name: a.name,
          type: a.asset_type || a.category || "-",
          quantity: a.quantity || 1,
          specs: a.description || "-",
          condition: a.condition || "-",
          confidence: Math.round((a.confidence || 0) * 100),
          source_file: Array.isArray(a.source_files) ? (a.source_files[0]?.file_name || "-") : "-",
          flagged: (a.confidence || 0) < 0.7 || (a.missing_fields?.length || 0) > 0,
        }));

        setAssets(mapped);
        const flaggedCount = mapped.filter(a => a.flagged).length;
        const alerts: string[] = [];
        if (flaggedCount > 0) alerts.push(`${flaggedCount} أصل يحتاج مراجعة`);
        if (mapped.length === 0) alerts.push("لم يتم استخراج أي أصول");
        setAiAlerts(alerts);
        setPhase("review");
        return;
      }

      if (data.status === "failed") {
        toast.error("فشلت عملية الاستخراج");
        setPhase("idle");
        return;
      }

      attempts++;
      if (attempts < maxAttempts) {
        setProgress(Math.min(95, Math.round((attempts / maxAttempts) * 100)));
        setTimeout(poll, 3000);
      } else {
        toast.error("انتهت مهلة المعالجة");
        setPhase("idle");
      }
    };

    await poll();
  };

  const approveAll = () => {
    toast.success(`تم اعتماد ${assets.length} أصل`);
  };

  const deleteAsset = (id: string) => {
    setAssets(prev => prev.filter(a => a.id !== id));
  };

  const confidenceBadge = (score: number) => {
    if (score >= 80) return <Badge variant="default" className="bg-green-600 text-[10px] px-1.5">{score}%</Badge>;
    if (score >= 60) return <Badge variant="secondary" className="bg-yellow-500 text-white text-[10px] px-1.5">{score}%</Badge>;
    return <Badge variant="destructive" className="text-[10px] px-1.5">{score}%</Badge>;
  };

  return (
    <div>
      <TopBar title="مساحة العمل" showBack />

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        {/* ── Files Section ── */}
        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">الملفات</h2>
            {phase === "idle" && files.length > 0 && (
              <Button size="sm" onClick={startProcessing} className="text-xs h-8 gap-1.5">
                <Brain className="w-3.5 h-3.5" />
                بدء الاستخراج
              </Button>
            )}
          </div>

          {/* Drop zone */}
          {phase === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
                ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">اسحب الملفات هنا أو اضغط للاختيار</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">PDF, Excel, صور, ZIP — حتى 500 ملف</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff,.zip,.rar"
              />
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="mt-3 space-y-1 max-h-40 overflow-y-auto">
              {files.map((f, i) => {
                const Icon = getIcon(f.name);
                return (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 text-xs">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate text-foreground">{f.name}</span>
                    <span className="text-muted-foreground text-[10px]">{formatSize(f.size)}</span>
                    {f.status === "uploaded" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                    {f.status === "uploading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                    {f.status === "error" && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    {phase === "idle" && (
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Progress */}
          {(phase === "uploading" || phase === "processing") && (
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">
                  {phase === "uploading" ? "جاري الرفع..." : "الذكاء الاصطناعي يعالج الملفات..."}
                </span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}
        </div>

        {/* ── AI Alerts ── */}
        {aiAlerts.length > 0 && phase === "review" && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              {aiAlerts.map((a, i) => (
                <p key={i} className="text-xs text-warning font-medium">{a}</p>
              ))}
            </div>
          </div>
        )}

        {/* ── Extracted Assets Table ── */}
        {phase === "review" && assets.length > 0 && (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                الأصول المستخرجة ({assets.length})
              </h2>
              <Button size="sm" onClick={approveAll} className="text-xs h-8 gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                اعتماد الكل
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-3 py-2 text-right font-medium">الأصل</th>
                    <th className="px-3 py-2 text-right font-medium">النوع</th>
                    <th className="px-3 py-2 text-center font-medium">العدد</th>
                    <th className="px-3 py-2 text-right font-medium">المواصفات</th>
                    <th className="px-3 py-2 text-center font-medium">الحالة</th>
                    <th className="px-3 py-2 text-center font-medium">الثقة</th>
                    <th className="px-3 py-2 text-right font-medium">المصدر</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr
                      key={asset.id}
                      className={`border-t border-border hover:bg-muted/30 transition-colors
                        ${asset.flagged ? "bg-destructive/5" : ""}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{asset.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{asset.type}</td>
                      <td className="px-3 py-2 text-center">{asset.quantity}</td>
                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{asset.specs}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{asset.condition}</td>
                      <td className="px-3 py-2 text-center">{confidenceBadge(asset.confidence)}</td>
                      <td className="px-3 py-2 text-muted-foreground truncate max-w-[120px]">{asset.source_file}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => deleteAsset(asset.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {phase === "idle" && files.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">ارفع الملفات لبدء استخراج الأصول تلقائياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
