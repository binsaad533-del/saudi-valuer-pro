import { useState, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, FileText, CheckCircle2,
  AlertTriangle, AlertCircle, Eye, Send, Loader2, Sparkles, X,
  FolderUp, Brain, FileSearch, Tag, Hash, MapPin,
  Building2, User, Phone, Mail, Ruler, FileCheck, ShieldCheck,
  Image as ImageIcon, FileSpreadsheet, File,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatTime } from "@/lib/utils";
import { buildSafeStorageObject } from "@/lib/storage-path";
import ScopeOfWorkGenerator from "@/components/valuation/ScopeOfWorkGenerator";


// ── Steps ──
const STEPS = [
  { id: 1, label: "رفع الوثائق" },
  { id: 2, label: "تصنيف ومراجعة" },
  { id: 3, label: "عرض التقييم" },
  { id: 4, label: "المراجعة والإرسال" },
] as const;

// ── Purposes ──
const PURPOSES = [
  "بيع / شراء", "تمويل عقاري", "إعادة تقييم", "نزع ملكية للمنفعة العامة",
  "تصفية / تسوية", "تقارير مالية (IFRS)", "ضمان بنكي", "استثمار",
  "تأمين", "أغراض ضريبية", "نقل ملكية", "أخرى",
];

// ── Purposes blocked for desktop valuation (require field inspection) ──
const DESKTOP_BLOCKED_PURPOSES = [
  "تمويل عقاري", "ضمان بنكي", "نزع ملكية للمنفعة العامة",
];

const VALUE_BASES = [
  "القيمة السوقية (Market Value)",
  "قيمة الاستثمار (Investment Value)",
  "القيمة العادلة (Fair Value)",
  "القيمة التصفوية (Liquidation Value)",
  "قيمة الاستخدام الحالي (Existing Use Value)",
];

const DOC_CATEGORIES = [
  { value: "deed", label: "صك ملكية", icon: FileCheck },
  { value: "building_permit", label: "رخصة بناء", icon: ShieldCheck },
  { value: "floor_plan", label: "مخطط معماري", icon: Ruler },
  { value: "property_photo", label: "صورة أصل عقاري", icon: ImageIcon },
  { value: "machinery_photo", label: "صورة آلة / معدة", icon: ImageIcon },
  { value: "identity_doc", label: "وثيقة هوية", icon: User },
  { value: "invoice", label: "فاتورة / سند", icon: FileSpreadsheet },
  { value: "contract", label: "عقد / اتفاقية", icon: FileText },
  { value: "technical_report", label: "تقرير فني", icon: FileSearch },
  { value: "location_map", label: "خريطة موقع", icon: MapPin },
  { value: "other", label: "أخرى", icon: File },
];

// ── Types ──
interface UploadedFile {
  file: File;
  name: string;
  size: number;
  category?: string;
  categoryLabel?: string;
  relevance?: string;
  extractedInfo?: string;
  storagePath?: string;
}

interface AssetField {
  key: string;
  label: string;
  value: string;
  confidence: number;
  source?: string;
  group?: string;
}

interface InventoryItem {
  id: number;
  name: string;
  type: "real_estate" | "machinery_equipment";
  category?: string;
  subcategory?: string;
  quantity: number;
  condition?: string;
  fields: AssetField[];
  source?: string;
  confidence?: number;
}

interface ExtractedData {
  discipline: string;
  discipline_label: string;
  confidence: number;
  client: {
    clientName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  };
  description?: string;
  inventory?: InventoryItem[];
  summary?: { total: number; by_type?: Record<string, number>; by_condition?: Record<string, number> };
  suggestedPurpose?: string;
  notes: string[];
  documentCategories: { fileName: string; category: string; categoryLabel?: string; relevance: string; extractedInfo?: string }[];
  analysisMethod?: string;
  analyzedFilesCount?: number;
  totalFilesCount?: number;
}

interface ActivityEntry {
  step: number;
  action: string;
  timestamp: Date;
}

