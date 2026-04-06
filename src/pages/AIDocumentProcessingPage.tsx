import { useState, useCallback, useRef } from "react";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import TopBar from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import {
  Brain, FileText, FolderUp, Loader2, X,
  File, Image as ImageIcon, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ProcessingStatusTracker from "@/components/client/ProcessingStatusTracker";
import AssetReviewWorkspace from "@/components/client/AssetReviewWorkspace";
import ExcelAssetUploader from "@/components/client/ExcelAssetUploader";

type FileStatus = "pending" | "uploading" | "uploaded" | "error";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  errorMsg?: string;
  storagePath?: string;
}

type PageStep = "upload" | "processing" | "review";
type UploadMode = "files" | "excel";

export default function AIDocumentProcessingPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [step, setStep] = useState<PageStep>("upload");
  const [jobId, setJobId] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<UploadMode>("files");
  const [excelAssets, setExcelAssets] = useState<Record<string, any>[] | null>(null);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map(f => ({
      file: f, name: f.name, size: f.size, status: "pending" as FileStatus,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].includes(ext || "")) return ImageIcon;
    if (ext === "pdf") return FileText;
    if (["doc", "docx"].includes(ext || "")) return FileText;
    if (["xls", "xlsx"].includes(ext || "")) return FileSpreadsheet;
    return File;
  };

  // ── Upload files then create orchestration job ──
  const startProcessing = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      toast.error("يجب رفع ملف واحد على الأقل");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { toast.error("يرجى تسجيل الدخول أولاً"); return; }

      const batchId = `batch_${Date.now()}`;
      const uploadedMeta: { name: string; path: string; size: number; mimeType: string }[] = [];

      // Upload files to storage
      for (let i = 0; i < uploadedFiles.length; i++) {
        const uf = uploadedFiles[i];
        setUploadedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploading" } : f));
        const { storageKey } = buildSafeStorageObject({ userId, originalFilename: uf.name, prefix: `batch/${batchId}` });
        const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(storageKey, uf.file);

        if (uploadErr) {
          setUploadedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "error", errorMsg: getUploadErrorMessage(uploadErr) } : f));
        } else {
          uploadedMeta.push({ name: uf.name, path: storageKey, size: uf.size, mimeType: uf.file.type });
          setUploadedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: "uploaded", storagePath: storageKey } : f));
        }
        setUploadProgress(((i + 1) / uploadedFiles.length) * 80);
      }

      if (uploadedMeta.length === 0) {
        toast.error("فشل رفع جميع الملفات");
        return;
      }

      // Create orchestration job
      setUploadProgress(90);
      const { data, error } = await supabase.functions.invoke("asset-extraction-orchestrator", {
        body: {
          action: "create",
          userId,
          files: uploadedMeta,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setUploadProgress(100);
      setJobId(data.jobId);
      setStep("processing");
      toast.success(`تم بدء معالجة ${uploadedMeta.length} ملف`);
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء بدء المعالجة");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [uploadedFiles]);

  const handleProcessingReady = useCallback((readyJobId: string) => {
    setJobId(readyJobId);
    setStep("review");
  }, []);

  const handleExcelAssetsReady = useCallback(async (assets: Record<string, any>[], fileName: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) { toast.error("يرجى تسجيل الدخول أولاً"); return; }

      // Create a processing job with excel source
      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          user_id: userId,
          status: "completed",
          total_files: 1,
          processed_files: 1,
          current_message: `تم استيراد ${assets.length} أصل من ${fileName}`,
          file_manifest: [{ name: fileName, path: "excel-import", size: 0, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", status: "processed" }],
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

      if (jobErr) throw jobErr;

      // Insert extracted assets
      const assetRows = assets.map((a, idx) => ({
        job_id: job.id,
        name: a.name || `أصل ${idx + 1}`,
        asset_type: a.type || "equipment",
        category: a.type || null,
        description: a.description || null,
        quantity: Number(a.quantity) || 1,
        condition: a.condition || "unknown",
        confidence: 0.9,
        asset_data: {
          model: a.model || null,
          serial_number: a.serial_number || null,
          manufacturer: a.manufacturer || null,
          year: a.year || null,
          location: a.location || null,
          value: a.value || null,
          source: "excel_import",
        },
        source_files: [{ name: fileName, source: "excel" }],
        source_evidence: `استيراد من ملف Excel: ${fileName}`,
        review_status: "pending",
        asset_index: idx,
      }));

      const { error: insertErr } = await supabase.from("extracted_assets").insert(assetRows);
      if (insertErr) throw insertErr;

      setJobId(job.id);
      setStep("review");
      toast.success(`تم استيراد ${assets.length} أصل من Excel بنجاح`);
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء حفظ الأصول");
    }
  }, []);

  const handleSubmitReview = useCallback(async (assets: any[], discipline: string, description: string) => {
    navigate("/scope-and-pricing", {
      state: {
        extractedData: {
          discipline,
          description,
          inventory: assets.filter(a => a.review_status !== "rejected"),
          summary: { total: assets.length },
        },
        jobId,
      },
    });
  }, [navigate, jobId]);

  // ── UPLOAD STEP ──
  if (step === "upload") {
    return (
      <div className={embedded ? "" : "min-h-screen"}>
        {!embedded && <TopBar />}
        <div className={embedded ? "space-y-6" : "p-6 max-w-4xl mx-auto space-y-6"}>
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto shadow-lg">
              <Brain className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">محرك الاستخراج الذكي</h1>
            <p className="text-sm text-muted-foreground max-w-lg mx-auto">
              ارفع جميع المستندات والصور — سيقوم الذكاء الاصطناعي باستخراج وجرد الأصول تلقائياً
            </p>
          </div>

          {/* Upload mode selector */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant={uploadMode === "files" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("files")}
              className="gap-1.5"
            >
              <FolderUp className="w-4 h-4" />
              مستندات وصور
            </Button>
            <Button
              variant={uploadMode === "excel" ? "default" : "outline"}
              size="sm"
              onClick={() => setUploadMode("excel")}
              className="gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              استيراد من Excel
            </Button>
          </div>

          {/* Excel mode */}
          {uploadMode === "excel" && (
            <ExcelAssetUploader
              onAssetsReady={handleExcelAssetsReady}
              onCancel={() => setUploadMode("files")}
            />
          )}

          {/* Files mode — Drop zone */}
          {uploadMode === "files" && (
          <>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
              ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.tif,.tiff,.webp,.zip,.rar"
              onChange={e => handleFilesSelected(e.target.files)}
            />
            <FolderUp className={`w-12 h-12 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground/50"}`} />
            <p className="text-base font-medium text-foreground mb-1">اسحب الملفات هنا أو انقر للاختيار</p>
            <p className="text-xs text-muted-foreground">PDF • صور • Word • Excel (XLSX, CSV) • ZIP — حتى 500 ملف</p>
          </div>

          {/* File list */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{uploadedFiles.length} ملف</span>
                  <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">+ إضافة المزيد</button>
                </div>
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                  {uploadedFiles.map((f, i) => {
                    const Icon = getFileIcon(f.name);
                    const statusCfg: Record<FileStatus, { icon: any; color: string; label: string }> = {
                      pending: { icon: Upload, color: "text-muted-foreground", label: "جاهز" },
                      uploading: { icon: Loader2, color: "text-primary", label: "جارٍ الرفع..." },
                      uploaded: { icon: CheckCircle2, color: "text-emerald-600", label: "تم" },
                      error: { icon: AlertTriangle, color: "text-destructive", label: f.errorMsg || "فشل" },
                    };
                    const sc = statusCfg[f.status];
                    const StatusIcon = sc.icon;
                    return (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border/50 group hover:bg-muted/20">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-foreground truncate">{f.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground">{formatFileSize(f.size)}</span>
                              <StatusIcon className={`w-3 h-3 ${sc.color} ${f.status === "uploading" ? "animate-spin" : ""}`} />
                            </div>
                          </div>
                        </div>
                        <button onClick={() => removeFile(i)} className="p-1 opacity-0 group-hover:opacity-100 hover:text-destructive text-muted-foreground transition-opacity">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upload progress */}
              {uploading && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">جارٍ رفع الملفات... {Math.round(uploadProgress)}%</p>
                </div>
              )}

              {/* Start button */}
              <Button
                onClick={startProcessing}
                disabled={uploading}
                className="w-full gap-2 py-5 rounded-xl text-sm font-medium shadow-sm"
                size="lg"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الرفع والمعالجة...</>
                ) : (
                  <><Brain className="w-5 h-5" /> بدء الاستخراج الذكي ({uploadedFiles.length} ملف)</>
                )}
              </Button>
            </div>
          )}
          </>
          )}
        </div>
      </div>
    );
  }

  // ── PROCESSING STEP ──
  if (step === "processing") {
    return (
      <div className={embedded ? "" : "min-h-screen"}>
        {!embedded && <TopBar />}
        <div className={embedded ? "space-y-6" : "p-6 max-w-2xl mx-auto space-y-6"}>
          <ProcessingStatusTracker
            jobId={jobId}
            onReady={handleProcessingReady}
            onCancel={() => { setStep("upload"); setJobId(null); }}
          />
        </div>
      </div>
    );
  }

  // ── REVIEW STEP ──
  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && <TopBar />}
      <div className={embedded ? "space-y-6" : "p-6 max-w-6xl mx-auto space-y-6"}>
        {jobId && (
          <AssetReviewWorkspace
            jobId={jobId}
            onSubmit={handleSubmitReview}
            onBack={() => { setStep("upload"); setJobId(null); setUploadedFiles([]); }}
          />
        )}
      </div>
    </div>
  );
}
