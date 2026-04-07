import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, autoMapColumns, applyMapping } from "@/lib/excel-parser";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileText, Image, File, X, Loader2, CheckCircle, Send,
  ArrowRight, Building2, Cog, Shield, Table2, Sparkles, AlertTriangle,
  PenLine, RotateCcw,
} from "lucide-react";
import AIReviewStep, { classifyAssetLicense, type ExtractedAsset, type AIReviewData } from "@/components/client/AIReviewStep";
import logo from "@/assets/logo.png";

// ── Types ──
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  rawFile?: File;
}

type PageState = "form" | "analyzing" | "review" | "extraction_failed" | "processing" | "done";

const ASSET_TYPES = [
  { key: "real_estate", label: "عقار", icon: Building2, desc: "أراضٍ، مباني، شقق، فلل" },
  { key: "machinery_equipment", label: "آلات ومعدات", icon: Cog, desc: "معدات صناعية، أجهزة، مركبات، أثاث" },
  { key: "both", label: "عقار + آلات ومعدات", icon: Sparkles, desc: "تقييم مختلط يشمل كلا النوعين" },
] as const;

const ASSET_TYPE_MAP: Record<string, typeof ASSET_TYPES[number]> = Object.fromEntries(
  ASSET_TYPES.map(t => [t.key, t])
);