export default function NewValuation() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState("");
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  // Step 1: uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  // Step 2: AI extracted data (editable)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [clientFields, setClientFields] = useState<Record<string, string>>({});
  const [dynamicAssetFields, setDynamicAssetFields] = useState<AssetField[]>([]);
  const [assetDescription, setAssetDescription] = useState("");
  const [locationFields, setLocationFields] = useState<{ city: string; district: string }>({ city: "", district: "" });

  // Step 3: purpose & valuation config
  const [purpose, setPurpose] = useState("");
  const [valueBasis, setValueBasis] = useState(VALUE_BASES[0]);
  const [valuationDate, setValuationDate] = useState("");
  const [valuationMode, setValuationMode] = useState<"field" | "desktop">("field");
  const [desktopDisclaimerAccepted, setDesktopDisclaimerAccepted] = useState(false);

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const logActivity = useCallback((step: number, action: string) => {
    setActivityLog(prev => [...prev, { step, action, timestamp: new Date() }]);
  }, []);

  // ── File handling ──
  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map(f => ({
      file: f,
      name: f.name,
      size: f.size,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    logActivity(1, `رفع ${newFiles.length} ملف`);
  }, [logActivity]);

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

  // ── Update file category manually ──
  const updateFileCategory = useCallback((index: number, category: string) => {
    const catInfo = DOC_CATEGORIES.find(c => c.value === category);
    setUploadedFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, category, categoryLabel: catInfo?.label || category } : f
    ));
  }, []);

  // ── AI Extraction with content analysis ──
  const runExtraction = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      toast.error("يجب رفع ملف واحد على الأقل");
      return;
    }

    setExtracting(true);
    logActivity(1, "بدء التحليل الذكي للوثائق");

    try {
      setExtractionPhase("رفع الملفات...");
      const storagePaths: { path: string; name: string; mimeType: string }[] = [];

      for (const uf of uploadedFiles) {
        const { storageKey, originalFilename } = buildSafeStorageObject({
          userId: "shared",
          originalFilename: uf.name,
        });
        const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(storageKey, uf.file);
        if (!uploadErr) {
          storagePaths.push({ path: storageKey, name: originalFilename, mimeType: uf.file.type });
          uf.storagePath = storageKey;
        }
      }

      setExtractionPhase("تحليل المحتوى بالذكاء الاصطناعي...");
      const { data, error } = await supabase.functions.invoke("extract-documents", {
        body: {
          fileNames: uploadedFiles.map(f => f.name),
          fileDescriptions: uploadedFiles.map(f => f.category || ""),
          storagePaths,
        },
      });

      if (error) throw error;

      const result = data as ExtractedData;
      setExtracted(result);

      // Pre-fill editable fields from AI
      setClientFields({
        clientName: result.client?.clientName || "",
        idNumber: result.client?.idNumber || "",
        phone: result.client?.phone || "",
        email: result.client?.email || "",
      });
      // Use top-level description from edge function
      setAssetDescription(result.description || "");
      
      // Build dynamic asset fields from inventory items
      const allFields: AssetField[] = [];
      if (Array.isArray(result.inventory) && result.inventory.length > 0) {
        for (const item of result.inventory) {
          if (Array.isArray(item.fields)) {
            for (const f of item.fields) {
              allFields.push({
                ...f,
                source: f.source || item.source || `أصل #${item.id}: ${item.name}`,
              });
            }
          }
        }
      }
      setDynamicAssetFields(allFields);
      
      // Extract location if present in inventory fields
      const cityField = allFields.find(f => f.key === "city");
      const districtField = allFields.find(f => f.key === "district");
      if (cityField || districtField) {
        setLocationFields({
          city: cityField?.value || "",
          district: districtField?.value || "",
        });
      }
      if (result.suggestedPurpose) setPurpose(result.suggestedPurpose);

      // Update file categories from AI
      if (result.documentCategories) {
        setUploadedFiles(prev => prev.map(f => {
          const cat = result.documentCategories.find(dc => dc.fileName === f.name);
          return cat ? {
            ...f,
            category: cat.category,
            categoryLabel: cat.categoryLabel || DOC_CATEGORIES.find(c => c.value === cat.category)?.label || cat.category,
            relevance: cat.relevance,
            extractedInfo: cat.extractedInfo,
          } : f;
        }));
      }

      setCompletedSteps(prev => new Set(prev).add(1));
      setCurrentStep(2);
      const methodLabel = result.analysisMethod === "content_analysis"
        ? `تحليل محتوى ${result.analyzedFilesCount} ملف`
        : "تحليل أسماء الملفات";
      logActivity(1, `تم التحليل — ${result.discipline_label} (ثقة ${result.confidence}%) — ${methodLabel}`);
      toast.success("تم تحليل الوثائق بنجاح");
    } catch (err: any) {
      console.error("Extraction error:", err);
      if (err?.message?.includes("429") || err?.status === 429) {
        toast.error("تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً");
      } else if (err?.message?.includes("402") || err?.status === 402) {
        toast.error("يرجى إضافة رصيد للاستمرار");
      } else {
        toast.error(err?.message || "حدث خطأ أثناء تحليل الوثائق");
      }
    } finally {
      setExtracting(false);
      setExtractionPhase("");
    }
  }, [uploadedFiles, logActivity]);

  // ── Validation ──
  const validateStep = useCallback((step: number) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1:
        if (uploadedFiles.length === 0) errors.push("يجب رفع ملف واحد على الأقل");
        if (!extracted) errors.push("يجب تشغيل التحليل الذكي");
        break;
      case 2:
        if (!clientFields.clientName?.trim()) errors.push("اسم العميل مطلوب");
        if (!assetDescription?.trim()) warnings.push("وصف الأصل غير مكتمل");
        if (uploadedFiles.some(f => !f.category)) warnings.push("بعض الملفات لم تُصنَّف بعد");
        break;
      case 3:
        if (!purpose) errors.push("يجب تحديد غرض التقييم");
        if (!valuationDate) errors.push("يجب تحديد تاريخ التقييم");
        if (valuationMode === "desktop" && DESKTOP_BLOCKED_PURPOSES.includes(purpose)) {
          errors.push("التقييم المكتبي غير مسموح لهذا الغرض — يتطلب معاينة ميدانية");
        }
        if (valuationMode === "desktop" && !desktopDisclaimerAccepted) {
          errors.push("يجب الموافقة على إقرار التقييم المكتبي");
        }
        break;
      case 4:
        for (let s = 1; s <= 3; s++) {
          const sv = validateStep(s);
          if (sv.errors.length > 0) errors.push(`الخطوة ${s} تحتوي على بيانات ناقصة`);
        }
        break;
    }
    return { valid: errors.length === 0, errors, warnings };
  }, [uploadedFiles, extracted, clientFields, assetDescription, dynamicAssetFields, purpose, valuationDate]);

  const progressPercent = useMemo(() => {
    let total = 0;
    if (uploadedFiles.length > 0) total += 15;
    if (extracted) total += 15;
    if (clientFields.clientName?.trim()) total += 15;
    if (assetDescription?.trim()) total += 10;
    const filledAsset = dynamicAssetFields.filter(f => f.value?.trim()).length;
    total += Math.min(filledAsset * 2, 15);
    if (purpose) total += 15;
    if (valuationDate) total += 15;
    return Math.min(total, 100);
  }, [uploadedFiles, extracted, clientFields, assetDescription, dynamicAssetFields, purpose, valuationDate]);

  const canGoToStep = useCallback((target: number): boolean => {
    if (target === 1) return true;
    for (let s = 1; s < target; s++) {
      if (!completedSteps.has(s)) return false;
    }
    return true;
  }, [completedSteps]);

  const goNext = useCallback(() => {
    const v = validateStep(currentStep);
    if (!v.valid) { v.errors.forEach(e => toast.error(e)); return; }
    if (v.warnings.length > 0) v.warnings.forEach(w => toast.warning(w));
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    logActivity(currentStep, `إكمال الخطوة ${currentStep}`);
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  }, [currentStep, validateStep, logActivity]);

  const goPrev = useCallback(() => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const v = validateStep(4);
    if (!v.valid) { v.errors.forEach(e => toast.error(e)); return; }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("يجب تسجيل الدخول أولاً"); setSubmitting(false); return; }

      const { data: reqData, error: reqErr } = await supabase
        .from("valuation_requests")
        .insert({
          client_user_id: user.id,
          discipline: (extracted?.discipline || "real_estate") as any,
          purpose_ar: purpose,
          value_basis_ar: valueBasis,
          valuation_date: valuationDate || new Date().toISOString().split("T")[0],
          status: "submitted",
          client_name_ar: clientFields.clientName || "",
          client_id_number: clientFields.idNumber || "",
          client_phone: clientFields.phone || "",
          client_email: clientFields.email || "",
          intended_user_ar: clientFields.clientName || "",
          valuation_mode: valuationMode,
          desktop_disclaimer_accepted: valuationMode === "desktop" ? desktopDisclaimerAccepted : false,
          asset_data: {
            description: assetDescription,
            fields: dynamicAssetFields,
            location: locationFields,
            inventory: extracted?.inventory,
            ai_extracted: true,
            ai_confidence: extracted?.confidence,
            analysis_method: extracted?.analysisMethod,
          } as any,
        })
        .select("id")
        .single();

      if (reqErr) throw reqErr;
      logActivity(4, "تم إرسال الطلب");

      // Move temp files to request folder or re-upload
      if (reqData?.id) {
        for (const uf of uploadedFiles) {
          if (!uf.storagePath) {
            const filePath = `${reqData.id}/${Date.now()}_${uf.name}`;
            await supabase.storage.from("client-uploads").upload(filePath, uf.file);
          }
        }
        logActivity(4, `تم ربط ${uploadedFiles.length} ملف`);
      }

      logActivity(4, "بدء سير العمل التلقائي بالذكاء الاصطناعي...");
      toast.success("تم إنشاء ملف التقييم — سير العمل التلقائي بدأ");

      if (reqData?.id) {
        supabase.functions.invoke("workflow-orchestrator", {
          body: { request_id: reqData.id },
        }).catch(err => console.error("Orchestrator error:", err));
      }

      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
  }, [extracted, clientFields, dynamicAssetFields, assetDescription, locationFields, purpose, valueBasis, valuationDate, valuationMode, desktopDisclaimerAccepted, uploadedFiles, validateStep, logActivity, navigate]);

  const allStepValidations = useMemo(() => STEPS.map(s => ({ step: s, validation: validateStep(s.id) })), [validateStep]);

  const [dragOver, setDragOver] = useState(false);

  // Stats for step 2
  const classifiedCount = uploadedFiles.filter(f => f.category).length;
  const highRelevanceCount = uploadedFiles.filter(f => f.relevance === "high").length;

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-foreground">طلب تقييم جديد</h2>
          <p className="text-sm text-muted-foreground mb-3">ارفع الوثائق وسيتولى الذكاء الاصطناعي استخراج البيانات وتصنيف الطلب تلقائياً</p>
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{progressPercent}%</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-card">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const accessible = canGoToStep(step.id);
              const isCurrent = currentStep === step.id;
              const isDone = completedSteps.has(step.id);
              return (
                <div key={step.id} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => accessible && setCurrentStep(step.id)}
                      disabled={!accessible}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${isCurrent ? "gradient-primary text-primary-foreground"
                          : isDone ? "bg-success text-success-foreground"
                          : accessible ? "bg-muted text-muted-foreground hover:bg-primary/10 cursor-pointer"
                          : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"}`}
                    >
                      {isDone && !isCurrent ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </button>
                    <span className={`text-[10px] mt-1 whitespace-nowrap ${isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${isDone ? "bg-success" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Stage label */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>المرحلة:</span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">الخطوة {currentStep} من {STEPS.length}</span>
          </div>
          {extracted && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent border border-accent text-accent-foreground">
              <Sparkles className="w-3 h-3" />
              <span>{extracted.discipline_label} — ثقة {extracted.confidence}%</span>
              {extracted.analysisMethod === "content_analysis" && (
                <Badge variant="secondary" className="text-[9px] px-1 py-0 mr-1">تحليل محتوى</Badge>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="bg-card rounded-lg border border-border shadow-card p-6 animate-fade-in">

          {/* ─── Step 1: Bulk Upload ─── */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">رفع الوثائق</h3>
                <p className="text-sm text-muted-foreground mb-5">ارفع جميع المستندات المتوفرة دفعة واحدة — سيتم تحليل المحتوى الفعلي للملفات</p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.tif,.tiff,.webp"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <FolderUp className={`w-12 h-12 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
                <p className="text-sm font-medium text-foreground mb-1">اسحب الملفات هنا أو اضغط للاختيار</p>
                <p className="text-xs text-muted-foreground">PDF, صور, Word, Excel — يتم تحليل محتوى الملفات بالذكاء الاصطناعي</p>
              </div>

              {/* File list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{uploadedFiles.length} ملف مرفوع</span>
                    <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">+ إضافة المزيد</button>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {uploadedFiles.map((f, i) => {
                      const Icon = getFileIcon(f.name);
                      return (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                          <div className="flex items-center gap-3 min-w-0">
                            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm text-foreground truncate">{f.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {f.category && (
                              <Badge variant="secondary" className="text-[10px]">
                                {f.categoryLabel || f.category}
                              </Badge>
                            )}
                            <button onClick={() => removeFile(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Analysis button */}
              {uploadedFiles.length > 0 && (
                <button
                  onClick={runExtraction}
                  disabled={extracting}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {extracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{extractionPhase || "جارٍ تحليل الوثائق بالذكاء الاصطناعي..."}</>
                  ) : (
                    <><Brain className="w-4 h-4" />تحليل المحتوى بالذكاء الاصطناعي</>
                  )}
                </button>
              )}
            </div>
          )}

          {/* ─── Step 2: Classification & Review ─── */}
          {currentStep === 2 && extracted && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <FileSearch className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">تصنيف المستندات والبيانات المستخرجة</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  تم تحليل {extracted.analyzedFilesCount || 0} ملف بالمحتوى الفعلي — راجع التصنيف والبيانات المستخرجة
                </p>
                {/* Analysis method badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={extracted.analysisMethod === "content_analysis" ? "default" : "secondary"} className="text-[10px]">
                    {extracted.analysisMethod === "content_analysis" ? "🔍 تحليل محتوى فعلي" : "📝 تحليل أسماء الملفات"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {classifiedCount}/{uploadedFiles.length} مُصنَّف
                  </Badge>
                  {highRelevanceCount > 0 && (
                    <Badge variant="outline" className="text-[10px] border-success/30 text-success">
                      {highRelevanceCount} مستند مهم
                    </Badge>
                  )}
                </div>
              </div>

              {/* AI Notes */}
              {extracted.notes.length > 0 && (
                <div className="p-4 rounded-lg bg-accent/50 border border-accent text-sm">
                  <div className="flex items-center gap-2 mb-2 text-accent-foreground font-medium">
                    <Brain className="w-4 h-4" />
                    <span>ملاحظات الذكاء الاصطناعي</span>
                  </div>
                  <ul className="space-y-1 text-accent-foreground/80">
                    {extracted.notes.map((n, i) => <li key={i} className="text-xs">• {n}</li>)}
                  </ul>
                </div>
              )}

              {/* Document Classification Table */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  تصنيف المستندات
                </h4>
                <div className="space-y-2">
                  {uploadedFiles.map((f, i) => {
                    const Icon = getFileIcon(f.name);
                    const catInfo = DOC_CATEGORIES.find(c => c.value === f.category);
                    const CatIcon = catInfo?.icon || File;
                    return (
                      <div key={i} className={`rounded-lg border p-3 transition-colors ${
                        f.relevance === "high" ? "border-success/30 bg-success/5" :
                        f.relevance === "medium" ? "border-warning/30 bg-warning/5" :
                        "border-border bg-muted/10"
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <Icon className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</p>
                              {f.extractedInfo && (
                                <p className="text-xs text-muted-foreground mt-1 bg-muted/40 rounded px-2 py-1">
                                  💡 {f.extractedInfo}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Relevance badge */}
                            <Badge variant="outline" className={`text-[9px] px-1.5 ${
                              f.relevance === "high" ? "border-success/50 text-success" :
                              f.relevance === "medium" ? "border-warning/50 text-warning" :
                              "text-muted-foreground"
                            }`}>
                              {f.relevance === "high" ? "مهم" : f.relevance === "medium" ? "متوسط" : "منخفض"}
                            </Badge>
                            {/* Category select */}
                            <Select value={f.category || ""} onValueChange={(val) => updateFileCategory(i, val)}>
                              <SelectTrigger className="h-7 text-[11px] w-32 border-border">
                                <SelectValue placeholder="التصنيف">
                                  {catInfo ? (
                                    <span className="flex items-center gap-1">
                                      <CatIcon className="w-3 h-3" />
                                      {catInfo.label}
                                    </span>
                                  ) : "تصنيف..."}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {DOC_CATEGORIES.map(cat => (
                                  <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                    <span className="flex items-center gap-2">
                                      <cat.icon className="w-3.5 h-3.5" />
                                      {cat.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Inventory Summary */}
              {Array.isArray(extracted.inventory) && extracted.inventory.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2 flex items-center gap-2">
                    <Hash className="w-4 h-4 text-primary" />
                    جرد الأصول المستخرجة ({extracted.inventory.length} أصل)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {extracted.inventory.map((item) => (
                      <div key={item.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {item.type === "real_estate" ? <Building2 className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                            {item.category || (item.type === "real_estate" ? "عقار" : "آلة/معدة")}
                            {item.quantity > 1 && <span className="text-primary font-medium">×{item.quantity}</span>}
                          </p>
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          {item.source && <p className="text-[10px] text-muted-foreground/60">من: {item.source}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Client data */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  بيانات العميل
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: "clientName", label: "اسم العميل / الجهة", required: true, icon: User },
                    { key: "idNumber", label: "رقم الهوية / السجل التجاري", required: false, icon: Hash },
                    { key: "phone", label: "رقم الجوال", required: false, icon: Phone },
                    { key: "email", label: "البريد الإلكتروني", required: false, icon: Mail },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1.5">
                        <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {f.label} {f.required && <span className="text-destructive">*</span>}
                      </label>
                      <input
                        type="text"
                        value={clientFields[f.key] || ""}
                        onChange={(e) => setClientFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                        dir={f.key === "email" ? "ltr" : "rtl"}
                        className={`w-full px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring
                          ${f.required && !clientFields[f.key]?.trim() ? "border-destructive/50" : "border-input"}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Asset data - AI extracted dynamic fields */}
              <div>
                <h4 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  بيانات الأصل
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full mr-auto flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    مستخرجة بالذكاء الاصطناعي
                  </span>
                </h4>
                <div className="space-y-4">
                  {/* Asset description - AI extracted, editable */}
                  <div>
                    <label className="flex items-center gap-1.5 text-sm font-medium text-foreground mb-1.5">
                      <Sparkles className="w-3 h-3 text-primary" />
                      وصف الأصل
                    </label>
                    <textarea
                      value={assetDescription}
                      onChange={(e) => setAssetDescription(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  {/* Location - user selects via Google Maps */}
                  <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                    <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-3">
                      <MapPin className="w-4 h-4 text-primary" />
                      الموقع — يُحدد من العميل عبر خرائط قوقل
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                          <MapPin className="w-3 h-3" /> المدينة
                        </label>
                        <input
                          type="text"
                          value={locationFields.city}
                          onChange={(e) => setLocationFields(prev => ({ ...prev, city: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1.5">
                          <MapPin className="w-3 h-3" /> الحي / الموقع
                        </label>
                        <input
                          type="text"
                          value={locationFields.district}
                          onChange={(e) => setLocationFields(prev => ({ ...prev, district: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic AI-extracted fields with confidence */}
                  {dynamicAssetFields.filter(f => f.key !== "city" && f.key !== "district").length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-xs font-semibold text-muted-foreground">البيانات المستخرجة</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {dynamicAssetFields
                          .filter(f => f.key !== "city" && f.key !== "district")
                          .map((field) => {
                            const confColor = field.confidence >= 85 ? "text-green-600" : field.confidence >= 70 ? "text-yellow-600" : "text-red-500";
                            const confBg = field.confidence >= 85 ? "bg-green-500" : field.confidence >= 70 ? "bg-yellow-500" : "bg-red-500";
                            return (
                              <div key={field.key} className="relative">
                                <label className="flex items-center justify-between text-sm font-medium text-foreground mb-1.5">
                                  <span className="flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3 text-primary" />
                                    {field.label}
                                  </span>
                                  <span className={`text-[10px] font-medium ${confColor} flex items-center gap-1`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${confBg}`} />
                                    {field.confidence}%
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => {
                                    const newFields = [...dynamicAssetFields];
                                    const realIdx = newFields.findIndex(f => f.key === field.key);
                                    if (realIdx >= 0) {
                                      newFields[realIdx] = { ...newFields[realIdx], value: e.target.value };
                                      setDynamicAssetFields(newFields);
                                    }
                                  }}
                                  className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                />
                                {field.source && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">المصدر: {field.source}</p>
                                )}
                                {field.confidence < 70 && (
                                  <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> غير موثوق — يحتاج تأكيد يدوي
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Add custom field button */}
                  <button
                    type="button"
                    onClick={() => {
                      const key = `custom_${Date.now()}`;
                      setDynamicAssetFields(prev => [...prev, {
                        key,
                        label: "حقل مخصص",
                        value: "",
                        confidence: 100,
                        source: "إضافة يدوية",
                        group: "general",
                      }]);
                    }}
                    className="w-full py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                  >
                    + إضافة حقل مخصص
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 3: Valuation Presentation ─── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">عرض التقييم</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-5">معاينة نطاق العمل — لا يتضمن نتائج تقييم أو تسعير</p>
              </div>

              <div className="space-y-4">
                {/* Valuation Mode Selector */}
                <div className="p-4 rounded-lg border-2 border-border space-y-3">
                  <label className="block text-sm font-semibold text-foreground">نوع التقييم <span className="text-destructive">*</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => { setValuationMode("field"); setDesktopDisclaimerAccepted(false); }}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${valuationMode === "field" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                    >
                      <MapPin className={`w-6 h-6 mx-auto mb-2 ${valuationMode === "field" ? "text-primary" : "text-muted-foreground"}`} />
                      <p className={`text-sm font-medium ${valuationMode === "field" ? "text-primary" : "text-foreground"}`}>تقييم ميداني</p>
                      <p className="text-[10px] text-muted-foreground mt-1">يشمل معاينة مادية للأصل</p>
                    </button>
                    <button
                      onClick={() => { setValuationMode("desktop"); if (DESKTOP_BLOCKED_PURPOSES.includes(purpose)) setPurpose(""); }}
                      className={`p-4 rounded-lg border-2 text-center transition-all ${valuationMode === "desktop" ? "border-accent bg-accent/10" : "border-border hover:border-accent/30"}`}
                    >
                      <FileSearch className={`w-6 h-6 mx-auto mb-2 ${valuationMode === "desktop" ? "text-accent-foreground" : "text-muted-foreground"}`} />
                      <p className={`text-sm font-medium ${valuationMode === "desktop" ? "text-accent-foreground" : "text-foreground"}`}>تقييم مكتبي</p>
                      <p className="text-[10px] text-muted-foreground mt-1">بدون معاينة ميدانية — IVS متوافق</p>
                    </button>
                  </div>

                  {/* Desktop Valuation Warning & Disclaimer */}
                  {valuationMode === "desktop" && (
                    <div className="space-y-3 animate-fade-in">
                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                          <div className="text-xs text-warning space-y-1">
                            <p className="font-medium">ضوابط التقييم المكتبي (IVS / تقييم)</p>
                            <ul className="list-disc list-inside space-y-0.5 text-warning/80">
                              <li>سيُنص في التقرير على عدم إجراء معاينة مادية</li>
                              <li>يجب توفير أدلة بديلة كافية (صكوك، مخططات، بيانات سوقية)</li>
                              <li>المقيّم يتحمل مسؤولية كفاية الأدلة بحكمه المهني</li>
                              <li>غير متاح لأغراض: التمويل العقاري، الضمان البنكي، نزع الملكية</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      <label className="flex items-start gap-2 cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <input type="checkbox" checked={desktopDisclaimerAccepted} onChange={(e) => setDesktopDisclaimerAccepted(e.target.checked)}
                          className="mt-1 rounded border-input" />
                        <span className="text-xs text-foreground leading-relaxed">
                          أقر بعلمي أن هذا التقييم سيتم بدون معاينة ميدانية، وأن التقرير سيتضمن بيان إفصاح بذلك وفقاً لمعايير التقييم الدولية (IVS) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم).
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Scope */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">نطاق العمل</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">نوع التقييم</span><span className="font-medium text-foreground flex items-center gap-1"><Sparkles className="w-3 h-3 text-primary" />{extracted?.discipline_label || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">طريقة التقييم</span><span className={`font-medium flex items-center gap-1 ${valuationMode === "desktop" ? "text-accent-foreground" : "text-foreground"}`}>{valuationMode === "desktop" ? "📋 مكتبي" : "🏗️ ميداني"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل</span><span className="font-medium text-foreground">{clientFields.clientName || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الوثائق</span><span className="font-medium text-foreground">{uploadedFiles.length} ملف ({classifiedCount} مُصنَّف)</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">وصف الأصل</span><span className="font-medium text-foreground text-left max-w-[60%] truncate">{assetDescription || "-"}</span></div>
                  </div>
                </div>

                {/* Purpose */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">غرض التقييم <span className="text-destructive">*</span></label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {PURPOSES.map((p) => {
                        const isBlocked = valuationMode === "desktop" && DESKTOP_BLOCKED_PURPOSES.includes(p);
                        return (
                          <button key={p}
                            onClick={() => !isBlocked && setPurpose(p)}
                            disabled={isBlocked}
                            title={isBlocked ? "يتطلب معاينة ميدانية" : undefined}
                            className={`px-3 py-2.5 rounded-lg border text-sm transition-all ${
                              isBlocked ? "border-border bg-muted/30 text-muted-foreground/40 cursor-not-allowed line-through" :
                              purpose === p ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/30"
                            }`}>
                            {p}
                          </button>
                        );
                      })}
                    </div>
                    {valuationMode === "desktop" && purpose && DESKTOP_BLOCKED_PURPOSES.includes(purpose) && (
                      <p className="text-xs text-destructive mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" />هذا الغرض يتطلب معاينة ميدانية — يرجى اختيار غرض آخر أو التحويل للتقييم الميداني</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">أساس القيمة</label>
                    <select value={valueBasis} onChange={(e) => setValueBasis(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                      {VALUE_BASES.map(vb => <option key={vb}>{vb}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">تاريخ التقييم <span className="text-destructive">*</span></label>
                    <input type="date" value={valuationDate} onChange={(e) => setValuationDate(e.target.value)} dir="ltr"
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                  </div>
                </div>

                {/* Assumptions */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">الافتراضات المبدئية</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                    <li>يفترض أن المعلومات المقدمة صحيحة ودقيقة</li>
                    <li>يفترض عدم وجود تلوث بيئي أو تعديات نظامية</li>
                    {valuationMode === "field" ? (
                      <li>التقييم مبني على الوضع الراهن وقت المعاينة</li>
                    ) : (
                      <li>التقييم مبني على المستندات والأدلة المكتبية المتوفرة دون معاينة مادية</li>
                    )}
                    <li>لا يشمل التقييم أي أصول غير مذكورة في النطاق</li>
                    {valuationMode === "desktop" && (
                      <li className="text-warning font-medium">لم يتم إجراء معاينة مادية للأصل — قد تؤثر هذه القيود على دقة النتائج</li>
                    )}
                  </ul>
                </div>

                {/* AI Scope of Work Generator */}
                <ScopeOfWorkGenerator
                  purpose={purpose}
                  assetDescription={assetDescription}
                  assetType={extracted?.discipline || "real_estate"}
                  clientName={clientFields.clientName}
                  city={locationFields?.city}
                  district={locationFields?.district}
                  area={dynamicAssetFields.find(f => f.key === "area_sqm")?.value}
                  documents={uploadedFiles.map(f => ({ name: f.name }))}
                />

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="text-sm font-semibold text-primary mb-2">المخرج المتوقع</h4>
                  <p className="text-sm text-primary/80">تقرير تقييم شامل وفق المعايير الدولية (IVS) ومعايير تقييم</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Final Review ─── */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">المراجعة النهائية</h3>
                <p className="text-sm text-muted-foreground mb-5">راجع البيانات قبل إنشاء ملف التقييم</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "نوع التقييم (ذكاء اصطناعي)", value: extracted?.discipline_label || "-" },
                  { label: "طريقة التقييم", value: valuationMode === "desktop" ? "📋 تقييم مكتبي" : "🏗️ تقييم ميداني" },
                  { label: "مستوى الثقة", value: `${extracted?.confidence || 0}%` },
                  { label: "طريقة التحليل", value: extracted?.analysisMethod === "content_analysis" ? "تحليل محتوى فعلي" : "تحليل أسماء الملفات" },
                  { label: "العميل", value: clientFields.clientName || "-" },
                  { label: "رقم الهوية", value: clientFields.idNumber || "-" },
                  { label: "عدد الوثائق", value: `${uploadedFiles.length} ملف (${classifiedCount} مُصنَّف)` },
                  { label: "وصف الأصل", value: assetDescription || "-" },
                  { label: "غرض التقييم", value: purpose || "-" },
                  { label: "أساس القيمة", value: valueBasis },
                  { label: "تاريخ التقييم", value: valuationDate || "-" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Document summary */}
              {uploadedFiles.some(f => f.category) && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    ملخص المستندات
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(
                      uploadedFiles.reduce((acc, f) => {
                        if (f.category) {
                          const label = f.categoryLabel || DOC_CATEGORIES.find(c => c.value === f.category)?.label || f.category;
                          acc[label] = (acc[label] || 0) + 1;
                        }
                        return acc;
                      }, {} as Record<string, number>)
                    ).map(([label, count]) => (
                      <Badge key={label} variant="secondary" className="text-xs">
                        {label}: {count}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {allStepValidations.some(sv => sv.validation.warnings.length > 0) && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 space-y-2">
                  <div className="flex items-center gap-2 text-warning font-medium text-sm"><AlertTriangle className="w-4 h-4" /><span>تنبيهات</span></div>
                  {allStepValidations.flatMap(sv => sv.validation.warnings.map((w, i) => <p key={`${sv.step.id}-${i}`} className="text-xs text-warning/80 mr-6">• {w}</p>))}
                </div>
              )}

              {allStepValidations.some(sv => sv.validation.errors.length > 0 && sv.step.id < 4) && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm"><AlertCircle className="w-4 h-4" /><span>بيانات ناقصة</span></div>
                  {allStepValidations.filter(sv => sv.step.id < 4).flatMap(sv => sv.validation.errors.map((e, i) => <p key={`${sv.step.id}-${i}`} className="text-xs text-destructive/80 mr-6">• {e}</p>))}
                </div>
              )}

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                سيتم إنشاء رقم مرجعي فريد وبدء سير العمل التلقائي.
              </div>

              {activityLog.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">سجل النشاط</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {activityLog.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{entry.action}</span>
                        <span className="text-muted-foreground/60">{formatTime(entry.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={goPrev} disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4" />السابق
          </button>

          {currentStep === STEPS.length ? (
            <button onClick={handleSubmit} disabled={submitting || !validateStep(4).valid}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-accent text-accent-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />جارٍ الإنشاء...</> : <><Send className="w-4 h-4" />إنشاء ملف التقييم</>}
            </button>
          ) : currentStep === 1 ? (
            uploadedFiles.length > 0 && extracted ? (
              <button onClick={goNext} className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all">
                التالي<ChevronLeft className="w-4 h-4" />
              </button>
            ) : null
          ) : (
            <button onClick={goNext} className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all">
              التالي<ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
