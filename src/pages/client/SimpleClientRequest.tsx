import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, autoMapColumns, applyMapping } from "@/lib/excel-parser";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, FileText, Image, File, X, Loader2, CheckCircle,
  ArrowRight, Building2, Cog, Shield, Table2, Sparkles, AlertTriangle,
  PenLine, RotateCcw, User as UserIcon,
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

// ── Infer individual asset type from name/category keywords ──
const RE_KEYWORDS: Record<string, RegExp> = {
  real_estate: /عقار|أرض|ارض|مبنى|مبنی|فيلا|فلة|شقة|شقق|دوبلكس|بناء|عمارة|برج|مجمع|سكني|تجاري|مستودع|مخزن|أرض خام|محل|معرض|مول|فندق|land|building|villa|apartment|warehouse|hotel/i,
  vehicle: /سيارة|سيارات|مركبة|شاحنة|رافعة شوكية|فورك|لفت|حافلة|باص|دراجة|vehicle|car|truck|forklift|bus|trailer|مقطورة/i,
  furniture: /أثاث|مكتب|كرسي|طاولة|خزانة|رف|أريكة|سرير|furniture|desk|chair|table|cabinet/i,
  it_equipment: /حاسب|كمبيوتر|لابتوب|سيرفر|خادم|شاشة|طابعة|ماسح|راوتر|سويتش|شبكة|computer|laptop|server|printer|scanner|router|switch|monitor/i,
  medical_equipment: /طبي|أشعة|تعقيم|مختبر|جراح|تخدير|أسنان|medical|x-ray|lab|surgical|dental|ultrasound/i,
  hvac: /تكييف|تبريد|تدفئة|مكيف|تهوية|hvac|ac unit|chiller|cooling|heating/i,
  electrical: /كهربائي|محول|مولد|لوحة كهرب|ups|generator|transformer|electrical|panel/i,
};

function inferAssetType(name: string, category: string | null, fallback: string): string {
  const text = `${name} ${category || ""}`.toLowerCase();
  for (const [type, regex] of Object.entries(RE_KEYWORDS)) {
    if (regex.test(text)) return type;
  }
  // If fallback is "both", default to machinery_equipment for non-matched
  return fallback === "both" ? "machinery_equipment" : fallback;
}

const ASSET_TYPES = [
  { key: "real_estate", label: "عقار", icon: Building2, desc: "أراضٍ، مباني، شقق، فلل" },
  { key: "machinery_equipment", label: "آلات ومعدات", icon: Cog, desc: "معدات صناعية، أجهزة، مركبات، أثاث" },
  { key: "both", label: "عقار + آلات ومعدات", icon: Sparkles, desc: "تقييم مختلط يشمل كلا النوعين" },
] as const;

const PURPOSE_OPTIONS: Record<string, string> = {
  sale_purchase: "بيع / شراء",
  mortgage: "رهن / تمويل",
  financial_reporting: "تقارير مالية",
  insurance: "تأمين",
  taxation: "زكاة / ضريبة",
  expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء",
  investment: "استثمار",
  lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي",
  regulatory: "تنظيمي",
  other: "أخرى",
};

const INTENDED_USERS_OPTIONS: Record<string, string> = {
  bank: "بنك / مؤسسة مالية",
  government: "جهة حكومية",
  court: "محكمة",
  internal_management: "إدارة داخلية",
  investor: "مستثمر",
  other: "أخرى",
};

const VALUATION_MODE_OPTIONS: Record<string, string> = {
  field: "ميداني (معاينة ميدانية)",
  desktop: "مكتبي (بدون معاينة)",
};

const ASSET_TYPE_MAP: Record<string, typeof ASSET_TYPES[number]> = Object.fromEntries(
  ASSET_TYPES.map(t => [t.key, t])
);