export default function SimpleClientRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<PageState>("form");

  // Form fields
  const [notes, setNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI detection state
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState<number>(0);
  const [detectionReason, setDetectionReason] = useState<string>("");

  // User confirmation state
  const [confirmedType, setConfirmedType] = useState<string | null>(null);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [detectionFailed, setDetectionFailed] = useState(false);

  // AI Review step data
  const [reviewData, setReviewData] = useState<AIReviewData | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisLabel, setAnalysisLabel] = useState("");
  const [extractionFailureReason, setExtractionFailureReason] = useState("");
  const [analysisLabel, setAnalysisLabel] = useState("");

  // Processing / Done
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
    };
    checkAuth();
  }, [navigate]);

  // ── AI Asset Type Detection ──
  const detectAssetType = async (files: UploadedFile[]) => {
    if (files.length === 0) {
      setDetectedType(null);
      setConfirmedType(null);
      setDetectionFailed(false);
      return;
    }
    setDetecting(true);
    setDetectedType(null);
    setConfirmedType(null);
    setShowManualOverride(false);
    setDetectionFailed(false);

    try {
      let excelSample = "";
      const excelFiles = files.filter(f => isExcel(f.type, f.name));
      if (excelFiles.length > 0) {
        for (const uf of excelFiles) {
          if (!uf.rawFile) continue;
          try {
            const result = await parseExcelFile(uf.rawFile);
            for (const sheet of result.sheets) {
              excelSample += `Headers: ${sheet.headers.join(", ")}\n`;
              const sampleRows = sheet.rows.slice(0, 3);
              for (const row of sampleRows) {
                excelSample += `Row: ${Object.values(row).join(", ")}\n`;
              }
            }
          } catch { /* skip */ }
        }
      }

      const { data, error } = await supabase.functions.invoke("classify-asset-type", {
        body: {
          files: files.map(f => ({ name: f.name, mimeType: f.type })),
          excelSample: excelSample || undefined,
        },
      });

      if (error) throw error;

      const type = data.asset_type || "real_estate";
      const confidence = data.confidence || 50;

      setDetectedType(type);
      setDetectionConfidence(confidence);
      setDetectionReason(data.reason_ar || "");

      if (confidence < 30) {
        setDetectionFailed(true);
      }
    } catch (err) {
      console.error("Asset type detection failed:", err);
      setDetectionFailed(true);
      setDetectedType(null);
      setDetectionConfidence(0);
      setDetectionReason("تعذر التحليل التلقائي — يرجى الاختيار يدوياً");
    } finally {
      setDetecting(false);
    }
  };

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      detectAssetType(uploadedFiles);
    } else {
      setDetectedType(null);
      setConfirmedType(null);
      setDetectionConfidence(0);
      setDetectionReason("");
      setDetectionFailed(false);
      setShowManualOverride(false);
    }
  }, [uploadedFiles]);

  const handleConfirmType = () => { if (detectedType) setConfirmedType(detectedType); };
  const handleManualSelect = (type: string) => { setConfirmedType(type); setShowManualOverride(false); };
  const handleResetConfirmation = () => { setConfirmedType(null); setShowManualOverride(false); };

  // ── File helpers ──
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4 text-primary" />;
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
    if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <Table2 className="w-4 h-4 text-emerald-600" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  const formatSize = (b: number) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!user) return;
    setUploading(true);
    const newFiles: UploadedFile[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const { storageKey, originalFilename } = buildSafeStorageObject({ userId: user.id, originalFilename: file.name });
        const { error } = await supabase.storage.from("client-uploads").upload(storageKey, file);
        if (error) {
          toast({ title: `تعذر رفع ${originalFilename}`, description: getUploadErrorMessage(error), variant: "destructive" });
          continue;
        }
        newFiles.push({ id: crypto.randomUUID(), name: originalFilename, size: file.size, type: file.type, path: storageKey, rawFile: file });
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };

  const removeFile = (id: string) => setUploadedFiles(prev => prev.filter(f => f.id !== id));

  const isExcel = (type: string, name: string) =>
    type.includes("sheet") || type.includes("excel") || type.includes("csv") || /\.(xlsx|xls|csv)$/i.test(name);

  const finalAssetType = confirmedType;

  // ── Start AI Analysis (transition form → analyzing → review) ──
  const handleStartAnalysis = async () => {
    if (!finalAssetType || uploadedFiles.length === 0 || !user) return;

    setState("analyzing");
    setAnalysisProgress(10);
    setAnalysisLabel("جارٍ قراءة الملفات...");

    try {
      const assetType = finalAssetType;
      const excelFiles = uploadedFiles.filter(f => isExcel(f.type, f.name));
      const otherFiles = uploadedFiles.filter(f => !isExcel(f.type, f.name));
      let assetInventory: ExtractedAsset[] = [];
      let idCounter = 1;

      // Parse Excel files
      if (excelFiles.length > 0) {
        setAnalysisLabel("جارٍ قراءة ملفات Excel...");
        setAnalysisProgress(20);
        for (const uf of excelFiles) {
          if (!uf.rawFile) continue;
          try {
            const result = await parseExcelFile(uf.rawFile);
            for (const sheet of result.sheets) {
              const mappings = autoMapColumns(sheet.headers);
              const mapped = applyMapping(sheet.rows, mappings);
              for (const row of mapped) {
                const hasData = (row.name && row.name !== `أصل ${row._rowIndex}`) || row.value || row.type;
                if (!hasData && !row.quantity) continue;
                assetInventory.push({
                  id: idCounter++,
                  name: String(row.name || `أصل ${assetInventory.length + 1}`),
                  type: assetType,
                  category: row.type ? String(row.type) : null,
                  quantity: Number(row.quantity) || 1,
                  condition: row.condition ? String(row.condition) : "unknown",
                  confidence: mappings.filter(m => m.autoMapped).length >= 2 ? 80 : 50,
                  source: `${uf.name} → ${sheet.name}`,
                  license_status: "permitted",
                });
              }
            }
          } catch { /* skip broken files */ }
        }
      }

      setAnalysisProgress(50);
      setAnalysisLabel("جارٍ تحليل المستندات بالذكاء الاصطناعي...");

      // AI orchestrator for non-Excel files
      if (otherFiles.length > 0) {
        try {
          const { data: jobData } = await supabase.functions.invoke("asset-extraction-orchestrator", {
            body: {
              action: "create",
              userId: user.id,
              files: otherFiles.map(f => ({ name: f.name, path: f.path, size: f.size, mimeType: f.type })),
            },
          });
          // If AI extracted assets from documents, add them
          if (jobData?.assets && Array.isArray(jobData.assets)) {
            for (const a of jobData.assets) {
              assetInventory.push({
                id: idCounter++,
                name: a.name || `أصل ${idCounter}`,
                type: assetType,
                category: a.category || null,
                quantity: a.quantity || 1,
                condition: a.condition || "unknown",
                confidence: a.confidence || 60,
                source: a.source || "تحليل مستندات",
                license_status: "permitted",
              });
            }
          }
        } catch { /* AI extraction is optional */ }
      }

      setAnalysisProgress(80);
      setAnalysisLabel("جارٍ تصنيف الأصول وفحص الترخيص...");

      // If no assets extracted, add a placeholder
      if (assetInventory.length === 0) {
        assetInventory.push({
          id: 1,
          name: "طلب تقييم (بدون جرد تفصيلي)",
          type: assetType,
          category: assetType === "real_estate" ? "عقار" : assetType === "machinery_equipment" ? "معدات" : "مختلط",
          quantity: 1,
          condition: "unknown",
          confidence: 100,
          source: "إدخال يدوي",
          license_status: "permitted",
        });
      }

      // Classify each asset for license compliance
      assetInventory = assetInventory.map(classifyAssetLicense);

      setAnalysisProgress(100);
      setAnalysisLabel("اكتمل التحليل!");

      await new Promise(r => setTimeout(r, 400));

      // Build review data
      setReviewData({
        detectedType: detectedType || assetType,
        confirmedType: assetType,
        confidence: detectionConfidence,
        assets: assetInventory,
        totalFiles: uploadedFiles.length,
      });

      setState("review");
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast({ title: "خطأ في التحليل", description: err.message, variant: "destructive" });
      setState("form");
    }
  };

  // ── Final Submit (after review approval) ──
  const handleReviewApprove = async (approvedAssets: ExtractedAsset[], reviewNotes: string) => {
    if (!user || !finalAssetType) return;

    setSubmitting(true);
    setState("processing");
    setProcessingProgress(20);
    setProcessingLabel("جارٍ إنشاء الطلب...");

    try {
      const assetType = finalAssetType;
      const wasManuallyOverridden = detectedType !== confirmedType;

      const aiClassification = {
        ai_detected_asset_type: detectedType,
        user_confirmed_asset_type: confirmedType,
        was_manually_overridden: wasManuallyOverridden,
        detection_failed: detectionFailed,
        confidence: detectionConfidence,
        reason: detectionReason,
      };

      // All assets (for record keeping)
      const allAssets = reviewData?.assets || [];
      const supportedAssets = approvedAssets;
      const unsupportedAssets = allAssets.filter(a => a.license_status === "not_permitted");
      const reviewRequiredAssets = allAssets.filter(a => a.license_status === "needs_review");

      const assetData = {
        discipline: assetType,
        inventory: supportedAssets.map((a, i) => ({ id: i + 1, ...a })),
        summary: {
          total: supportedAssets.length,
          by_type: { [assetType]: supportedAssets.length },
          unsupported_count: unsupportedAssets.length,
          review_required_count: reviewRequiredAssets.length,
        },
        ai_classification: aiClassification,
        supported_assets: supportedAssets,
        unsupported_assets: unsupportedAssets,
        review_required_assets: reviewRequiredAssets,
        user_review_completed: true,
      };

      setProcessingProgress(50);
      setProcessingLabel("جارٍ حفظ الطلب...");

      const combinedNotes = [notes, reviewNotes].filter(Boolean).join("\n---\n");

      const { data: reqData, error: reqError } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (assetType === "machinery_equipment" ? "machinery" : assetType === "both" ? "mixed" : assetType) as any,
          property_description_ar: combinedNotes || null,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            files: uploadedFiles.map(f => ({ name: f.name, path: f.path, type: f.type })),
            totalAssets: supportedAssets.length,
            unsupportedAssets: unsupportedAssets.length,
            simplified: true,
            quick_request: true,
            ai_asset_type_detection: aiClassification,
            user_review_completed: true,
          },
          asset_data: assetData,
        } as any)
        .select()
        .single();

      if (reqError) throw reqError;

      const newRequestId = (reqData as any)?.id;

      setProcessingProgress(70);
      setProcessingLabel("جارٍ ربط المستندات...");

      // Link documents
      if (uploadedFiles.length > 0 && newRequestId) {
        const docs = uploadedFiles.map(f => ({
          request_id: newRequestId,
          uploaded_by: user.id,
          file_name: f.name,
          file_path: f.path,
          file_size: f.size,
          mime_type: f.type,
        }));
        await supabase.from("request_documents" as any).insert(docs);
      }

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "create" as any,
        table_name: "valuation_requests",
        record_id: newRequestId,
        description: `طلب تقييم جديد | نوع: ${assetType} | أصول مشمولة: ${supportedAssets.length} | مستبعدة: ${unsupportedAssets.length} | تصنيف AI: ${detectedType || "فشل"} → مؤكد: ${confirmedType}${wasManuallyOverridden ? " (تعديل يدوي)" : ""}`,
        new_data: {
          ai_classification: aiClassification,
          supported_count: supportedAssets.length,
          unsupported_count: unsupportedAssets.length,
          review_required_count: reviewRequiredAssets.length,
          user_review_completed: true,
        } as any,
        user_role: "client",
      });

      // Fire-and-forget notification
      supabase.functions.invoke("send-notification", {
        body: { notification_type: "request_submitted", user_id: user.id, data: { requestId: newRequestId } },
      }).catch(() => {});

      setProcessingProgress(100);
      setProcessingLabel("تم إرسال الطلب بنجاح!");
      setRequestId(newRequestId);

      await new Promise(r => setTimeout(r, 600));
      setState("done");
    } catch (err: any) {
      toast({ title: "خطأ في الإرسال", description: err.message, variant: "destructive" });
      setState("review");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackFromReview = () => {
    setState("form");
    setReviewData(null);
  };

  // ── DONE ──
  if (state === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">تم إرسال طلبك بنجاح</h2>
            <p className="text-sm text-muted-foreground">
              سيقوم فريقنا بمراجعة المستندات وإرسال نطاق العمل وعرض السعر تلقائياً.
            </p>
            <div className="space-y-2 pt-2">
              <Button onClick={() => navigate("/client/dashboard")} className="w-full">العودة للوحة التحكم</Button>
              {requestId && (
                <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full">
                  تتبع الطلب
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── PROCESSING ──
  if (state === "processing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">جارٍ إرسال طلبك</h3>
            <p className="text-sm text-muted-foreground">{processingLabel}</p>
          </div>
          <div>
            <Progress value={processingProgress} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">{processingProgress}%</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            <span>يتم التحليل وفقاً للمعايير المهنية المعتمدة</span>
          </div>
        </div>
      </div>
    );
  }

  // ── ANALYZING ──
  if (state === "analyzing") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground mb-1">جارٍ التحليل الذكي</h3>
            <p className="text-sm text-muted-foreground">{analysisLabel}</p>
          </div>
          <div>
            <Progress value={analysisProgress} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">{analysisProgress}%</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-3.5 h-3.5" />
            <span>يتم استخراج الأصول وفحص الترخيص تلقائياً</span>
          </div>
        </div>
      </div>
    );
  }

  // ── REVIEW ──
  if (state === "review" && reviewData) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <header className="bg-card border-b border-border sticky top-0 z-30">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="جساس" className="w-8 h-8" />
              <div>
                <h2 className="text-sm font-bold text-foreground">مراجعة التحليل الذكي</h2>
                <p className="text-[10px] text-muted-foreground">راجع الأصول المستخرجة قبل إرسال الطلب</p>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px]">الخطوة ٢ من ٣</Badge>
          </div>
        </header>

        <div className="max-w-lg mx-auto px-4 py-6">
          <AIReviewStep
            data={reviewData}
            onApprove={handleReviewApprove}
            onBack={handleBackFromReview}
          />
        </div>
      </div>
    );
  }

  // ── helpers for rendering ──
  const confirmedInfo = confirmedType ? ASSET_TYPE_MAP[confirmedType] : null;
  const ConfirmedIcon = confirmedInfo?.icon;

  // ── FORM ──
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2>
              <p className="text-[10px] text-muted-foreground">ارفع الملفات وأكد نوع الأصل</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">الخطوة ١ من ٣</Badge>
            <Button variant="ghost" size="sm" onClick={() => navigate("/client/dashboard")}>
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* ── 1. File Upload ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">المستندات <span className="text-destructive">*</span></p>
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
            <p className="text-sm font-medium text-foreground mb-0.5">
              {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات أو اضغط للاختيار"}
            </p>
            <p className="text-xs text-muted-foreground">Excel • PDF • صور — حتى 20 ميجا</p>
            {uploading && (
              <div className="mt-2 flex items-center justify-center gap-2 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs">جارٍ الرفع...</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && handleFileUpload(e.target.files)}
            accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.doc,.docx,.webp,.tif,.tiff"
          />

          {uploadedFiles.length > 0 && (
            <div className="max-h-[200px] overflow-y-auto space-y-1">
              {uploadedFiles.map(file => (
                <div key={file.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                  </div>
                  <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 2. AI Asset Type Detection & Confirmation ── */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" />
              نوع الأصل
              <Badge variant="secondary" className="text-[10px]">تحديد تلقائي</Badge>
            </p>

            {detecting && (
              <div className="border-2 border-dashed border-primary/30 rounded-xl p-5 text-center bg-primary/5">
                <Loader2 className="w-7 h-7 text-primary animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">جارٍ تحليل الملفات...</p>
                <p className="text-xs text-muted-foreground mt-1">يتم تحديد نوع الأصل تلقائياً بالذكاء الاصطناعي</p>
              </div>
            )}

            {!detecting && confirmedType && confirmedInfo && ConfirmedIcon && (
              <div className="border-2 border-primary rounded-xl p-4 bg-primary/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <ConfirmedIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{confirmedInfo.label}</h4>
                      <Badge variant="default" className="text-[10px]">مؤكد ✓</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{confirmedInfo.desc}</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-primary shrink-0" />
                </div>
                <div className="mt-3 flex justify-end">
                  <button onClick={handleResetConfirmation} className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <RotateCcw className="w-3 h-3" /> تغيير
                  </button>
                </div>
              </div>
            )}

            {!detecting && !confirmedType && detectedType && !detectionFailed && (
              <div className="space-y-3">
                {(() => {
                  const info = ASSET_TYPE_MAP[detectedType];
                  const Icon = info?.icon;
                  if (!info || !Icon) return null;
                  return (
                    <div className="border-2 border-border rounded-xl p-4 bg-muted/30">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground mb-0.5">تم التعرف على نوع الأصل:</p>
                          <h4 className="font-bold text-sm text-foreground">{info.label}</h4>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{info.desc}</p>
                          {detectionReason && <p className="text-[10px] text-muted-foreground/70 mt-1">{detectionReason}</p>}
                        </div>
                        <Badge variant={detectionConfidence >= 70 ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {detectionConfidence}%
                        </Badge>
                      </div>
                      {detectionConfidence < 60 && (
                        <div className="mt-3 flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                          <p className="text-[10px] text-destructive">ثقة التصنيف منخفضة — يرجى التحقق وتأكيد النوع الصحيح</p>
                        </div>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" className="flex-1 gap-1.5" onClick={handleConfirmType}>
                          <CheckCircle className="w-3.5 h-3.5" /> تأكيد
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowManualOverride(true)}>
                          <PenLine className="w-3.5 h-3.5" /> تعديل
                        </Button>
                      </div>
                    </div>
                  );
                })()}
                {showManualOverride && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">اختر النوع الصحيح:</p>
                    <div className="grid grid-cols-3 gap-2">
                      {ASSET_TYPES.map(t => {
                        const Icon = t.icon;
                        return (
                          <button key={t.key} onClick={() => handleManualSelect(t.key)}
                            className="border-2 border-border rounded-lg p-3 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                            <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center mx-auto mb-1.5">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <p className="text-[11px] font-semibold text-foreground">{t.label}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!detecting && !confirmedType && detectionFailed && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-destructive/30 rounded-xl p-4 text-center bg-destructive/5">
                  <AlertTriangle className="w-7 h-7 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">تعذر التحديد التلقائي</p>
                  <p className="text-xs text-muted-foreground mt-1">يرجى اختيار نوع الأصل يدوياً</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ASSET_TYPES.map(t => {
                    const Icon = t.icon;
                    return (
                      <button key={t.key} onClick={() => handleManualSelect(t.key)}
                        className="border-2 border-border rounded-lg p-3 text-center hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center mx-auto mb-1.5">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <p className="text-[11px] font-semibold text-foreground">{t.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Notes (optional) ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">ملاحظات <Badge variant="secondary" className="text-[10px] mr-1">اختياري</Badge></p>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="أي تفاصيل إضافية تود مشاركتها مع فريق التقييم..."
            rows={3}
          />
        </div>

        {/* ── Next: Go to AI Review ── */}
        <Button
          onClick={handleStartAnalysis}
          className="w-full gap-2"
          size="lg"
          disabled={uploadedFiles.length === 0 || uploading || detecting || !confirmedType}
        >
          <Sparkles className="w-4 h-4" />
          متابعة — تحليل الملفات ومراجعة الجرد
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          سيتم تحليل ملفاتك واستخراج قائمة الأصول لمراجعتها قبل إرسال الطلب النهائي.
          <br />لن يتم إنشاء الطلب إلا بعد اعتمادك للتحليل.
        </p>
      </div>
    </div>
  );
}
