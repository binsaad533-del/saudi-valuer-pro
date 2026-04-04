import { useState, useCallback, useRef, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, FileText, FolderUp, Loader2, X, Sparkles, Tag, Hash,
  FileSearch, File, FileCheck, ShieldCheck, Ruler, User, MapPin,
  Building2, Phone, Mail, Image as ImageIcon, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Copy, Upload, Home, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SAR } from "@/components/ui/saudi-riyal";

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

type FileStatus = "pending" | "uploading" | "uploaded" | "error";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  errorMsg?: string;
  category?: string;
  categoryLabel?: string;
  relevance?: string;
  extractedInfo?: string;
  storagePath?: string;
}

interface ExtractedNumber {
  label: string;
  value: string;
  source: string;
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
  asset: {
    description?: string;
    city?: string;
    district?: string;
    area?: string;
    deedNumber?: string;
    classification?: string;
    machineName?: string;
    manufacturer?: string;
    model?: string;
  };
  suggestedPurpose?: string;
  notes: string[];
  documentCategories: { fileName: string; category: string; categoryLabel?: string; relevance: string; extractedInfo?: string }[];
  extractedNumbers?: ExtractedNumber[];
  analysisMethod?: string;
  analyzedFilesCount?: number;
  totalFilesCount?: number;
}

const DEMO_FILES: UploadedFile[] = [
  { file: {} as any, name: "صك_ملكية_1234567.pdf", size: 2_450_000, status: "uploaded" },
  { file: {} as any, name: "رخصة_بناء_RB-2024-789.pdf", size: 1_120_000, status: "uploaded" },
  { file: {} as any, name: "مخطط_الدور_الأرضي.png", size: 3_780_000, status: "uploaded" },
  { file: {} as any, name: "عقد_إيجار_شركة_الأفق.pdf", size: 1_950_000, status: "uploaded" },
];

