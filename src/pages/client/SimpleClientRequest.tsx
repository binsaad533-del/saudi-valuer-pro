import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { parseExcelFile, autoMapColumns, applyMapping } from "@/lib/excel-parser";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, AlertTriangle, ArrowRight, MapPin,
} from "lucide-react";
import AIReviewStep, { classifyAssetLicense, type ExtractedAsset, type AIReviewData } from "@/components/client/AIReviewStep";
import logo from "@/assets/logo.png";
import AssetLocationPicker, { type AssetLocation } from "@/components/client/AssetLocationPicker";

// ── Extracted sub-components ──
import { ExtractionFailedScreen, DoneScreen, ProgressScreen } from "@/components/client/request/RequestStateScreens";
import AssetTypeDetector, { ASSET_TYPE_MAP } from "@/components/client/request/AssetTypeDetector";
import ClientInfoForm, { PURPOSE_OPTIONS, INTENDED_USERS_OPTIONS, VALUATION_MODE_OPTIONS } from "@/components/client/request/ClientInfoForm";
import FileUploadZone, { type UploadedFile } from "@/components/client/request/FileUploadZone";
import RequestGuidance from "@/components/client/request/RequestGuidance";

// ── Types ──
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
  return fallback === "both" ? "machinery_equipment" : fallback;
}

const isExcel = (type: string, name: string) =>
  type.includes("sheet") || type.includes("excel") || type.includes("csv") || /\.(xlsx|xls|csv)$/i.test(name);