export default function SimpleClientRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [clientName, setClientName] = useState<string>("");
  const [state, setState] = useState<PageState>("form");

  // Form fields
  const [notes, setNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Client & valuation info
  const [clientNameInput, setClientNameInput] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientIdNumber, setClientIdNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [purposeOther, setPurposeOther] = useState("");
  const [intendedUser, setIntendedUser] = useState("");
  const [intendedUserOther, setIntendedUserOther] = useState("");
  const [valuationMode, setValuationMode] = useState("field");

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

  // Processing / Done
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingLabel, setProcessingLabel] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
      // Fetch client info for pre-filling
      const { data: clientRow } = await supabase
        .from("clients")
        .select("name_ar, phone, email, id_number")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (clientRow?.name_ar) setClientName(clientRow.name_ar);
      if (clientRow?.name_ar) setClientNameInput(clientRow.name_ar);
      if (clientRow?.phone) setClientPhone(clientRow.phone);
      if (clientRow?.email) setClientEmail(clientRow.email);
      if (clientRow?.id_number) setClientIdNumber(clientRow.id_number);
      if (!clientRow?.name_ar) setClientName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
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

  // ── Start AI Analysis (transition form → analyzing → review OR extraction_failed) ──
  const handleStartAnalysis = async () => {
    if (!finalAssetType || uploadedFiles.length === 0 || !user) return;

    setState("analyzing");
    setAnalysisProgress(10);
    setAnalysisLabel("جارٍ قراءة الملفات...");
    setExtractionFailureReason("");

    try {
      const assetType = finalAssetType;
      const excelFiles = uploadedFiles.filter(f => isExcel(f.type, f.name));
      const otherFiles = uploadedFiles.filter(f => !isExcel(f.type, f.name));
      let assetInventory: ExtractedAsset[] = [];
      let idCounter = 1;
      let aiDiscipline = assetType;

      // Parse Excel files locally
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
                const assetName = String(row.name || `أصل ${assetInventory.length + 1}`);
                const assetCat = row.type ? String(row.type) : null;
                assetInventory.push({
                  id: idCounter++,
                  name: assetName,
                  type: inferAssetType(assetName, assetCat, assetType),
                  category: assetCat,
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

      // AI Vision extraction for images/PDFs (synchronous — waits for results)
      if (otherFiles.length > 0) {
        setAnalysisProgress(40);
        setAnalysisLabel("جارٍ تحليل الصور والمستندات بالذكاء الاصطناعي...");

        try {
          const { data: jobData, error: jobError } = await supabase.functions.invoke("asset-extraction-orchestrator", {
            body: {
              action: "create_and_process",
              userId: user.id,
              files: otherFiles.map(f => ({ name: f.name, path: f.path, size: f.size, mimeType: f.type })),
            },
          });

          if (jobError) {
            console.error("Orchestrator error:", jobError);
          } else if (jobData?.assets && Array.isArray(jobData.assets) && jobData.assets.length > 0) {
            for (const a of jobData.assets) {
              const aName = a.name || `أصل ${idCounter}`;
              const aCat = a.category || null;
              assetInventory.push({
                id: idCounter++,
                name: aName,
                type: a.type && a.type !== "both" ? a.type : inferAssetType(aName, aCat, assetType),
                category: aCat,
                quantity: a.quantity || 1,
                condition: a.condition || "unknown",
                confidence: a.confidence || 60,
                source: a.source || "تحليل بصري",
                license_status: "permitted",
              });
            }
            // Use AI-determined discipline if available
            if (jobData.discipline) {
              aiDiscipline = jobData.discipline;
            }
          }
        } catch (err) {
          console.error("AI extraction failed:", err);
        }
      }

      setAnalysisProgress(80);
      setAnalysisLabel("جارٍ تصنيف الأصول وفحص الترخيص...");

      // ── CRITICAL: No phantom assets — if nothing extracted, show failure ──
      if (assetInventory.length === 0) {
        // Log failure in audit
        await supabase.from("audit_logs").insert({
          user_id: user.id,
          action: "create" as any,
          table_name: "valuation_requests",
          description: `فشل استخراج الأصول — ${uploadedFiles.length} ملف — لم يتم التعرف على أي أصول`,
          new_data: {
            action_type: "ai_extraction_failed",
            files_count: uploadedFiles.length,
            file_names: uploadedFiles.map(f => f.name),
            confirmed_type: assetType,
            reason: "zero_assets_extracted",
          } as any,
          user_role: "client",
        });

        setExtractionFailureReason(
          "لم يتمكن النظام من استخراج الأصول من الملفات المرفوعة.\n\nيرجى:\n- رفع صور أوضح\n- أو إضافة مستند يحتوي على تفاصيل الأصول (مثل جدول Excel)"
        );
        setState("extraction_failed");
        return;
      }

      // Reclassify type based on actual extracted content (≥70% rule)
      const meCount = assetInventory.filter(a => a.type === "machinery_equipment").length;
      const reCount = assetInventory.filter(a => a.type === "real_estate").length;
      const total = assetInventory.length;
      let finalDiscipline = aiDiscipline;
      if (meCount / total >= 0.7) finalDiscipline = "machinery_equipment";
      else if (reCount / total >= 0.7) finalDiscipline = "real_estate";
      else if (meCount > 0 && reCount > 0) finalDiscipline = "both";

      // Classify each asset for license compliance
      assetInventory = assetInventory.map(classifyAssetLicense);

      setAnalysisProgress(100);
      setAnalysisLabel("اكتمل التحليل!");

      await new Promise(r => setTimeout(r, 400));

      // Build review data
      setReviewData({
        detectedType: finalDiscipline,
        confirmedType: finalDiscipline,
        confidence: detectionConfidence,
        assets: assetInventory,
        totalFiles: uploadedFiles.length,
        clientName: clientName || undefined,
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
          client_name_ar: clientNameInput || null,
          client_phone: clientPhone || null,
          client_email: clientEmail || null,
          client_id_number: clientIdNumber || null,
          purpose: purpose || null,
          purpose_ar: purpose === "other" ? purposeOther : (purpose ? PURPOSE_OPTIONS[purpose] || null : null),
          intended_users_ar: intendedUser === "other" ? intendedUserOther : (intendedUser ? INTENDED_USERS_OPTIONS[intendedUser] || null : null),
          valuation_mode: valuationMode || "field",
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

  const handleRetryAnalysis = () => {
    setExtractionFailureReason("");
    handleStartAnalysis();
  };

  const handleModifyFiles = () => {
    setState("form");
    setExtractionFailureReason("");
  };

  // ── EXTRACTION FAILED ──
  if (state === "extraction_failed") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground mb-2">تعذر استخراج الأصول</h2>
              <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                {extractionFailureReason || "لم يتمكن النظام من استخراج الأصول من الملفات المرفوعة."}
              </p>
            </div>

            <div className="bg-muted/50 rounded-xl p-4 text-right space-y-2">
              <p className="text-xs font-semibold text-foreground">نصائح لتحسين النتائج:</p>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>ارفع صور واضحة وعالية الجودة للمعدات أو العقارات</li>
                <li>أضف ملف Excel يحتوي على قائمة الأصول مع التفاصيل</li>
                <li>تأكد من أن ملفات PDF ليست مشفرة أو ممسوحة ضوئياً بجودة منخفضة</li>
                <li>استخدم صور مباشرة وليس لقطات شاشة</li>
              </ul>
            </div>

            <div className="space-y-2 pt-1">
              <Button onClick={handleRetryAnalysis} className="w-full gap-2">
                <RotateCcw className="w-4 h-4" />
                إعادة التحليل
              </Button>
              <Button onClick={handleModifyFiles} variant="outline" className="w-full gap-2">
                <Upload className="w-4 h-4" />
                تعديل الملفات
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
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

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <div>
              <h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2>
              <p className="text-[10px] text-muted-foreground">ارفع الملفات وأكد نوع الأصل للبدء</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5">
              {[
                { n: 1, l: "رفع الملفات" },
                { n: 2, l: "مراجعة الجرد" },
                { n: 3, l: "التأكيد" },
              ].map((step, i) => (
                <div key={step.n} className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.n === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>{step.n}</div>
                  <span className={`text-[10px] ${step.n === 1 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                    {step.l}
                  </span>
                  {i < 2 && <div className="w-6 h-px bg-border" />}
                </div>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/client/dashboard")}>
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── العمود الرئيسي: معلومات العميل + رفع الملفات + الملاحظات ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* معلومات العميل والتقييم */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <UserIcon className="w-4 h-4 text-primary" />
                  معلومات العميل والتقييم
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">اسم العميل <span className="text-destructive">*</span></Label>
                    <Input value={clientNameInput} onChange={e => setClientNameInput(e.target.value)}
                      placeholder="الاسم الكامل" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">رقم الهوية / السجل التجاري</Label>
                    <Input value={clientIdNumber} onChange={e => setClientIdNumber(e.target.value)}
                      placeholder="رقم الهوية أو السجل" className="text-sm" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">الجوال</Label>
                    <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
                      placeholder="05xxxxxxxx" className="text-sm" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">البريد الإلكتروني</Label>
                    <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
                      placeholder="email@example.com" className="text-sm" dir="ltr" />
                  </div>
                </div>

                <div className="border-t border-border/50 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">الغرض من التقييم <span className="text-destructive">*</span></Label>
                    <Select value={purpose} onValueChange={(v) => { setPurpose(v); if (v !== "other") setPurposeOther(""); }}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="اختر الغرض" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURPOSE_OPTIONS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {purpose === "other" && (
                      <Input value={purposeOther} onChange={e => setPurposeOther(e.target.value)}
                        placeholder="حدد الغرض..." className="text-sm mt-1.5" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">المستخدم المستهدف</Label>
                    <Select value={intendedUser} onValueChange={(v) => { setIntendedUser(v); if (v !== "other") setIntendedUserOther(""); }}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="اختر المستخدم" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(INTENDED_USERS_OPTIONS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {intendedUser === "other" && (
                      <Input value={intendedUserOther} onChange={e => setIntendedUserOther(e.target.value)}
                        placeholder="حدد المستخدم..." className="text-sm mt-1.5" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">نوع التقييم</Label>
                    <Select value={valuationMode} onValueChange={setValuationMode}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="اختر النوع" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(VALUATION_MODE_OPTIONS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">المستندات <span className="text-destructive">*</span></p>
                  {uploadedFiles.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">{uploadedFiles.length} ملف</Badge>
                  )}
                </div>
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                    dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-12 h-12 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground/30"}`} />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات أو اضغط للاختيار"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">Excel • PDF • صور • مستندات Word — حتى 20 ميجا للملف</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Badge variant="outline" className="text-[10px] gap-1"><Table2 className="w-3 h-3" />جداول الأصول</Badge>
                    <Badge variant="outline" className="text-[10px] gap-1"><FileText className="w-3 h-3" />صكوك وعقود</Badge>
                    <Badge variant="outline" className="text-[10px] gap-1"><Image className="w-3 h-3" />صور</Badge>
                  </div>
                  {uploading && (
                    <div className="mt-4 flex items-center justify-center gap-2 text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs">جارٍ الرفع...</span>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" multiple className="hidden"
                  onChange={e => e.target.files && handleFileUpload(e.target.files)}
                  accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.doc,.docx,.webp,.tif,.tiff"
                />
                {uploadedFiles.length > 0 && (
                  <div className="max-h-[280px] overflow-y-auto space-y-1.5 rounded-lg border border-border/50 p-2">
                    {uploadedFiles.map(file => (
                      <div key={file.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                        {getFileIcon(file.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate">{file.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                        </div>
                        <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm font-semibold text-foreground">ملاحظات <Badge variant="secondary" className="text-[10px] mr-1">اختياري</Badge></p>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="مثال: تقييم لغرض البيع — عدد الأصول 15 — الموقع: جدة، حي الروضة..."
                  rows={3} className="text-sm" />
                <p className="text-[10px] text-muted-foreground">أضف أي معلومات تساعد فريق التقييم: الموقع، حالة الأصول، الغرض من التقييم، إلخ.</p>
              </CardContent>
            </Card>
          </div>

          {/* ── العمود الأيسر: نوع الأصل + زر المتابعة ── */}
          <div className="space-y-5">
            {uploadedFiles.length > 0 ? (
              <Card>
                <CardContent className="p-5 space-y-3">
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
                </CardContent>
              </Card>
            ) : null}

            <Button onClick={handleStartAnalysis} className="w-full gap-2 h-12 text-sm" size="lg"
              disabled={uploadedFiles.length === 0 || uploading || detecting || !confirmedType || !clientNameInput.trim() || !purpose || (purpose === "other" && !purposeOther.trim())}>
              <Sparkles className="w-4 h-4" />
              متابعة — تحليل الملفات ومراجعة الجرد
            </Button>

            {/* نصائح */}
            <Card className="bg-muted/30 border-dashed" dir="rtl">
              <CardContent className="p-4 space-y-4">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>دليل المرفقات لأفضل تقييم</span>
                </p>

                <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>جميع صيغ الملفات مدعومة (Excel, PDF, صور, Word...)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>كلما زادت المرفقات، كان التقييم أدق وأقرب للسعر العادل</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    <span>أرفق الفواتير وبرامج الصيانة وأي وثيقة تخص الأصل</span>
                  </li>
                </ul>

                <div className="border-t border-border/50 pt-4 space-y-2.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Cog className="w-4 h-4 text-primary" />
                    <span>للمعدات والآلات:</span>
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>صور من كل الجوانب + من الداخل</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>صور العدادات ولوحة البيانات (Nameplate)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>فواتير الشراء وبرامج الصيانة</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-2.5">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-primary" />
                    <span>للعقارات:</span>
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>صور الواجهة الخارجية من عدة زوايا</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>صور داخلية: كل الغرف، الحوش، الممرات، المرافق</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>صكوك الملكية وعقود الإيجار إن وُجدت</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      <span>حدد الموقع بدقة — الموقع عامل أساسي في التقييم</span>
                    </li>
                  </ul>
                </div>

                <div className="border-t border-border/50 pt-3">
                  <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
                    <span>💡</span>
                    <span>كل ملف إضافي يساعد في الوصول لتقييم أدق — لا تتردد في رفع أي وثيقة تخص الأصل</span>
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