export default function AIDocumentProcessingPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>(DEMO_FILES);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState("");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [useMock, setUseMock] = useState(true);
  const [autoAnalyzePending, setAutoAnalyzePending] = useState(true);

  const handleFilesSelected = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles: UploadedFile[] = Array.from(files).map(f => ({
      file: f, name: f.name, size: f.size, status: "pending" as FileStatus,
    }));
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (useMock) setAutoAnalyzePending(true);
  }, [useMock]);

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

  const updateFileCategory = useCallback((index: number, category: string) => {
    const catInfo = DOC_CATEGORIES.find(c => c.value === category);
    setUploadedFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, category, categoryLabel: catInfo?.label || category } : f
    ));
  }, []);

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const generateMockResult = (files: UploadedFile[]): ExtractedData => {
    const guessCategory = (name: string): { category: string; label: string; extractedInfo?: string; relevance: string } => {
      const n = name.toLowerCase();
      const machineryKeywords = ["آلة", "الات", "معدة", "معدات", "حفار", "شيول", "مولد", "رافعة", "بوكلين", "كمبروسر", "ضاغط", "forklift", "generator", "crane", "excavator", "loader", "bulldozer", "compressor", "equipment", "machinery", "machine"];
      // صكوك ملكية
      if (n.includes("صك") || n.includes("deed") || n.includes("ملكي") || n.includes("title"))
        return { category: "deed", label: "صك ملكية", relevance: "high", extractedInfo: "رقم الصك: 1234567 — المالك: أحمد المالكي — المساحة: 450 م² — حي النرجس، الرياض — ثقة 96%" };
      // رخص بناء
      if (n.includes("رخص") || n.includes("permit") || n.includes("بناء") || n.includes("building"))
        return { category: "building_permit", label: "رخصة بناء", relevance: "high", extractedInfo: "رخصة رقم: RB-2024-789 — مساحة البناء: 320 م² — طابقين — ثقة 91%" };
      // مخططات معمارية
      if (n.includes("مخطط") || n.includes("plan") || n.includes("كروكي") || n.includes("layout") || n.includes("floor"))
        return { category: "floor_plan", label: "مخطط معماري", relevance: "medium", extractedInfo: "3 غرف نوم + صالة + مطبخ — ثقة 73% ⚠️ يحتاج تأكيد" };
      // تقارير تقييم سابقة
      if (n.includes("تقرير") || n.includes("تقييم") || n.includes("report") || n.includes("valuation") || n.includes("appraisal"))
        return { category: "technical_report", label: "تقرير تقييم سابق", relevance: "high", extractedInfo: "تقرير تقييم بتاريخ 1444/09/20 — القيمة السوقية: 2,350,000 ر.س" };
      // عقود إيجار
      if (n.includes("عقد") || n.includes("إيجار") || n.includes("contract") || n.includes("lease") || n.includes("rent") || n.includes("اتفاق"))
        return { category: "contract", label: "عقد إيجار", relevance: "medium", extractedInfo: "إيجار سنوي: 85,000 ر.س — المستأجر: شركة الأفق — ثقة 88%" };
      // فواتير
      if (n.includes("فاتور") || n.includes("invoice") || n.includes("سند") || n.includes("إيصال") || n.includes("receipt"))
        return { category: "invoice", label: "فاتورة / سند", relevance: "low", extractedInfo: "فاتورة شراء/صيانة معدات — المبلغ: 12,500 ر.س — التاريخ: 2024/03/15" };
      // وثائق هوية
      if (n.includes("هوي") || n.includes("جواز") || n.includes("إقام") || n.includes("id") || n.includes("passport") || n.includes("iqama"))
        return { category: "identity_doc", label: "وثيقة هوية", relevance: "medium", extractedInfo: "هوية وطنية — رقم: 1088456723 — الاسم: أحمد بن عبدالله المالكي" };
      // خرائط مواقع
      if (n.includes("map") || n.includes("خريط") || n.includes("موقع") || n.includes("location") || n.includes("gps"))
        return { category: "location_map", label: "خريطة موقع", relevance: "medium", extractedInfo: "إحداثيات: 24.7136°N, 46.6753°E — حي النرجس، الرياض" };
      // صور آلات ومعدات
      if (machineryKeywords.some(keyword => n.includes(keyword)) || n.includes("واتساب") && n.includes("معدة"))
        return { category: "machinery_photo", label: "صورة آلة / معدة", relevance: "high", extractedInfo: "صورة معدة تشغيل/إنتاج — يلزم التحقق من الشركة المصنعة والموديل وسنة الصنع" };
      // صور أصول عقارية
      if (/\.(jpg|jpeg|png|webp|tif|tiff|gif)$/i.test(n) || n.includes("صور") || n.includes("واجه") || n.includes("photo") || n.includes("img"))
        return { category: "property_photo", label: "صورة أصل عقاري", relevance: "medium", extractedInfo: "صورة أصل عقاري — يلزم تأكيد نوع الأصل من المستخدم" };
      // PDF عام
      if (n.endsWith(".pdf"))
        return { category: "technical_report", label: "مستند PDF", relevance: "medium", extractedInfo: "مستند PDF — يحتوي على بيانات نصية قابلة للاستخراج" };
      // Word/Excel
      if (/\.(doc|docx)$/i.test(n))
        return { category: "technical_report", label: "مستند Word", relevance: "medium", extractedInfo: "مستند نصي — قد يحتوي على جداول وبيانات تفصيلية" };
      if (/\.(xls|xlsx)$/i.test(n))
        return { category: "invoice", label: "جدول بيانات", relevance: "medium", extractedInfo: "ملف Excel — قد يحتوي على بيانات مالية أو جداول مقارنة" };
      return { category: "other", label: "أخرى", relevance: "low" };
    };

    const categorized = files.map(f => guessCategory(f.name));
    const cats = new Set(categorized.map(c => c.category));

    // بناء البيانات المستخرجة ديناميكياً حسب أنواع المستندات المكتشفة
    const numbers: ExtractedNumber[] = [];

    if (cats.has("deed")) {
      const deedSrc = files[categorized.findIndex(c => c.category === "deed")]?.name || "صك ملكية";
      numbers.push(
        { label: "رقم الصك", value: "1234567", source: deedSrc },
        { label: "مساحة الأرض", value: "450 م²", source: deedSrc },
        { label: "اسم المالك", value: "أحمد بن عبدالله المالكي", source: deedSrc },
        { label: "الموقع", value: "حي النرجس — الرياض", source: deedSrc },
        { label: "تاريخ إصدار الصك", value: "1445/03/15 هـ", source: deedSrc },
        { label: "نوع الاستخدام", value: "سكني", source: deedSrc },
        { label: "نسبة ثقة الاستخراج", value: "96%", source: deedSrc },
      );
    }
    if (cats.has("building_permit")) {
      const permitSrc = files[categorized.findIndex(c => c.category === "building_permit")]?.name || "رخصة بناء";
      numbers.push(
        { label: "رقم الرخصة", value: "RB-2024-789", source: permitSrc },
        { label: "مساحة البناء المرخصة", value: "320 م²", source: permitSrc },
        { label: "عدد الطوابق", value: "طابقين", source: permitSrc },
        { label: "تاريخ الرخصة", value: "1445/02/10 هـ", source: permitSrc },
        { label: "نسبة ثقة الاستخراج", value: "91%", source: permitSrc },
      );
    }
    if (cats.has("floor_plan")) {
      const planSrc = files[categorized.findIndex(c => c.category === "floor_plan")]?.name || "مخطط معماري";
      numbers.push(
        { label: "غرف النوم", value: "3 غرف", source: planSrc },
        { label: "الصالات", value: "صالة واحدة", source: planSrc },
        { label: "المطبخ", value: "1 مطبخ", source: planSrc },
        { label: "نسبة ثقة الاستخراج", value: "73% ⚠️", source: planSrc },
      );
    }
    if (cats.has("technical_report")) {
      const src = files[categorized.findIndex(c => c.category === "technical_report")]?.name || "تقرير تقييم";
      numbers.push(
        { label: "القيمة السوقية السابقة", value: "2,350,000 ر.س", source: src },
        { label: "تاريخ التقييم السابق", value: "1444/09/20 هـ", source: src },
        { label: "سعر المتر المربع", value: "3,760 ر.س/م²", source: src },
      );
    }
    if (cats.has("contract")) {
      const contractSrc = files[categorized.findIndex(c => c.category === "contract")]?.name || "عقد إيجار";
      numbers.push(
        { label: "قيمة الإيجار السنوي", value: "85,000 ر.س", source: contractSrc },
        { label: "اسم المستأجر", value: "شركة الأفق", source: contractSrc },
        { label: "مدة العقد", value: "سنة واحدة — قابل للتجديد", source: contractSrc },
        { label: "نسبة ثقة الاستخراج", value: "88%", source: contractSrc },
      );
    }
    if (cats.has("identity_doc")) {
      const src = files[categorized.findIndex(c => c.category === "identity_doc")]?.name || "وثيقة هوية";
      numbers.push(
        { label: "رقم الهوية", value: "1088456723", source: src },
        { label: "الاسم الكامل", value: "أحمد بن عبدالله المالكي", source: src },
        { label: "تاريخ الانتهاء", value: "1450/02/28 هـ", source: src },
      );
    }
    if (cats.has("invoice")) {
      const src = files[categorized.findIndex(c => c.category === "invoice")]?.name || "فاتورة";
      numbers.push(
        { label: "مبلغ الفاتورة", value: "12,500 ر.س", source: src },
        { label: "تاريخ الفاتورة", value: "2024/03/15", source: src },
      );
    }
    if (cats.has("location_map")) {
      const src = files[categorized.findIndex(c => c.category === "location_map")]?.name || "خريطة موقع";
      numbers.push(
        { label: "خط العرض", value: "24.7136°N", source: src },
        { label: "خط الطول", value: "46.6753°E", source: src },
      );
    }
    if (cats.has("property_photo")) {
      const src = files[categorized.findIndex(c => c.category === "property_photo")]?.name || "صورة أصل عقاري";
      numbers.push(
        { label: "حالة الأصل الظاهرة", value: "جيدة", source: src },
        { label: "ملاحظة", value: "يلزم تأكيد نوع الأصل من المستندات الداعمة", source: src },
      );
    }
    if (cats.has("machinery_photo")) {
      const src = files[categorized.findIndex(c => c.category === "machinery_photo")]?.name || "صورة آلة / معدة";
      numbers.push(
        { label: "نوع الأصل الظاهر", value: "آلة / معدة", source: src },
        { label: "الحالة الظاهرة", value: "تعمل ظاهرياً — تحتاج فحص فني", source: src },
      );
    }

    // إذا لم يتم اكتشاف أي نوع معروف
    if (numbers.length === 0) {
      numbers.push(
        { label: "عدد المستندات", value: `${files.length} ملف`, source: "النظام" },
        { label: "حالة التحليل", value: "لم يتم اكتشاف بيانات محددة", source: "النظام" },
      );
    }

    const hasPropertyEvidence = ["deed", "building_permit", "floor_plan", "property_photo", "location_map"].some(category => cats.has(category));
    const hasMachineryEvidence = ["machinery_photo", "invoice", "technical_report"].some(category => cats.has(category));

    return {
      discipline: hasMachineryEvidence && hasPropertyEvidence ? "mixed" : hasMachineryEvidence ? "machinery" : "real_estate",
      discipline_label: hasMachineryEvidence && hasPropertyEvidence ? "تقييم مختلط" : hasMachineryEvidence ? "تقييم آلات ومعدات" : "تقييم عقاري",
      confidence: Math.min(95, 70 + categorized.filter(c => c.relevance === "high").length * 8),
      client: cats.has("deed") || cats.has("identity_doc") ? {
        clientName: "أحمد بن عبدالله المالكي",
        idNumber: "1088456723",
        phone: "0551234567",
        email: "ahmed.maliki@email.com",
      } : {},
      asset: hasMachineryEvidence && !hasPropertyEvidence ? {
        description: "معدات وآلات مرفوعة ضمن الطلب",
        classification: "آلات ومعدات",
        machineName: "معدة تحتاج اعتماد الاسم من المستندات",
      } : cats.has("deed") || cats.has("floor_plan") || cats.has("building_permit") ? {
        description: "فيلا سكنية دورين مع ملحق",
        city: "الرياض",
        district: "حي النرجس",
        area: "450",
        deedNumber: cats.has("deed") ? "1234567" : undefined,
        classification: "سكني",
      } : {},
      suggestedPurpose: hasMachineryEvidence && !hasPropertyEvidence ? "تقييم أصول" : cats.has("deed") ? "تمويل عقاري — بنك الراجحي" : "تقييم أصول",
      notes: [
        ...(cats.has("deed") ? ["تم التعرف على صك إلكتروني — استُخرج رقم الصك واسم المالك والمساحة والموقع"] : []),
        ...(cats.has("building_permit") ? ["تم اكتشاف رخصة بناء — استُخرج رقم الرخصة وعدد الأدوار المرخصة"] : []),
        ...(cats.has("floor_plan") ? ["تم تحليل المخطط المعماري — استُخرجت مساحة البناء وعدد الغرف"] : []),
        ...(cats.has("technical_report") ? ["تم اكتشاف تقرير فني/تقييم سابق — استُخرجت بيانات فنية مساندة"] : []),
        ...(cats.has("machinery_photo") ? ["تم رصد صور آلات/معدات — تم ترجيح نوع التقييم كآلات ومعدات"] : []),
        ...(cats.has("contract") ? ["تم تحليل عقد إيجار — استُخرجت قيمة الإيجار ومدة العقد"] : []),
        ...(cats.has("deed") && cats.has("floor_plan") ? ["✅ المساحة في الصك متطابقة مع المخطط المعماري"] : []),
        ...(cats.has("building_permit") ? ["⚠️ يُنصح بالتحقق من صلاحية رخصة البناء"] : []),
        `📊 تم تصنيف ${files.length} مستند: ${categorized.filter(c => c.relevance === "high").length} مهم، ${categorized.filter(c => c.relevance === "medium").length} متوسط`,
        "⚠️ هذه بيانات تجريبية (Mock) للعرض التوضيحي",
      ],
      documentCategories: files.map((f, i) => ({
        fileName: f.name,
        category: categorized[i].category,
        categoryLabel: categorized[i].label,
        relevance: categorized[i].relevance,
        extractedInfo: categorized[i].extractedInfo,
      })),
      extractedNumbers: numbers,
      analysisMethod: "mock_simulation",
      analyzedFilesCount: files.length,
      totalFilesCount: files.length,
    };
  };

  const phases = [
    { label: "رفع الملفات للتخزين...", target: 20 },
    { label: "قراءة محتوى المستندات...", target: 40 },
    { label: "تحليل النصوص والصور...", target: 60 },
    { label: "استخراج البيانات الهيكلية...", target: 80 },
    { label: "تصنيف المستندات وتوليد التقرير...", target: 95 },
  ];

  const runExtraction = useCallback(async () => {
    if (uploadedFiles.length === 0) {
      toast.error("يجب رفع ملف واحد على الأقل");
      return;
    }

    setExtracting(true);
    setExtracted(null);
    setExtractionProgress(0);

    try {
      if (useMock) {
        // Mock simulation with animated progress
        for (const phase of phases) {
          setExtractionPhase(phase.label);
          const steps = 5;
          const startProg = phase.target - 20;
          for (let s = 0; s < steps; s++) {
            await delay(300 + Math.random() * 200);
            setExtractionProgress(Math.min(startProg + ((phase.target - startProg) * (s + 1)) / steps, phase.target));
          }
        }

        setExtractionProgress(100);
        setExtractionPhase("اكتمل التحليل!");
        await delay(400);

        const result = generateMockResult(uploadedFiles);
        setExtracted(result);

        if (result.documentCategories) {
          setUploadedFiles(prev => prev.map(f => {
            const cat = result.documentCategories.find(dc => dc.fileName === f.name);
            return cat ? {
              ...f, status: "uploaded" as FileStatus,
              category: cat.category,
              categoryLabel: cat.categoryLabel || DOC_CATEGORIES.find(c => c.value === cat.category)?.label || cat.category,
              relevance: cat.relevance,
              extractedInfo: cat.extractedInfo,
            } : { ...f, status: "uploaded" as FileStatus };
          }));
        }

        toast.success(`تم تحليل ${result.analyzedFilesCount} مستند بنجاح (وضع تجريبي)`);
      } else {
        // Real extraction
        setExtractionPhase(phases[0].label);
        setExtractionProgress(5);
        const tempId = `ai_${Date.now()}`;
        const storagePaths: { path: string; name: string; mimeType: string }[] = [];

        for (let idx = 0; idx < uploadedFiles.length; idx++) {
          const uf = uploadedFiles[idx];
          setUploadedFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: "uploading" as FileStatus } : f));
          const filePath = `${tempId}/${Date.now()}_${uf.name}`;
          const { error: uploadErr } = await supabase.storage.from("client-uploads").upload(filePath, uf.file);
          if (!uploadErr) {
            storagePaths.push({ path: filePath, name: uf.name, mimeType: uf.file.type });
            setUploadedFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: "uploaded" as FileStatus, storagePath: filePath } : f));
          } else {
            setUploadedFiles(prev => prev.map((f, i) => i === idx ? { ...f, status: "error" as FileStatus, errorMsg: uploadErr.message } : f));
          }
          setExtractionProgress(5 + ((idx + 1) / uploadedFiles.length) * 20);
        }

        setExtractionPhase(phases[2].label);
        setExtractionProgress(40);

        const { data, error } = await supabase.functions.invoke("extract-documents", {
          body: {
            fileNames: uploadedFiles.map(f => f.name),
            fileDescriptions: [],
            storagePaths,
          },
        });

        setExtractionProgress(90);

        if (error) throw error;

        const result = data as ExtractedData;
        setExtractionProgress(100);
        setExtracted(result);

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

        toast.success(`تم تحليل ${result.analyzedFilesCount || uploadedFiles.length} مستند بنجاح`);
      }
    } catch (err: any) {
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
      setExtractionProgress(0);
    }
  }, [uploadedFiles, useMock]);

  // Auto-trigger mock analysis when files are added in mock mode
  useEffect(() => {
    if (autoAnalyzePending && uploadedFiles.length > 0 && !extracting) {
      setAutoAnalyzePending(false);
      runExtraction();
    }
  }, [autoAnalyzePending, uploadedFiles, extracting, runExtraction]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const classifiedCount = uploadedFiles.filter(f => f.category).length;
  const highRelevanceCount = uploadedFiles.filter(f => f.relevance === "high").length;

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && <TopBar />}
      <div className={embedded ? "space-y-6" : "p-6 max-w-5xl mx-auto space-y-6"}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">نظام استخراج وتصنيف المستندات الذكي</h1>
            </div>
            <p className="text-sm text-muted-foreground">ارفع المستندات وسيقوم الذكاء الاصطناعي بتحليل المحتوى واستخراج البيانات وتصنيف كل وثيقة تلقائياً</p>
          </div>
          {extracted && (
            <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="font-medium">{extracted.discipline_label}</span>
              <span className="text-primary/60">— ثقة {extracted.confidence}%</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload area */}
          <div className="lg:col-span-1 space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFilesSelected(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
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
              <FolderUp className={`w-10 h-10 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium text-foreground mb-0.5">اسحب الملفات هنا</p>
              <p className="text-[11px] text-muted-foreground">PDF, صور, Word, Excel</p>
            </div>

            {/* File list */}
            {uploadedFiles.length > 0 && (
              <div className="bg-card rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{uploadedFiles.length} ملف</span>
                  <button onClick={() => fileInputRef.current?.click()} className="text-[11px] text-primary hover:underline">+ إضافة</button>
                </div>
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                  {uploadedFiles.map((f, i) => {
                    const Icon = getFileIcon(f.name);
                    const statusConfig = {
                      pending: { icon: Upload, color: "text-muted-foreground", bg: "bg-muted/20", label: "جاهز للرفع" },
                      uploading: { icon: Loader2, color: "text-primary", bg: "bg-primary/5", label: "جارٍ الرفع..." },
                      uploaded: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20", label: "تم الرفع" },
                      error: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/5", label: f.errorMsg || "فشل الرفع" },
                    }[f.status];
                    const StatusIcon = statusConfig.icon;
                    return (
                      <div key={i} className={`flex items-center justify-between p-2.5 rounded-lg border border-border/50 group transition-colors ${statusConfig.bg}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <StatusIcon className={`w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 ${statusConfig.color} ${f.status === "uploading" ? "animate-spin" : ""}`} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs text-foreground truncate">{f.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] text-muted-foreground">{formatFileSize(f.size)}</span>
                              <span className={`text-[9px] ${statusConfig.color}`}>{statusConfig.label}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {f.category && (
                            <Badge variant="secondary" className="text-[8px] px-1 py-0">{f.categoryLabel}</Badge>
                          )}
                          <button onClick={() => removeFile(i)} className="p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Mock toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={useMock} onChange={(e) => setUseMock(e.target.checked)}
                    className="rounded border-border accent-primary w-3.5 h-3.5" />
                  <span className="text-[11px] text-muted-foreground">وضع تجريبي (Mock)</span>
                </label>

                {/* Analyze button */}
                <button
                  onClick={runExtraction}
                  disabled={extracting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {extracting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{extractionPhase}</span></>
                  ) : (
                    <><Brain className="w-4 h-4" />{useMock ? "تحليل تجريبي" : "تحليل بالذكاء الاصطناعي"}</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-2 space-y-4">
            {!extracted && !extracting && (
              <div className="bg-card rounded-lg border border-border p-12 text-center">
                <FileSearch className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-1">لم يتم التحليل بعد</h3>
                <p className="text-sm text-muted-foreground/60">ارفع المستندات واضغط "تحليل بالذكاء الاصطناعي" لبدء الاستخراج</p>
              </div>
            )}

            {extracting && (
              <div className="bg-card rounded-lg border border-border p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">جارٍ التحليل...</h3>
                    <p className="text-xs text-muted-foreground">{extractionPhase}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">التقدم</span>
                    <span className="font-medium text-foreground">{Math.round(extractionProgress)}%</span>
                  </div>
                  <Progress value={extractionProgress} className="h-2" />
                  <div className="flex justify-between text-[10px] text-muted-foreground/60">
                    {phases.map((p, i) => (
                      <span key={i} className={extractionProgress >= p.target ? "text-primary font-medium" : ""}>
                        {i + 1}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {extracted && !extracting && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="bg-card rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{extracted.discipline_label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {extracted.analysisMethod === "content_analysis" ? "تحليل محتوى فعلي" : "تحليل أسماء الملفات"}
                          {" — "}{extracted.analyzedFilesCount}/{extracted.totalFilesCount} ملف
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={extracted.confidence >= 80 ? "default" : "secondary"} className="text-xs">
                        ثقة {extracted.confidence}%
                      </Badge>
                      <Badge variant="outline" className="text-xs">{classifiedCount} مُصنَّف</Badge>
                      {highRelevanceCount > 0 && (
                        <Badge variant="outline" className="text-xs border-success/30 text-success">{highRelevanceCount} مهم</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Low confidence warning */}
                {extracted.confidence < 80 && (
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-300 dark:border-yellow-700 p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-2">
                        <div>
                          <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">نسبة الثقة منخفضة ({extracted.confidence}%)</p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-0.5">
                            لم يتمكن النظام من التأكد بشكل كافٍ من البيانات المستخرجة. يرجى مراجعة المعلومات أدناه والتأكد من صحتها.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              toast.info("تم فتح جميع الأقسام للمراجعة — عدّل البيانات غير الصحيحة");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 hover:bg-yellow-300 dark:hover:bg-yellow-700 transition-colors"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            مراجعة وتعديل البيانات
                          </button>
                          <button
                            onClick={() => {
                              toast.success("تم تأكيد صحة البيانات");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/60 transition-colors"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            نعم، البيانات صحيحة
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {extracted.notes.length > 0 && (
                  <div className="bg-accent/50 rounded-lg border border-accent p-4">
                    <div className="flex items-center gap-2 mb-2 text-accent-foreground font-medium text-sm">
                      <Brain className="w-4 h-4" />ملاحظات الذكاء الاصطناعي
                    </div>
                    <ul className="space-y-1">
                      {extracted.notes.map((n, i) => <li key={i} className="text-xs text-accent-foreground/80">• {n}</li>)}
                    </ul>
                  </div>
                )}

                {/* Document Classification */}
                <div className="bg-card rounded-lg border border-border">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">تصنيف المستندات</h3>
                  </div>
                  <div className="divide-y divide-border">
                    {uploadedFiles.map((f, i) => {
                      const Icon = getFileIcon(f.name);
                      const catInfo = DOC_CATEGORIES.find(c => c.value === f.category);
                      const CatIcon = catInfo?.icon || File;
                      return (
                        <div key={i} className="p-3 hover:bg-muted/20 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                                {f.extractedInfo && (
                                  <p className="text-[11px] text-muted-foreground mt-0.5 bg-muted/40 rounded px-2 py-0.5 inline-block">
                                    💡 {f.extractedInfo}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge variant="outline" className={`text-[9px] px-1.5 ${
                                f.relevance === "high" ? "border-success/50 text-success" :
                                f.relevance === "medium" ? "border-warning/50 text-warning" :
                                "text-muted-foreground"
                              }`}>
                                {f.relevance === "high" ? "مهم" : f.relevance === "medium" ? "متوسط" : "منخفض"}
                              </Badge>
                              <Select value={f.category || ""} onValueChange={(val) => updateFileCategory(i, val)}>
                                <SelectTrigger className="h-7 text-[11px] w-28 border-border">
                                  <SelectValue placeholder="تصنيف">
                                    {catInfo ? (
                                      <span className="flex items-center gap-1"><CatIcon className="w-3 h-3" />{catInfo.label}</span>
                                    ) : "تصنيف..."}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {DOC_CATEGORIES.map(cat => (
                                    <SelectItem key={cat.value} value={cat.value} className="text-xs">
                                      <span className="flex items-center gap-2"><cat.icon className="w-3.5 h-3.5" />{cat.label}</span>
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

                {/* البيانات المستخرجة الموحدة */}
                {extracted && (() => {
                  const nums = extracted.extractedNumbers || [];
                  const getNum = (label: string) => nums.find(n => n.label === label);
                  
                  // Get confidence level for a source document
                  const getConfLevel = (source: string): "high" | "medium" | "low" | null => {
                    const conf = nums.find(n => n.label.includes("ثقة") && n.source === source);
                    if (!conf) return null;
                    const val = parseInt(conf.value);
                    if (val >= 85) return "high";
                    if (val >= 70) return "medium";
                    return "low";
                  };

                  const confStyles = {
                    high: {
                      bg: "bg-emerald-50 dark:bg-emerald-950/20",
                      border: "border-emerald-200 dark:border-emerald-800",
                      icon: "text-emerald-600 dark:text-emerald-400",
                      text: "text-emerald-700 dark:text-emerald-300",
                      badge: "border-emerald-300 text-emerald-600 dark:text-emerald-400",
                      label: "مؤكد",
                    },
                    medium: {
                      bg: "bg-yellow-50 dark:bg-yellow-950/20",
                      border: "border-yellow-200 dark:border-yellow-700",
                      icon: "text-yellow-600 dark:text-yellow-400",
                      text: "text-yellow-700 dark:text-yellow-300",
                      badge: "border-yellow-400 text-yellow-600 dark:text-yellow-400",
                      label: "يحتاج تأكيد",
                    },
                    low: {
                      bg: "bg-red-50 dark:bg-red-950/20",
                      border: "border-red-200 dark:border-red-800",
                      icon: "text-red-600 dark:text-red-400",
                      text: "text-red-700 dark:text-red-300",
                      badge: "border-red-300 text-red-600 dark:text-red-400",
                      label: "غير موثوق",
                    },
                  };

                  const fieldCard = (label: string, value: string | undefined, icon: React.ElementType, conf?: "high" | "medium" | "low" | null) => {
                    if (!value) return null;
                    const Icon = icon;
                    const style = conf && conf !== "high" ? confStyles[conf] : null;
                    return (
                      <div dir="rtl" className={`flex items-center gap-3 p-2.5 rounded-lg border group transition-colors ${
                        style ? `${style.bg} ${style.border}` : "bg-muted/30 border-border/50"
                      }`}>
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                          style ? style.bg : "bg-primary/10"
                        }`}>
                          <Icon className={`w-3.5 h-3.5 ${style ? style.icon : "text-primary"}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-muted-foreground leading-relaxed">{label}</p>
                          <p className={`text-xs font-semibold leading-relaxed ${style ? style.text : "text-foreground"}`}>{value}</p>
                        </div>
                        {style && (
                          <Badge variant="outline" className={`text-[8px] h-4 px-1.5 shrink-0 ${style.badge}`}>
                            {conf === "low" ? <AlertTriangle className="w-2 h-2 ml-1" /> : <AlertTriangle className="w-2 h-2 ml-1" />}
                            {style.label}
                          </Badge>
                        )}
                        {conf === "high" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <button onClick={() => copyToClipboard(value)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground shrink-0">
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  };

                  const deedConf = getConfLevel(nums.find(n => n.source?.includes("صك"))?.source || "");
                  const permitConf = getConfLevel(nums.find(n => n.source?.includes("رخصة"))?.source || "");
                  const planConf = getConfLevel(nums.find(n => n.source?.includes("مخطط"))?.source || "");
                  const contractConf = getConfLevel(nums.find(n => n.source?.includes("إيجار") || n.source?.includes("عقد"))?.source || "");

                  const hasPropertyInfo = extracted.asset?.description || extracted.asset?.city || extracted.asset?.area;
                  const hasOwnership = extracted.client?.clientName || extracted.asset?.deedNumber;
                  const hasBuildingInfo = getNum("مساحة البناء المرخصة") || getNum("عدد الطوابق") || getNum("غرف النوم");
                  const hasRentalInfo = getNum("قيمة الإيجار السنوي");

                  // Confidence summary
                  const allConfs = [deedConf, permitConf, planConf, contractConf].filter(Boolean) as ("high" | "medium" | "low")[];
                  const highCount = allConfs.filter(c => c === "high").length;
                  const medCount = allConfs.filter(c => c === "medium").length;
                  const lowCount = allConfs.filter(c => c === "low").length;

                  return (
                    <div className="space-y-3" dir="rtl">
                      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-gradient-to-l from-primary/5 to-transparent">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-foreground">البيانات المستخرجة الموحدة</h3>
                                <p className="text-[11px] text-muted-foreground">تم تجميع البيانات من {extracted.totalFilesCount} مستند</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {nums.length + Object.values(extracted.client || {}).filter(Boolean).length + Object.values(extracted.asset || {}).filter(Boolean).length} حقل
                            </Badge>
                          </div>

                          {/* Confidence Summary Bar */}
                          {allConfs.length > 0 && (
                            <div className="flex items-center gap-3 mt-3 p-2 rounded-lg bg-muted/30 border border-border/50">
                              <span className="text-[10px] text-muted-foreground shrink-0">مستوى الثقة:</span>
                              <div className="flex items-center gap-2 flex-wrap">
                                {highCount > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    {highCount} عالي
                                  </span>
                                )}
                                {medCount > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] text-yellow-600 dark:text-yellow-400 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                    {medCount} متوسط
                                  </span>
                                )}
                                {lowCount > 0 && (
                                  <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-red-500" />
                                    {lowCount} منخفض
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="divide-y divide-border">
                          {/* 1. معلومات العقار */}
                          {hasPropertyInfo && (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                  <Building2 className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">معلومات العقار</h4>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">النوع والموقع والمساحة</Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fieldCard("نوع العقار", extracted.asset?.description, Home, deedConf)}
                                {fieldCard("التصنيف", extracted.asset?.classification, Tag, deedConf)}
                                {fieldCard("المدينة", extracted.asset?.city, MapPin, deedConf)}
                                {fieldCard("الحي", extracted.asset?.district, MapPin, deedConf)}
                                {fieldCard("مساحة الأرض", extracted.asset?.area ? `${extracted.asset.area} م²` : undefined, Ruler, deedConf)}
                              </div>
                            </div>
                          )}

                          {/* 2. معلومات الملكية */}
                          {hasOwnership && (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                  <FileCheck className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">معلومات الملكية</h4>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">من الصك والهوية</Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fieldCard("اسم المالك", extracted.client?.clientName, User, deedConf)}
                                {fieldCard("رقم الهوية", extracted.client?.idNumber, Hash, deedConf)}
                                {fieldCard("رقم الصك", extracted.asset?.deedNumber, FileCheck, deedConf)}
                                {fieldCard("الجوال", extracted.client?.phone, Phone)}
                                {fieldCard("البريد الإلكتروني", extracted.client?.email, Mail)}
                              </div>
                            </div>
                          )}

                          {/* 3. معلومات البناء */}
                          {hasBuildingInfo && (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                  <Home className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">معلومات البناء</h4>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">من الرخصة والمخطط</Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fieldCard("مساحة البناء", getNum("مساحة البناء المرخصة")?.value, Ruler, permitConf)}
                                {fieldCard("عدد الطوابق", getNum("عدد الطوابق")?.value, Building2, permitConf)}
                                {fieldCard("غرف النوم", getNum("غرف النوم")?.value, Home, planConf)}
                                {fieldCard("الصالات", getNum("الصالات")?.value, Home, planConf)}
                                {fieldCard("المطبخ", getNum("المطبخ")?.value, Home, planConf)}
                              </div>
                            </div>
                          )}

                          {/* 4. معلومات الإيجار */}
                          {hasRentalInfo && (
                            <div className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <h4 className="text-xs font-bold text-foreground">معلومات الإيجار</h4>
                                <Badge variant="secondary" className="text-[9px] px-1.5 py-0">من عقد الإيجار</Badge>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {fieldCard("الإيجار السنوي", getNum("قيمة الإيجار السنوي")?.value, Hash, contractConf)}
                                {fieldCard("المستأجر", getNum("اسم المستأجر")?.value, User, contractConf)}
                                {fieldCard("مدة العقد", getNum("مدة العقد")?.value, FileText, contractConf)}
                              </div>
                            </div>
                          )}

                          {/* غرض التقييم */}
                          {extracted.suggestedPurpose && (
                            <div className="p-4">
                              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/15">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <CheckCircle2 className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-muted-foreground">غرض التقييم المقترح</p>
                                  <p className="text-sm font-bold text-foreground">{extracted.suggestedPurpose}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* زر المتابعة */}
                      <Button
                        className="w-full gap-2 text-sm py-5 rounded-xl shadow-sm"
                        size="lg"
                        onClick={() => navigate("/scope-and-pricing", { state: { extractedData: extracted } })}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        متابعة لتحديد نطاق العمل
                      </Button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
