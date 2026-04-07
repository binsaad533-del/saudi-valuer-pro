import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { parseExcelFile, autoMapColumns, applyMapping } from "@/lib/excel-parser";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Image,
  File,
  X,
  Loader2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  User as UserIcon,
  Send,
  Home,
  Edit3,
  Clock,
  Shield,
  AlertTriangle,
  Table2,
} from "lucide-react";
import logo from "@/assets/logo.png";
import ScopeAssetsTable, { type ScopeAsset } from "@/components/client/ScopeAssetsTable";

// ── Types ──
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  rawFile?: File;
}

type JourneyStep = "start" | "upload" | "processing" | "scope" | "complete";

const PURPOSE_OPTIONS: Record<string, string> = {
  sale_purchase: "بيع / شراء",
  mortgage: "تمويل / رهن",
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

const USERS_OPTIONS: Record<string, string> = {
  bank: "بنك / مؤسسة مالية",
  government: "جهة حكومية",
  court: "محكمة",
  internal_management: "إدارة داخلية",
  investor: "مستثمر",
  other: "أخرى",
};

export default function SimplifiedJourney() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<JourneyStep>("start");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Step 1: Client info
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [purpose, setPurpose] = useState("");
  const [purposeOther, setPurposeOther] = useState("");
  const [intendedUsers, setIntendedUsers] = useState("");
  const [intendedUsersOther, setIntendedUsersOther] = useState("");
  const [valuationMode, setValuationMode] = useState<"field" | "desktop">("field");
  const [desktopDisclaimer, setDesktopDisclaimer] = useState(false);

  // Step 2: Files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Step 3: Processing
  const [jobId, setJobId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState("جارٍ تحليل المستندات...");

  // Step 4: Scope
  const [scopeData, setScopeData] = useState<any>(null);
  const pendingExcelAssetsRef = useRef<ScopeAsset[]>([]);
  const [scopeConfirmed, setScopeConfirmed] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);

      // Pre-fill from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar, phone")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile?.full_name_ar) setClientName(profile.full_name_ar);
      if (profile?.phone) setClientPhone(profile.phone);
      if (user.email) setClientEmail(user.email);
    };
    checkAuth();
  }, [navigate]);

  // ── File handling ──
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4 text-info" />;
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
    if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <Table2 className="w-4 h-4 text-success" />;
    return <File className="w-4 h-4 text-muted-foreground" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileUpload = async (fileList: FileList) => {
    if (!user) {
      toast({ title: "يجب تسجيل الدخول أولاً", description: "يرجى تسجيل الدخول ثم إعادة المحاولة.", variant: "destructive" });
      return;
    }

    setUploading(true);
    const newFiles: UploadedFile[] = [];

    try {
      for (const file of Array.from(fileList)) {
        const { storageKey, originalFilename } = buildSafeStorageObject({
          userId: user.id,
          originalFilename: file.name,
        });

        const { error } = await supabase.storage.from("client-uploads").upload(storageKey, file);
        if (error) {
          toast({ title: `تعذر رفع الملف ${originalFilename}`, description: getUploadErrorMessage(error), variant: "destructive" });
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

  // ── Step 1 → Step 2 ──
  const handleStartRequest = () => {
    if (!clientName.trim()) { toast({ title: "يرجى إدخال اسم العميل", variant: "destructive" }); return; }
    if (!clientPhone.trim()) { toast({ title: "يرجى إدخال رقم الجوال", variant: "destructive" }); return; }
    if (!purpose) { toast({ title: "يرجى اختيار الغرض من التقييم", variant: "destructive" }); return; }
    if (purpose === "other" && !purposeOther.trim()) { toast({ title: "يرجى تحديد الغرض", variant: "destructive" }); return; }
    if (!intendedUsers) { toast({ title: "يرجى اختيار مستخدمي التقرير", variant: "destructive" }); return; }
    if (intendedUsers === "other" && !intendedUsersOther.trim()) { toast({ title: "يرجى تحديد مستخدمي التقرير", variant: "destructive" }); return; }
    setStep("upload");
  };

  const isExcelOrCsv = (type: string, name: string) =>
    type.includes("sheet") || type.includes("excel") || type.includes("csv") ||
    /\.(xlsx|xls|csv)$/i.test(name);

  /** Compliance: which asset types are permitted under our license */
  const ASSET_COMPLIANCE: Record<string, { permitted: boolean; note?: string }> = {
    real_estate: { permitted: true },
    machinery_equipment: { permitted: true },
    medical_equipment: { permitted: true },
    vehicle: { permitted: true, note: "تقييم قيمة المركبة كأصل فقط — تقييم أضرار الحوادث يتطلب ترخيصاً مستقلاً" },
    furniture: { permitted: true },
    it_equipment: { permitted: true },
    leasehold_improvements: { permitted: true },
    right_of_use: { permitted: true, note: "مسموح كـ«مصلحة مستأجرة» عقارية أو حق استخدام آلة — غير مسموح كأداة مالية مشتقة" },
    intangible: { permitted: false, note: "يتطلب ترخيص فرع تقييم المنشآت الاقتصادية" },
    goodwill: { permitted: false, note: "شهرة المحل — يتطلب ترخيص فرع تقييم المنشآت الاقتصادية" },
    financial_instrument: { permitted: false, note: "أدوات مالية (أسهم، سندات) — يتطلب ترخيص فرع تقييم المنشآت الاقتصادية" },
  };

  /** Smart asset type inference based on name and category keywords */
  const inferAssetType = (name: string, category: string | null): { type: string; category: string | null } => {
    const text = `${name} ${category || ""}`.toLowerCase();

    // Right of use / Lease contracts (permitted as leasehold interest)
    if (/عقد\s*ايجار|عقد\s*إيجار|right\s*of\s*use|إيجار\s*فرع|ايجار\s*فرع|lease/i.test(text))
      return { type: "right_of_use", category: "حق استخدام (مصلحة مستأجرة)" };

    // Real estate
    if (/عقار|أرض|ارض|فيلا|شقة|عمارة|مبنى|real.?estate|land|building|villa|apartment/i.test(text))
      return { type: "real_estate", category: category };

    // Medical equipment
    if (/طبي|مختبر|جهاز\s*فحص|medical|lab|analyzer|microscop|centrifug|autoclave|incubator|pipette|spectro/i.test(text))
      return { type: "medical_equipment", category: "أجهزة طبية" };

    // Vehicles
    if (/سيارة|مركبة|vehicle|car|truck|van|شاحن/i.test(text))
      return { type: "vehicle", category: "مركبات" };

    // Furniture & fixtures
    if (/أثاث|اثاث|مكتب|كرسي|طاولة|خزانة|furniture|desk|chair|table|ستائر|ستارة/i.test(text))
      return { type: "furniture", category: "أثاث ومفروشات" };

    // IT equipment
    if (/كمبيوتر|حاسب|لابتوب|طابعة|سيرفر|شاشة|computer|laptop|printer|server|monitor|it\s*equip/i.test(text))
      return { type: "it_equipment", category: "أجهزة تقنية" };

    // Intangible assets (NOT permitted)
    if (/برنامج|برمج|تطبيق|نظام|software|program|app|license|ترخيص|intangible|موقع\s*الكتروني|موبايل\s*اب/i.test(text))
      return { type: "intangible", category: "أصول غير ملموسة" };

    // Leasehold improvements
    if (/تشطيب|تأسيس\s*فرع|تحسين|ديكور|كلادينج|لوحة|دفاع\s*مدني|leasehold|improvement|تأسيس\s*توسعة/i.test(text))
      return { type: "leasehold_improvements", category: "تحسينات مستأجرة" };

    // Default: machinery/equipment
    return { type: "machinery_equipment", category: category };
  };


  const parseExcelFilesLocally = async (excelFiles: UploadedFile[]): Promise<ScopeAsset[]> => {
    const allAssets: ScopeAsset[] = [];
    for (const uf of excelFiles) {
      if (!uf.rawFile) continue;
      try {
        const result = await parseExcelFile(uf.rawFile);
        for (const sheet of result.sheets) {
          const mappings = autoMapColumns(sheet.headers);
          const mapped = applyMapping(sheet.rows, mappings);
          for (const row of mapped) {
            const hasMinData = (row.name && row.name !== `أصل ${row._rowIndex}`) || row.value || row.type;
            if (!hasMinData && !row.quantity) continue;
            const fields: { key: string; value: any }[] = [];
            for (const [k, v] of Object.entries(row)) {
              if (k.startsWith("_") || !v) continue;
              fields.push({ key: k, value: v });
            }
            const confidence = mappings.filter(m => m.autoMapped).length >= 2 ? 80 : mappings.filter(m => m.autoMapped).length === 1 ? 50 : 20;
            const assetName = String(row.name || "");
            const detectedType = inferAssetType(assetName, row.type ? String(row.type) : null);
            allAssets.push({
              id: crypto.randomUUID(),
              asset_index: allAssets.length + 1,
              name: assetName || `أصل ${allAssets.length + 1}`,
              asset_type: detectedType.type,
              category: detectedType.category || (row.type ? String(row.type) : null),
              subcategory: null,
              quantity: Number(row.quantity) || 1,
              condition: row.condition ? String(row.condition) : "unknown",
              confidence,
              review_status: confidence >= 70 ? "approved" : "needs_review",
              source_evidence: `${uf.name} → ${sheet.name}`,
              asset_data: { fields },
            });
          }
        }
      } catch (e) {
        console.error("Excel parse error:", e);
      }
    }
    return allAssets;
  };

  // ── Step 2 → Step 3 (auto-process) ──
  const handleUploadDone = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: "يرجى رفع ملف واحد على الأقل", variant: "destructive" });
      return;
    }

    const excelFiles = uploadedFiles.filter(f => isExcelOrCsv(f.type, f.name));
    const otherFiles = uploadedFiles.filter(f => !isExcelOrCsv(f.type, f.name));

    // If ALL files are Excel/CSV → parse locally (instant, no edge function)
    if (excelFiles.length > 0 && otherFiles.length === 0) {
      setStep("processing");
      setProcessingProgress(10);
      setProcessingStatus("جارٍ قراءة ملف Excel...");

      try {
        const assets = await parseExcelFilesLocally(excelFiles);
        setProcessingProgress(100);
        setProcessingStatus("اكتمل التحليل بنجاح");

        const realEstate = assets.filter(a => a.asset_type === "real_estate").length;
        const machinery = assets.filter(a => a.asset_type === "machinery_equipment").length;

        setScopeData({
          totalAssets: assets.length,
          realEstate,
          machinery,
          assets,
          discipline: realEstate >= machinery ? "real_estate" : "machinery_equipment",
          approach: realEstate > 0 ? "المقارنة السوقية + التكلفة" : "التكلفة + الإهلاك",
        });

        await new Promise(r => setTimeout(r, 400));
        setStep("scope");
      } catch (err: any) {
        toast({ title: "خطأ في قراءة الملف", description: "تعذر تحليل ملف Excel — يرجى التأكد من صحة الملف.", variant: "destructive" });
        setStep("upload");
      }
      return;
    }

    // Images/PDFs present → use AI orchestrator for analysis
    setStep("processing");
    setProcessingProgress(5);
    setProcessingStatus("جارٍ تجهيز الملفات للتحليل الذكي...");

    try {
      let excelAssets: ScopeAsset[] = [];

      // Parse Excel files locally first (fast)
      if (excelFiles.length > 0) {
        setProcessingStatus("جارٍ قراءة ملفات Excel...");
        excelAssets = await parseExcelFilesLocally(excelFiles);
        setProcessingProgress(20);
      }

      // Send images/PDFs to AI orchestrator for asset extraction
      setProcessingStatus("جارٍ تحليل الصور والمستندات بالذكاء الاصطناعي...");
      const filesToAnalyze = otherFiles.map(f => ({
        name: f.name,
        path: f.path,
        size: f.size,
        mimeType: f.type,
      }));

      const { data: jobData, error: jobError } = await supabase.functions.invoke(
        "asset-extraction-orchestrator",
        { body: { action: "create", userId: user.id, files: filesToAnalyze, requestId } }
      );

      if (jobError || !jobData?.jobId) {
        console.error("Orchestrator error:", jobError, jobData);
        // Fallback: proceed with Excel assets only + images as attachments
        const realEstate = excelAssets.filter(a => a.asset_type === "real_estate").length;
        const machinery = excelAssets.filter(a => a.asset_type === "machinery_equipment").length;
        setScopeData({
          totalAssets: excelAssets.length,
          realEstate,
          machinery,
          assets: excelAssets,
          attachedFiles: otherFiles.map(f => ({ name: f.name, path: f.path, type: f.type })),
          discipline: realEstate >= machinery ? "real_estate" : "machinery_equipment",
          approach: realEstate > 0 ? "المقارنة السوقية + التكلفة" : "التكلفة + الإهلاك",
        });
        setProcessingProgress(100);
        setProcessingStatus("اكتمل التحليل بنجاح");
        await new Promise(r => setTimeout(r, 400));
        setStep("scope");
        return;
      }

      // Store jobId and let the polling useEffect handle the rest
      setJobId(jobData.jobId);
      setProcessingProgress(25);
      setProcessingStatus("جارٍ تحليل الصور بالذكاء الاصطناعي...");

      // Store excel assets to merge later when polling completes
      if (excelAssets.length > 0) {
        pendingExcelAssetsRef.current = excelAssets;
      }
    } catch (err: any) {
      console.error("Processing error:", err);
      toast({ title: "خطأ في تحليل الملفات", description: "تعذر تحليل الملفات — يرجى المحاولة مرة أخرى.", variant: "destructive" });
      setStep("upload");
    }
  };

  // Poll processing status
  useEffect(() => {
    if (step !== "processing" || !jobId) return;
    let cancelled = false;
    const startedAt = Date.now();
    const timeoutMs = 90 * 1000;

    const poll = async () => {
      while (!cancelled) {
        const { data } = await supabase
          .from("processing_jobs")
          .select("status, processed_files, total_files, total_assets_found")
          .eq("id", jobId)
          .maybeSingle();

        if (!data || cancelled) break;

        const statusProgressMap: Record<string, number> = {
          pending: 5,
          uploading: 10,
          classifying: 25,
          extracting: 50,
          deduplicating: 75,
          merging: 90,
          ready: 100,
        };

        const fileProgress = data.total_files > 0
          ? Math.round((data.processed_files / data.total_files) * 100)
          : 0;
        const prog = Math.max(statusProgressMap[data.status] ?? 0, fileProgress);
        setProcessingProgress(prog);

        if (data.status === "ready" || data.status === "completed" || data.status === "ready_for_review") {
          setProcessingProgress(100);
          setProcessingStatus("اكتمل التحليل بنجاح");

          const { data: rawAssets } = await supabase
            .from("extracted_assets")
            .select("*")
            .eq("job_id", jobId);

          // Convert extracted_assets to ScopeAsset format
          const aiAssets: ScopeAsset[] = (rawAssets || []).map((a: any, idx: number) => ({
            id: a.id,
            asset_index: idx,
            name: a.name || "أصل مستخرج",
            asset_type: a.asset_type || "machinery_equipment",
            category: a.category || a.subcategory || null,
            subcategory: a.subcategory || null,
            quantity: a.quantity || 1,
            condition: a.condition || null,
            confidence: a.confidence || 0.5,
            review_status: a.review_status || "pending",
            source_evidence: a.source_evidence || "صورة مرفوعة",
            asset_data: a.asset_data || {},
          }));

          // Merge with any pending Excel assets
          const pendingExcel = pendingExcelAssetsRef.current;
          const allAssets = [...pendingExcel, ...aiAssets];

          const realEstate = allAssets.filter(a => a.asset_type === "real_estate").length;
          const machinery = allAssets.filter(a => a.asset_type === "machinery_equipment").length;

          setScopeData({
            totalAssets: allAssets.length,
            realEstate,
            machinery,
            assets: allAssets,
            discipline: realEstate >= machinery ? "real_estate" : "machinery_equipment",
            approach: realEstate > 0 ? "المقارنة السوقية + التكلفة" : "التكلفة + الإهلاك",
          });

          await new Promise(r => setTimeout(r, 500));
          if (!cancelled) setStep("scope");
          break;
        }

        if (data.status === "failed") {
          toast({ title: "فشلت المعالجة", variant: "destructive" });
          if (!cancelled) setStep("upload");
          break;
        }

        if (Date.now() - startedAt >= timeoutMs) {
          toast({
            title: "استغرقت المعالجة وقتًا أطول من المتوقع",
            description: "يمكنك إعادة المحاولة أو رفع الملفات من جديد.",
            variant: "destructive",
          });
          if (!cancelled) setStep("upload");
          break;
        }

        if (["pending", "uploading", "classifying"].includes(data.status)) setProcessingStatus("جارٍ قراءة وتصنيف المستندات...");
        else if (data.status === "extracting") setProcessingStatus("جارٍ استخراج بيانات الأصول...");
        else if (data.status === "deduplicating") setProcessingStatus("جارٍ التحقق والمراجعة الآلية...");
        else if (data.status === "merging") setProcessingStatus("جارٍ إعداد نطاق العمل...");
        else setProcessingStatus("جارٍ تجهيز طلبك...");

        await new Promise(r => setTimeout(r, 2500));
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [step, jobId, toast]);

  // ── Step 4: Submit ──
  const handleConfirmScope = async () => {
    if (!user || !scopeData) return;
    setLoading(true);
    setScopeConfirmed(true);

    try {
      const assetData = {
        discipline: scopeData.discipline,
        inventory: scopeData.assets
          .filter((a: any) => a.review_status !== "rejected")
          .map((a: any) => ({
            id: a.asset_index, name: a.name, type: a.asset_type,
            category: a.category, subcategory: a.subcategory,
            quantity: a.quantity, condition: a.condition,
            fields: a.asset_data?.fields || [],
            source: a.source_evidence, confidence: a.confidence,
          })),
        summary: {
          total: scopeData.totalAssets,
          by_type: { real_estate: scopeData.realEstate, machinery_equipment: scopeData.machinery },
        },
        jobId,
      };

      const usersText = intendedUsers === "other" ? intendedUsersOther : (USERS_OPTIONS[intendedUsers] || intendedUsers);

      const { data, error } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (scopeData.discipline === "machinery_equipment" ? "machinery" : scopeData.discipline) as any,
          purpose: (purpose || null) as any,
          purpose_ar: purpose === "other" ? purposeOther : null,
          intended_users_ar: usersText,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            jobId,
            files: uploadedFiles,
            clientInfo: { contactName: clientName, contactPhone: clientPhone, contactEmail: clientEmail },
            totalAssets: scopeData.totalAssets,
            simplified: true,
          },
          asset_data: assetData,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (jobId && data) {
        await supabase.from("processing_jobs").update({ request_id: (data as any).id }).eq("id", jobId);
      }

      if (uploadedFiles.length > 0 && data) {
        const docs = uploadedFiles.map(f => ({
          request_id: (data as any).id,
          uploaded_by: user.id,
          file_name: f.name, file_path: f.path, file_size: f.size, mime_type: f.type,
        }));
        await supabase.from("request_documents" as any).insert(docs);
      }

      setRequestId((data as any)?.id || null);
      setStep("complete");
      toast({ title: "تم إرسال طلبك بنجاح!" });

      // Trigger notification (fire-and-forget)
      supabase.functions.invoke("send-notification", {
        body: {
          notification_type: "request_submitted",
          user_id: user.id,
          data: { requestId: (data as any)?.id, clientName },
        },
      }).catch(() => {});

    } catch (err: any) {
      toast({ title: "خطأ في الإرسال", description: err.message, variant: "destructive" });
      setScopeConfirmed(false);
    } finally {
      setLoading(false);
    }
  };

  // ── Step labels ──
  const stepMeta = [
    { key: "start", label: "البيانات" },
    { key: "upload", label: "المستندات" },
    { key: "processing", label: "المعالجة" },
    { key: "scope", label: "الاعتماد" },
  ];
  const currentIdx = step === "complete" ? stepMeta.length : stepMeta.findIndex(s => s.key === step);

  // ── RENDER ──
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <h2 className="text-sm font-bold text-foreground">طلب تقييم</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/client")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة
          </Button>
        </div>
      </header>

      {/* Progress bar */}
      {step !== "complete" && (
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-2">
          <div className="flex items-center justify-between mb-3">
            {stepMeta.map((s, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done ? "bg-success text-success-foreground" :
                      active ? "bg-primary text-primary-foreground shadow-md" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${active ? "text-primary" : done ? "text-success" : "text-muted-foreground"}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < stepMeta.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 mt-[-14px] rounded ${done ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={`mx-auto px-4 pb-10 ${step === "scope" ? "max-w-5xl" : "max-w-2xl"}`}>

        {/* ═══════ STEP 1: START ═══════ */}
        {step === "start" && (
          <Card className="shadow-card mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserIcon className="w-5 h-5 text-primary" />
                بيانات الطلب
              </CardTitle>
              <p className="text-sm text-muted-foreground">أدخل البيانات الأساسية لبدء التقييم</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm">اسم العميل <span className="text-destructive">*</span></Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="الاسم الكامل أو اسم الجهة" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm">رقم الجوال <span className="text-destructive">*</span></Label>
                  <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">البريد الإلكتروني</Label>
                  <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="example@email.com" dir="ltr" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">الغرض من التقييم <span className="text-destructive">*</span></Label>
                <Select value={purpose} onValueChange={(val) => { setPurpose(val); if (val !== "other") setPurposeOther(""); }}>
                  <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PURPOSE_OPTIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {purpose === "other" && (
                  <Input value={purposeOther} onChange={e => setPurposeOther(e.target.value)} placeholder="حدد الغرض" className="mt-2" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">مستخدمو التقرير <span className="text-destructive">*</span></Label>
                <Select value={intendedUsers} onValueChange={(val) => { setIntendedUsers(val); if (val !== "other") setIntendedUsersOther(""); }}>
                  <SelectTrigger><SelectValue placeholder="اختر مستخدمي التقرير" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(USERS_OPTIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {intendedUsers === "other" && (
                  <Input value={intendedUsersOther} onChange={e => setIntendedUsersOther(e.target.value)} placeholder="حدد المستخدمين" className="mt-2" />
                )}
              </div>

              <Button onClick={handleStartRequest} className="w-full gap-2 mt-2" size="lg">
                <ArrowLeft className="w-4 h-4" />
                ابدأ التقييم
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ═══════ STEP 2: UPLOAD ═══════ */}
        {step === "upload" && (
          <div className="space-y-4 mt-4">
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-primary" />
                  ارفع المستندات
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  ارفع الصكوك، المخططات، جداول البيانات، أو أي وثائق متعلقة بالتقييم
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات أو اضغط للاختيار"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF • صور • Excel (XLSX, CSV) • Word
                  </p>
                  <p className="text-[11px] text-primary/70 mt-1">رفع Excel يسرّع إدخال الأصول تلقائياً</p>
                  {uploading && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">جارٍ الرفع...</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && handleFileUpload(e.target.files)}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.tif,.tiff,.zip,.webp"
                />

                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      الملفات ({uploadedFiles.length})
                    </p>
                    <div className="max-h-[220px] overflow-y-auto space-y-1">
                      {uploadedFiles.map(file => (
                        <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                          {getFileIcon(file.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate">{file.name}</p>
                            <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                          </div>
                          <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-destructive p-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("start")} className="gap-1.5">
                <ArrowRight className="w-4 h-4" />
                رجوع
              </Button>
              <Button
                onClick={handleUploadDone}
                className="flex-1 gap-2"
                size="lg"
                disabled={uploadedFiles.length === 0 || uploading}
              >
                <Send className="w-4 h-4" />
                تحليل ومعالجة ({uploadedFiles.length} ملف)
              </Button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 3: PROCESSING (HIDDEN/AUTO) ═══════ */}
        {step === "processing" && (
          <div className="mt-8 flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-foreground mb-2">جارٍ تجهيز طلبك</h3>
            <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
              {processingStatus}
            </p>
            <div className="w-full max-w-xs">
              <Progress value={processingProgress} className="h-2 mb-2" />
              <p className="text-xs text-muted-foreground text-center">{processingProgress}%</p>
            </div>
            <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>يتم التحليل وفقاً للمعايير المهنية المعتمدة</span>
            </div>
          </div>
        )}

        {/* ═══════ STEP 4: SCOPE CONFIRMATION ═══════ */}
        {step === "scope" && scopeData && (
          <div className="space-y-4 mt-4">
            <Card className="shadow-card border-2 border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-5 h-5 text-success" />
                  <CardTitle className="text-lg">نطاق العمل جاهز</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  تم تحليل المستندات وإعداد نطاق العمل تلقائياً — راجع الأصول المستخرجة وأكد
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3 border border-border text-center">
                    <p className="text-xs text-muted-foreground">الأصول المستخرجة</p>
                    <p className="text-2xl font-bold text-foreground">{scopeData.assets?.length || 0}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3 border border-border text-center">
                    <p className="text-xs text-muted-foreground">المستندات</p>
                    <p className="text-2xl font-bold text-foreground">{uploadedFiles.length}</p>
                  </div>
                  {/* Dynamic type breakdown */}
                  {(() => {
                    const typeCounts: Record<string, number> = {};
                    const TYPE_AR: Record<string, string> = {
                      real_estate: "عقارات", machinery_equipment: "آلات ومعدات",
                      right_of_use: "حقوق استخدام", vehicle: "مركبات",
                      furniture: "أثاث", it_equipment: "أجهزة تقنية",
                      intangible: "غير ملموسة", leasehold_improvements: "تحسينات",
                      medical_equipment: "أجهزة طبية",
                    };
                    for (const a of (scopeData.assets || [])) typeCounts[a.asset_type] = (typeCounts[a.asset_type] || 0) + 1;
                    return Object.entries(typeCounts).map(([type, count]) => {
                      const compliance = ASSET_COMPLIANCE[type];
                      const isRestricted = compliance && !compliance.permitted;
                      return (
                        <div key={type} className={`rounded-lg p-3 border text-center ${isRestricted ? "bg-destructive/5 border-destructive/30" : "bg-muted/50 border-border"}`}>
                          <p className={`text-xs ${isRestricted ? "text-destructive" : "text-muted-foreground"}`}>
                            {isRestricted && "⛔ "}{TYPE_AR[type] || type}
                          </p>
                          <p className={`text-2xl font-bold ${isRestricted ? "text-destructive/60 line-through" : "text-primary"}`}>{count}</p>
                        </div>
                      );
                    });
                  })()}
                </div>

                {/* Compliance alerts */}
                {(() => {
                  const restricted = (scopeData.assets || []).filter((a: any) => ASSET_COMPLIANCE[a.asset_type] && !ASSET_COMPLIANCE[a.asset_type].permitted);
                  const warnings = (scopeData.assets || []).filter((a: any) => ASSET_COMPLIANCE[a.asset_type]?.note && ASSET_COMPLIANCE[a.asset_type]?.permitted);
                  const restrictedTypes = Array.from(new Set(restricted.map((a: any) => String(a.asset_type))));
                  const warningTypes = Array.from(new Set(warnings.map((a: any) => String(a.asset_type))));

                  if (restrictedTypes.length === 0 && warningTypes.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      {restrictedTypes.length > 0 && (
                        <div className="bg-destructive/5 border border-destructive/30 rounded-lg p-4 space-y-2">
                          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>أصول خارج نطاق الترخيص ({restricted.length} أصل)</span>
                          </div>
                          <p className="text-xs text-destructive/80">
                            الأصول التالية تتطلب ترخيص «تقييم المنشآت الاقتصادية» ولا يمكن تقييمها ضمن هذا الطلب وسيتم استبعادها تلقائياً:
                          </p>
                          <ul className="text-xs text-destructive/70 space-y-1 pr-4">
                            {restrictedTypes.map((type: string) => (
                              <li key={type} className="flex justify-between">
                                <span>• {ASSET_COMPLIANCE[type]?.note || type}</span>
                                <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">{(scopeData.assets || []).filter((a: any) => a.asset_type === type).length}</Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {warningTypes.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-xs">
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span>ملاحظات مهنية</span>
                          </div>
                          <ul className="text-[11px] text-amber-600 dark:text-amber-400/80 space-y-1 pr-4">
                            {warningTypes.map((type: string) => (
                              <li key={type}>• {ASSET_COMPLIANCE[type]?.note}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
                <ScopeAssetsTable
                  assets={(scopeData.assets || []).map((a: any) => ({
                    id: a.id || crypto.randomUUID(),
                    asset_index: a.asset_index || 0,
                    name: a.name || "أصل",
                    asset_type: a.asset_type || "machinery_equipment",
                    category: a.category,
                    subcategory: a.subcategory,
                    quantity: a.quantity || 1,
                    condition: a.condition || "unknown",
                    confidence: a.confidence || 50,
                    review_status: a.review_status,
                    source_evidence: a.source_evidence,
                    asset_data: a.asset_data || {},
                  } as ScopeAsset))}
                  onAssetsChange={(updated) => {
                    setScopeData((prev: any) => ({
                      ...prev,
                      assets: updated,
                      totalAssets: updated.length,
                      realEstate: updated.filter((a: any) => a.asset_type === "real_estate").length,
                      machinery: updated.filter((a: any) => a.asset_type === "machinery_equipment").length,
                    }));
                  }}
                />

                {/* Meta info */}
                <div className="bg-muted/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">الغرض</span>
                    <span className="font-medium text-foreground">{purpose === "other" ? purposeOther : PURPOSE_OPTIONS[purpose]}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">مستخدمو التقرير</span>
                    <span className="font-medium text-foreground">{intendedUsers === "other" ? intendedUsersOther : USERS_OPTIONS[intendedUsers]}</span>
                  </div>
                  {(() => {
                    const TYPE_INFO: Record<string, { label: string; desc: string }> = {
                      real_estate: { label: "عقارات", desc: "أراضي، مباني، فلل، شقق، عمائر تجارية وصناعية" },
                      machinery_equipment: { label: "آلات ومعدات", desc: "معدات تشغيلية وصناعية وإنتاجية" },
                      medical_equipment: { label: "أجهزة طبية", desc: "أجهزة تحليل ومختبرات ومعدات طبية" },
                      vehicle: { label: "مركبات", desc: "تقييم قيمة المركبة كأصل ثابت" },
                      furniture: { label: "أثاث ومفروشات", desc: "أثاث مكتبي وتجهيزات داخلية" },
                      it_equipment: { label: "أجهزة تقنية", desc: "حاسبات، طابعات، شاشات، سيرفرات" },
                      leasehold_improvements: { label: "تحسينات مستأجرة", desc: "تشطيبات، ديكورات، لوحات، أنظمة سلامة" },
                      right_of_use: { label: "مصالح مستأجرة", desc: "حقوق منفعة عقارية أو حق استخدام آلة" },
                    };
                    const counts: Record<string, number> = {};
                    for (const a of (scopeData.assets || [])) {
                      if (ASSET_COMPLIANCE[a.asset_type] && !ASSET_COMPLIANCE[a.asset_type].permitted) continue;
                      counts[a.asset_type] = (counts[a.asset_type] || 0) + 1;
                    }
                    const total = Object.values(counts).reduce((s, c) => s + c, 0);
                    return (
                      <>
                        <div className="flex justify-between items-center text-xs border-b border-border pb-2 mb-1">
                          <span className="text-foreground font-bold">إجمالي الأصول المعتمدة للتقييم</span>
                          <Badge className="text-[11px]">{total}</Badge>
                        </div>
                        {Object.entries(counts).map(([type, count]) => (
                          <div key={type} className="flex justify-between items-start text-xs gap-2">
                            <div className="min-w-0">
                              <span className="text-foreground font-medium">{TYPE_INFO[type]?.label || type}</span>
                              {TYPE_INFO[type]?.desc && (
                                <p className="text-[10px] text-muted-foreground mt-0.5">{TYPE_INFO[type].desc}</p>
                              )}
                            </div>
                            <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirmScope}
                    className="flex-1 gap-2"
                    size="lg"
                    disabled={loading || scopeConfirmed || (scopeData.assets?.length || 0) === 0}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    اعتماد وإرسال ({scopeData.assets?.length || 0} أصل)
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => navigate("/client/new-request")}
                    className="gap-1.5"
                  >
                    <Edit3 className="w-4 h-4" />
                    تعديل مفصّل
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══════ STEP 5: COMPLETE ═══════ */}
        {step === "complete" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك بنجاح!</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-2">
              سيتم مراجعة طلبك وإعداد التقرير وفقاً للمعايير المهنية المعتمدة.
              ستصلك إشعارات عند كل تحديث.
            </p>
            <div className="flex items-center gap-2 mt-2 mb-8">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">الوقت المتوقع: ٣-٥ أيام عمل</span>
            </div>
            <div className="w-full max-w-sm space-y-2">
              <Button onClick={() => navigate("/client")} className="w-full gap-2">
                <Home className="w-4 h-4" />
                العودة للوحة التحكم
              </Button>
              {requestId && (
                <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full gap-2">
                  <FileText className="w-4 h-4" />
                  تتبع الطلب
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