export default function SimpleClientRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<any>(null);
  const [clientName, setClientName] = useState("");
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
  const [assetLocations, setAssetLocations] = useState<AssetLocation[]>([]);

  // AI detection state
  const [detectedType, setDetectedType] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [detectionReason, setDetectionReason] = useState("");
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

  // ── Auth ──
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
      const { data: clientRow } = await supabase
        .from("clients")
        .select("name_ar, phone, email, id_number")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (clientRow?.name_ar) { setClientName(clientRow.name_ar); setClientNameInput(clientRow.name_ar); }
      if (clientRow?.phone) setClientPhone(clientRow.phone);
      if (clientRow?.email) setClientEmail(clientRow.email);
      if (clientRow?.id_number) setClientIdNumber(clientRow.id_number);
      if (!clientRow?.name_ar) setClientName(user.user_metadata?.full_name || user.email?.split("@")[0] || "");
    };
    checkAuth();
  }, [navigate]);

  // ── AI Asset Type Detection ──
  const detectAssetType = async (files: UploadedFile[]) => {
    if (files.length === 0) { setDetectedType(null); setConfirmedType(null); setDetectionFailed(false); return; }
    setDetecting(true); setDetectedType(null); setConfirmedType(null); setShowManualOverride(false); setDetectionFailed(false);
    try {
      let excelSample = "";
      for (const uf of files.filter(f => isExcel(f.type, f.name))) {
        if (!uf.rawFile) continue;
        try {
          const result = await parseExcelFile(uf.rawFile);
          for (const sheet of result.sheets) {
            excelSample += `Headers: ${sheet.headers.join(", ")}\n`;
            for (const row of sheet.rows.slice(0, 3)) excelSample += `Row: ${Object.values(row).join(", ")}\n`;
          }
        } catch { /* skip */ }
      }
      const { data, error } = await supabase.functions.invoke("classify-asset-type", {
        body: { files: files.map(f => ({ name: f.name, mimeType: f.type })), excelSample: excelSample || undefined },
      });
      if (error) throw error;
      setDetectedType(data.asset_type || "real_estate");
      setDetectionConfidence(data.confidence || 50);
      setDetectionReason(data.reason_ar || "");
      if ((data.confidence || 50) < 30) setDetectionFailed(true);
    } catch {
      setDetectionFailed(true); setDetectedType(null); setDetectionConfidence(0);
      setDetectionReason("تعذر التحليل التلقائي — يرجى الاختيار يدوياً");
    } finally { setDetecting(false); }
  };

  useEffect(() => {
    if (uploadedFiles.length > 0) detectAssetType(uploadedFiles);
    else { setDetectedType(null); setConfirmedType(null); setDetectionConfidence(0); setDetectionReason(""); setDetectionFailed(false); setShowManualOverride(false); }
  }, [uploadedFiles]);

  // ── File handlers ──
  const handleFileUpload = async (fileList: FileList) => {
    if (!user) return;
    setUploading(true);
    const newFiles: UploadedFile[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const { storageKey, originalFilename } = buildSafeStorageObject({ userId: user.id, originalFilename: file.name });
        const { error } = await supabase.storage.from("client-uploads").upload(storageKey, file);
        if (error) { toast({ title: `تعذر رفع ${originalFilename}`, description: getUploadErrorMessage(error), variant: "destructive" }); continue; }
        newFiles.push({ id: crypto.randomUUID(), name: originalFilename, size: file.size, type: file.type, path: storageKey, rawFile: file });
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } finally { setUploading(false); }
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files); };
  const finalAssetType = confirmedType;

  // ── Start AI Analysis ──
  const handleStartAnalysis = async () => {
    if (!finalAssetType || uploadedFiles.length === 0 || !user) return;
    setState("analyzing"); setAnalysisProgress(10); setAnalysisLabel("جارٍ قراءة الملفات..."); setExtractionFailureReason("");

    try {
      const assetType = finalAssetType;
      const excelFiles = uploadedFiles.filter(f => isExcel(f.type, f.name));
      const otherFiles = uploadedFiles.filter(f => !isExcel(f.type, f.name));
      let assetInventory: ExtractedAsset[] = [];
      let idCounter = 1;
      let aiDiscipline = assetType;

      if (excelFiles.length > 0) {
        setAnalysisLabel("جارٍ قراءة ملفات Excel..."); setAnalysisProgress(20);
        for (const uf of excelFiles) {
          if (!uf.rawFile) continue;
          try {
            const result = await parseExcelFile(uf.rawFile);
            for (const sheet of result.sheets) {
              const mappings = autoMapColumns(sheet.headers);
              for (const row of applyMapping(sheet.rows, mappings)) {
                const hasData = (row.name && row.name !== `أصل ${row._rowIndex}`) || row.value || row.type;
                if (!hasData && !row.quantity) continue;
                const assetName = String(row.name || `أصل ${assetInventory.length + 1}`);
                const assetCat = row.type ? String(row.type) : null;
                assetInventory.push({
                  id: idCounter++, name: assetName, type: inferAssetType(assetName, assetCat, assetType),
                  category: assetCat, quantity: Number(row.quantity) || 1,
                  condition: row.condition ? String(row.condition) : "unknown",
                  confidence: mappings.filter(m => m.autoMapped).length >= 2 ? 80 : 50,
                  source: `${uf.name} → ${sheet.name}`, license_status: "permitted",
                });
              }
            }
          } catch { /* skip */ }
        }
      }

      if (otherFiles.length > 0) {
        setAnalysisProgress(40); setAnalysisLabel("جارٍ تحليل الصور والمستندات بالذكاء الاصطناعي...");
        try {
          const { data: jobData, error: jobError } = await supabase.functions.invoke("asset-extraction-orchestrator", {
            body: { action: "create_and_process", userId: user.id, files: otherFiles.map(f => ({ name: f.name, path: f.path, size: f.size, mimeType: f.type })) },
          });
          if (!jobError && jobData?.assets?.length > 0) {
            for (const a of jobData.assets) {
              const aName = a.name || `أصل ${idCounter}`;
              assetInventory.push({
                id: idCounter++, name: aName, type: a.type && a.type !== "both" ? a.type : inferAssetType(aName, a.category, assetType),
                category: a.category || null, quantity: a.quantity || 1, condition: a.condition || "unknown",
                confidence: a.confidence || 60, source: a.source || "تحليل بصري", license_status: "permitted",
              });
            }
            if (jobData.discipline) aiDiscipline = jobData.discipline;
          }
        } catch (err) { console.error("AI extraction failed:", err); }
      }

      setAnalysisProgress(80); setAnalysisLabel("جارٍ تصنيف الأصول وفحص الترخيص...");

      if (assetInventory.length === 0) {
        await supabase.from("audit_logs").insert({
          user_id: user.id, action: "create" as any, table_name: "valuation_requests",
          description: `فشل استخراج الأصول — ${uploadedFiles.length} ملف — لم يتم التعرف على أي أصول`,
          new_data: { action_type: "ai_extraction_failed", files_count: uploadedFiles.length, file_names: uploadedFiles.map(f => f.name), confirmed_type: assetType, reason: "zero_assets_extracted" } as any,
          user_role: "client",
        });
        setExtractionFailureReason("لم يتمكن النظام من استخراج الأصول من الملفات المرفوعة.\n\nيرجى:\n- رفع صور أوضح\n- أو إضافة مستند يحتوي على تفاصيل الأصول (مثل جدول Excel)");
        setState("extraction_failed"); return;
      }

      const meCount = assetInventory.filter(a => a.type === "machinery_equipment").length;
      const reCount = assetInventory.filter(a => a.type === "real_estate").length;
      const total = assetInventory.length;
      let finalDiscipline = aiDiscipline;
      if (meCount / total >= 0.7) finalDiscipline = "machinery_equipment";
      else if (reCount / total >= 0.7) finalDiscipline = "real_estate";
      else if (meCount > 0 && reCount > 0) finalDiscipline = "both";

      assetInventory = assetInventory.map(classifyAssetLicense);
      setAnalysisProgress(100); setAnalysisLabel("اكتمل التحليل!");
      await new Promise(r => setTimeout(r, 400));

      setReviewData({
        detectedType: finalDiscipline, confirmedType: finalDiscipline, confidence: detectionConfidence,
        assets: assetInventory, totalFiles: uploadedFiles.length, clientName: clientName || undefined,
        requestScope: {
          clientName: clientNameInput || clientName || undefined, phone: clientPhone || undefined,
          email: clientEmail || undefined, idNumber: clientIdNumber || undefined,
          purpose: purpose === "other" ? purposeOther.trim() || undefined : PURPOSE_OPTIONS[purpose] || undefined,
          intendedUser: intendedUser === "other" ? intendedUserOther.trim() || undefined : INTENDED_USERS_OPTIONS[intendedUser] || undefined,
          valuationMode: VALUATION_MODE_OPTIONS[valuationMode] || undefined,
          assetType: ASSET_TYPE_MAP[finalDiscipline]?.label || undefined,
          notes: notes.trim() || undefined,
          files: uploadedFiles.map(f => ({ name: f.name, type: f.type })),
          locations: assetLocations.map(l => ({ name: l.name, city: l.city, googleMapsUrl: l.googleMapsUrl, latitude: l.latitude, longitude: l.longitude })),
        },
      });
      setState("review");
    } catch (err: any) {
      console.error("Analysis error:", err);
      toast({ title: "خطأ في التحليل", description: err.message, variant: "destructive" }); setState("form");
    }
  };

  // ── Final Submit ──
  const handleReviewApprove = async (approvedAssets: ExtractedAsset[], reviewNotes: string) => {
    const resolvedAssetType = reviewData?.confirmedType || reviewData?.detectedType || finalAssetType;
    if (!user || !resolvedAssetType) return;
    setSubmitting(true); setState("processing"); setProcessingProgress(20); setProcessingLabel("جارٍ إنشاء الطلب...");

    try {
      const assetType = resolvedAssetType;
      const reviewConfirmedType = reviewData?.confirmedType || confirmedType;
      const reviewDetectedType = reviewData?.detectedType || detectedType;
      const wasManuallyOverridden = reviewDetectedType !== reviewConfirmedType;
      const aiClassification = { ai_detected_asset_type: reviewDetectedType, user_confirmed_asset_type: reviewConfirmedType, was_manually_overridden: wasManuallyOverridden, detection_failed: detectionFailed, confidence: detectionConfidence, reason: detectionReason };

      const allAssets = reviewData?.assets || [];
      const supportedAssets = approvedAssets;
      const unsupportedAssets = allAssets.filter(a => a.license_status === "not_permitted");
      const reviewRequiredAssets = allAssets.filter(a => a.license_status === "needs_review");

      const assetData = {
        discipline: assetType,
        inventory: supportedAssets.map((a, i) => ({ id: i + 1, ...a })),
        summary: { total: supportedAssets.length, by_type: { [assetType]: supportedAssets.length }, unsupported_count: unsupportedAssets.length, review_required_count: reviewRequiredAssets.length },
        ai_classification: aiClassification, supported_assets: supportedAssets, unsupported_assets: unsupportedAssets,
        review_required_assets: reviewRequiredAssets, user_review_completed: true,
      };

      setProcessingProgress(50); setProcessingLabel("جارٍ حفظ الطلب...");
      const combinedNotes = [notes, reviewNotes].filter(Boolean).join("\n---\n");

      const { data: reqData, error: reqError } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id, client_name_ar: clientNameInput || null, client_phone: clientPhone || null,
          client_email: clientEmail || null, client_id_number: clientIdNumber || null,
          purpose: purpose || null,
          purpose_ar: purpose === "other" ? purposeOther : (purpose ? PURPOSE_OPTIONS[purpose] || null : null),
          intended_users_ar: intendedUser === "other" ? intendedUserOther : (intendedUser ? INTENDED_USERS_OPTIONS[intendedUser] || null : null),
          valuation_mode: valuationMode || "field",
          valuation_type: (assetType === "machinery_equipment" ? "machinery" : assetType === "both" ? "mixed" : assetType) as any,
          property_description_ar: combinedNotes || null, status: "under_pricing" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            files: uploadedFiles.map(f => ({ name: f.name, path: f.path, type: f.type })),
            totalAssets: supportedAssets.length, unsupportedAssets: unsupportedAssets.length, simplified: true, quick_request: true,
            ai_asset_type_detection: aiClassification, user_review_completed: true,
            locations: assetLocations.map(l => ({ name: l.name, city: l.city, googleMapsUrl: l.googleMapsUrl, latitude: l.latitude, longitude: l.longitude })),
          },
          asset_data: assetData,
        } as any).select().single();

      if (reqError) throw reqError;
      const newRequestId = (reqData as any)?.id;

      setProcessingProgress(70); setProcessingLabel("جارٍ ربط المستندات...");
      if (uploadedFiles.length > 0 && newRequestId) {
        await supabase.from("request_documents" as any).insert(
          uploadedFiles.map(f => ({ request_id: newRequestId, uploaded_by: user.id, file_name: f.name, file_path: f.path, file_size: f.size, mime_type: f.type }))
        );
      }

      await supabase.from("audit_logs").insert({
        user_id: user.id, action: "create" as any, table_name: "valuation_requests", record_id: newRequestId,
        description: `طلب تقييم جديد | نوع: ${assetType} | أصول مشمولة: ${supportedAssets.length} | مستبعدة: ${unsupportedAssets.length}`,
        new_data: { ai_classification: aiClassification, supported_count: supportedAssets.length, unsupported_count: unsupportedAssets.length, review_required_count: reviewRequiredAssets.length, user_review_completed: true } as any,
        user_role: "client",
      });

      supabase.from("request_messages" as any).insert({
        request_id: newRequestId, sender_type: "system" as any,
        content: "✅ تم استلام طلبك بنجاح، يتم الآن مراجعة الطلب وإعداد عرض السعر.\nسيتم إشعارك فور جاهزية العرض.",
      }).then(() => {});

      supabase.functions.invoke("send-notification", {
        body: { notification_type: "new_request_pricing", user_id: user.id, data: { requestId: newRequestId, assetType, assetsCount: supportedAssets.length, clientName: clientNameInput || clientName } },
      }).catch(() => {});

      setProcessingProgress(100); setProcessingLabel("تم إرسال الطلب بنجاح!"); setRequestId(newRequestId);
      await new Promise(r => setTimeout(r, 600)); setState("done");
    } catch (err: any) {
      toast({ title: "خطأ في الإرسال", description: err.message, variant: "destructive" }); setState("review");
    } finally { setSubmitting(false); }
  };

  // ── State screens ──
  if (state === "extraction_failed") {
    return <ExtractionFailedScreen reason={extractionFailureReason} onRetry={() => { setExtractionFailureReason(""); handleStartAnalysis(); }} onModifyFiles={() => { setState("form"); setExtractionFailureReason(""); }} />;
  }
  if (state === "done") return <DoneScreen requestId={requestId} />;
  if (state === "processing") return <ProgressScreen progress={processingProgress} label={processingLabel} title="جارٍ إرسال طلبك" subtitle="يتم التحليل وفقاً للمعايير المهنية المعتمدة" icon="spinner" />;
  if (state === "analyzing") return <ProgressScreen progress={analysisProgress} label={analysisLabel} title="جارٍ التحليل الذكي" subtitle="يتم استخراج الأصول وفحص الترخيص تلقائياً" icon="sparkles" />;

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
          <AIReviewStep data={reviewData} onApprove={handleReviewApprove} onBack={() => { setState("form"); setReviewData(null); }} />
        </div>
      </div>
    );
  }

  // ── Validation ──
  const missing: string[] = [];
  if (uploadedFiles.length === 0) missing.push("المستندات");
  if (!confirmedType) missing.push("نوع الأصل");
  if (!clientNameInput.trim()) missing.push("اسم العميل");
  if (!clientPhone.trim()) missing.push("الجوال");
  if (!purpose) missing.push("الغرض من التقييم");
  if (purpose === "other" && !purposeOther.trim()) missing.push("تحديد الغرض");
  if (!intendedUser) missing.push("المستخدم المستهدف");
  if (intendedUser === "other" && !intendedUserOther.trim()) missing.push("تحديد المستخدم");
  if (assetLocations.length === 0) missing.push("موقع الأصل (رابط الخريطة)");
  const isDisabled = missing.length > 0 || uploading || detecting;

  // ── FORM ──
  return (
    <div className="min-h-screen bg-background" dir="rtl">
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
              {[{ n: 1, l: "رفع الملفات" }, { n: 2, l: "مراجعة الجرد" }, { n: 3, l: "التأكيد" }].map((step, i) => (
                <div key={step.n} className="flex items-center gap-1.5">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.n === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{step.n}</div>
                  <span className={`text-[10px] ${step.n === 1 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>{step.l}</span>
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
          <div className="lg:col-span-2 space-y-5">
            <ClientInfoForm
              clientNameInput={clientNameInput} setClientNameInput={setClientNameInput}
              clientIdNumber={clientIdNumber} setClientIdNumber={setClientIdNumber}
              clientPhone={clientPhone} setClientPhone={setClientPhone}
              clientEmail={clientEmail} setClientEmail={setClientEmail}
              purpose={purpose} setPurpose={setPurpose}
              purposeOther={purposeOther} setPurposeOther={setPurposeOther}
              intendedUser={intendedUser} setIntendedUser={setIntendedUser}
              intendedUserOther={intendedUserOther} setIntendedUserOther={setIntendedUserOther}
              valuationMode={valuationMode} setValuationMode={setValuationMode}
            />

            <FileUploadZone
              files={uploadedFiles} uploading={uploading} dragOver={dragOver}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onFileSelect={files => handleFileUpload(files)}
              onRemove={id => setUploadedFiles(prev => prev.filter(f => f.id !== id))}
            />

            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-primary" />
                  مواقع الأصول <span className="text-destructive">*</span>
                </p>
                <p className="text-[10px] text-muted-foreground">الصق روابط خرائط قوقل لمواقع الأصول (يمكنك اضافة مواقع متعددة).</p>
                <AssetLocationPicker locations={assetLocations} onChange={setAssetLocations} maxLocations={50} compact />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm font-semibold text-foreground">ملاحظات <Badge variant="secondary" className="text-[10px] mr-1">اختياري</Badge></p>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="مثال: تقييم لغرض البيع — عدد الأصول 15 — الموقع: جدة، حي الروضة..." rows={3} className="text-sm" />
                <p className="text-[10px] text-muted-foreground">أضف أي معلومات تساعد فريق التقييم: حالة الأصول، تفاصيل إضافية، إلخ.</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            {uploadedFiles.length > 0 && (
              <AssetTypeDetector
                detecting={detecting} confirmedType={confirmedType} detectedType={detectedType}
                detectionFailed={detectionFailed} detectionConfidence={detectionConfidence}
                detectionReason={detectionReason} showManualOverride={showManualOverride}
                onConfirm={() => { if (detectedType) setConfirmedType(detectedType); }}
                onManualSelect={type => { setConfirmedType(type); setShowManualOverride(false); }}
                onResetConfirmation={() => { setConfirmedType(null); setShowManualOverride(false); }}
                onShowManualOverride={() => setShowManualOverride(true)}
              />
            )}

            {missing.length > 0 && uploadedFiles.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300" dir="rtl">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold mb-1">يرجى إكمال الحقول التالية للمتابعة:</p>
                  <p>{missing.join(" • ")}</p>
                </div>
              </div>
            )}

            <Button onClick={handleStartAnalysis} className="w-full gap-2 h-12 text-sm" size="lg" disabled={isDisabled}>
              <Sparkles className="w-4 h-4" />
              متابعة — تحليل الملفات ومراجعة الجرد
            </Button>

            <RequestGuidance />
          </div>
        </div>
      </div>
    </div>
  );
}
