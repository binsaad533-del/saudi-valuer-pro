import { useState, useCallback, useRef, useEffect } from "react";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, FileText, FolderUp, Loader2, X, Sparkles, Tag,
  FileSearch, File, FileCheck, ShieldCheck, Ruler, User, MapPin,
  Building2, Phone, Mail, Image as ImageIcon, FileSpreadsheet,
  CheckCircle2, AlertTriangle, Upload, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AssetInventoryTable, { InventoryAsset } from "@/components/client/AssetInventoryTable";

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
  description: string;
  inventory: InventoryAsset[];
  summary?: {
    total: number;
    by_type?: Record<string, number>;
    by_condition?: Record<string, number>;
  };
  suggestedPurpose?: string;
  notes: string[];
  documentCategories: { fileName: string; category: string; categoryLabel?: string; relevance: string; extractedInfo?: string }[];
  analysisMethod?: string;
  analyzedFilesCount?: number;
  totalFilesCount?: number;
}

export default function AIDocumentProcessingPage({ embedded }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState("");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [useMock, setUseMock] = useState(false);

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

  const updateFileCategory = useCallback((index: number, category: string) => {
    const catInfo = DOC_CATEGORIES.find(c => c.value === category);
    setUploadedFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, category, categoryLabel: catInfo?.label || category } : f
    ));
  }, []);

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── Mock: generates inventory array matching edge function output ──
  const generateMockResult = (files: UploadedFile[]): ExtractedData => {
    const guessCategory = (name: string): { category: string; label: string; extractedInfo?: string; relevance: string } => {
      const n = name.toLowerCase();
      if (n.includes("صك") || n.includes("deed")) return { category: "deed", label: "صك ملكية", relevance: "high", extractedInfo: "رقم الصك: 1234567 — المالك: أحمد المالكي — المساحة: 450 م²" };
      if (n.includes("رخص") || n.includes("permit")) return { category: "building_permit", label: "رخصة بناء", relevance: "high", extractedInfo: "رخصة رقم: RB-2024-789 — مساحة البناء: 320 م²" };
      if (n.includes("مخطط") || n.includes("plan")) return { category: "floor_plan", label: "مخطط معماري", relevance: "medium", extractedInfo: "3 غرف نوم + صالة + مطبخ" };
      if (n.includes("آلة") || n.includes("معد") || n.includes("حفار") || n.includes("مولد") || n.includes("generator") || n.includes("excavator"))
        return { category: "machinery_photo", label: "صورة آلة / معدة", relevance: "high", extractedInfo: "صورة معدة — يلزم التحقق من البيانات" };
      if (n.includes("عقد") || n.includes("إيجار")) return { category: "contract", label: "عقد إيجار", relevance: "medium", extractedInfo: "إيجار سنوي: 85,000 ر.س" };
      if (/\.(jpg|jpeg|png|webp|tif|tiff|gif)$/i.test(n)) return { category: "property_photo", label: "صورة عقار", relevance: "medium" };
      if (/\.(xls|xlsx)$/i.test(n)) return { category: "spreadsheet", label: "جدول بيانات", relevance: "high", extractedInfo: "ملف Excel — قد يحتوي على جرد أصول" };
      if (n.endsWith(".pdf")) return { category: "technical_report", label: "مستند PDF", relevance: "medium" };
      return { category: "other", label: "أخرى", relevance: "low" };
    };

    const categorized = files.map(f => guessCategory(f.name));
    const cats = new Set(categorized.map(c => c.category));
    const hasMach = cats.has("machinery_photo") || cats.has("spreadsheet");
    const hasProp = cats.has("deed") || cats.has("building_permit") || cats.has("floor_plan") || cats.has("property_photo");

    const discipline = hasMach && hasProp ? "mixed" : hasMach ? "machinery_equipment" : "real_estate";

    // Build mock inventory
    const inventory: InventoryAsset[] = [];
    let nextId = 1;

    if (hasProp) {
      inventory.push({
        id: nextId++,
        name: "فيلا سكنية دورين مع ملحق",
        type: "real_estate",
        category: "فيلا",
        subcategory: "سكني",
        quantity: 1,
        condition: "good",
        fields: [
          { key: "deed_number", label: "رقم الصك", value: "1234567", confidence: 96 },
          { key: "area_sqm", label: "المساحة م²", value: "450", confidence: 96 },
          { key: "city", label: "المدينة", value: "الرياض", confidence: 95 },
          { key: "district", label: "الحي", value: "النرجس", confidence: 95 },
          { key: "classification", label: "التصنيف", value: "سكني", confidence: 90 },
          { key: "floors_count", label: "عدد الطوابق", value: "2", confidence: 91 },
          { key: "building_area_sqm", label: "مساحة البناء م²", value: "320", confidence: 91 },
          { key: "rooms_count", label: "عدد الغرف", value: "6", confidence: 73 },
          { key: "building_age", label: "عمر المبنى", value: "5 سنوات", confidence: 70 },
        ],
        source: "صك_ملكية + رخصة_بناء",
      });
    }

    if (hasMach) {
      inventory.push(
        {
          id: nextId++,
          name: "حفار هيدروليكي كاتربيلر 320",
          type: "machinery_equipment",
          category: "حفار",
          subcategory: "معدات ثقيلة",
          quantity: 1,
          condition: "good",
          fields: [
            { key: "manufacturer", label: "الشركة المصنعة", value: "Caterpillar", confidence: 95 },
            { key: "model", label: "الموديل", value: "320 GC", confidence: 92 },
            { key: "year_manufactured", label: "سنة الصنع", value: "2021", confidence: 90 },
            { key: "serial_number", label: "الرقم التسلسلي", value: "CAT0320GC21A4567", confidence: 88 },
            { key: "operating_hours", label: "ساعات التشغيل", value: "4,200", confidence: 85 },
            { key: "operational_status", label: "الحالة التشغيلية", value: "تعمل", confidence: 90 },
            { key: "country_of_origin", label: "بلد المنشأ", value: "الولايات المتحدة", confidence: 95 },
          ],
          source: "صورة_معدة + فاتورة",
        },
        {
          id: nextId++,
          name: "مولد كهربائي كمنز 500 كيلوواط",
          type: "machinery_equipment",
          category: "مولد كهربائي",
          subcategory: "معدات طاقة",
          quantity: 2,
          condition: "fair",
          fields: [
            { key: "manufacturer", label: "الشركة المصنعة", value: "Cummins", confidence: 90 },
            { key: "model", label: "الموديل", value: "C500D5", confidence: 85 },
            { key: "year_manufactured", label: "سنة الصنع", value: "2019", confidence: 80 },
            { key: "capacity", label: "القدرة", value: "500 كيلوواط", confidence: 92 },
            { key: "fuel_type", label: "نوع الوقود", value: "ديزل", confidence: 95 },
            { key: "operating_hours", label: "ساعات التشغيل", value: "8,500", confidence: 75 },
            { key: "operational_status", label: "الحالة التشغيلية", value: "تحتاج صيانة", confidence: 70 },
          ],
          source: "جدول_بيانات صف 3",
        },
      );
    }

    const reCount = inventory.filter(a => a.type === "real_estate").length;
    const meCount = inventory.filter(a => a.type === "machinery_equipment").length;

    return {
      discipline,
      discipline_label: discipline === "mixed" ? "تقييم مختلط" : discipline === "machinery_equipment" ? "تقييم آلات ومعدات" : "تقييم عقاري",
      confidence: 88,
      client: hasProp ? { clientName: "أحمد بن عبدالله المالكي", idNumber: "1088456723", phone: "0551234567", email: "ahmed@email.com" } : {},
      description: discipline === "real_estate"
        ? "فيلا سكنية من دورين مع ملحق علوي تقع في حي النرجس شمال الرياض. مساحة الأرض 450 م² ومساحة البناء 320 م². المبنى بحالة جيدة وعمره 5 سنوات تقريباً. يتكون من 6 غرف نوم وصالتين ومطبخ و4 دورات مياه. التشطيبات ممتازة مع نظام تكييف مركزي."
        : discipline === "machinery_equipment"
        ? "مجموعة من المعدات الثقيلة ومعدات الطاقة تشمل حفار هيدروليكي كاتربيلر موديل 320 GC بحالة تشغيلية جيدة (4,200 ساعة تشغيل)، ومولدين كهربائيين كمنز بقدرة 500 كيلوواط لكل منهما بحالة مقبولة تحتاج صيانة (8,500 ساعة تشغيل)."
        : "محفظة أصول مختلطة تشمل فيلا سكنية في حي النرجس بالرياض (450 م²) بالإضافة إلى معدات ثقيلة ومعدات طاقة تشمل حفار كاتربيلر 320 ومولدات كمنز 500 كيلوواط.",
      inventory,
      summary: {
        total: inventory.length,
        by_type: { real_estate: reCount, machinery_equipment: meCount },
        by_condition: inventory.reduce((acc, a) => { acc[a.condition || "unknown"] = (acc[a.condition || "unknown"] || 0) + 1; return acc; }, {} as Record<string, number>),
      },
      suggestedPurpose: hasProp ? "تمويل عقاري" : "تقييم أصول",
      notes: [
        `📊 تم تحليل ${files.length} مستند واستخراج ${inventory.length} أصل`,
        ...(hasProp ? ["✅ تم استخراج بيانات الصك والرخصة بنجاح"] : []),
        ...(hasMach ? ["⚙️ تم جرد المعدات مع البيانات الفنية التفصيلية"] : []),
        "⚠️ هذه بيانات تجريبية (Mock) — أوقف الوضع التجريبي للتحليل الحقيقي",
      ],
      documentCategories: files.map((f, i) => ({
        fileName: f.name,
        category: categorized[i].category,
        categoryLabel: categorized[i].label,
        relevance: categorized[i].relevance,
        extractedInfo: categorized[i].extractedInfo,
      })),
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
        for (const phase of phases) {
          setExtractionPhase(phase.label);
          const steps = 5;
          const startProg = phase.target - 20;
          for (let s = 0; s < steps; s++) {
            await delay(200 + Math.random() * 150);
            setExtractionProgress(Math.min(startProg + ((phase.target - startProg) * (s + 1)) / steps, phase.target));
          }
        }
        setExtractionProgress(100);
        setExtractionPhase("اكتمل التحليل!");
        await delay(300);

        const result = generateMockResult(uploadedFiles);
        setExtracted(result);

        if (result.documentCategories) {
          setUploadedFiles(prev => prev.map(f => {
            const cat = result.documentCategories.find(dc => dc.fileName === f.name);
            return cat ? { ...f, status: "uploaded" as FileStatus, category: cat.category, categoryLabel: cat.categoryLabel, relevance: cat.relevance, extractedInfo: cat.extractedInfo } : { ...f, status: "uploaded" as FileStatus };
          }));
        }
        toast.success(`تم تحليل ${result.analyzedFilesCount} مستند واستخراج ${result.inventory.length} أصل (وضع تجريبي)`);
      } else {
        // Real extraction — upload then call edge function
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

        // Normalize the response — ensure inventory exists
        const result: ExtractedData = {
          discipline: data.discipline || "real_estate",
          discipline_label: data.discipline_label || "تقييم عقاري",
          confidence: data.confidence || 50,
          client: data.client || {},
          description: data.description || "",
          inventory: Array.isArray(data.inventory) ? data.inventory : [],
          summary: data.summary || { total: 0 },
          suggestedPurpose: data.suggestedPurpose,
          notes: Array.isArray(data.notes) ? data.notes : [],
          documentCategories: Array.isArray(data.documentCategories) ? data.documentCategories : [],
          analysisMethod: data.analysisMethod,
          analyzedFilesCount: data.analyzedFilesCount,
          totalFilesCount: data.totalFilesCount,
        };

        setExtractionProgress(100);
        setExtracted(result);

        if (result.documentCategories) {
          setUploadedFiles(prev => prev.map(f => {
            const cat = result.documentCategories.find(dc => dc.fileName === f.name);
            return cat ? { ...f, category: cat.category, categoryLabel: cat.categoryLabel, relevance: cat.relevance, extractedInfo: cat.extractedInfo } : f;
          }));
        }

        toast.success(`تم تحليل ${result.analyzedFilesCount || uploadedFiles.length} مستند واستخراج ${result.inventory.length} أصل`);
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

  // ── Inventory state handlers ──
  const handleInventoryChange = useCallback((inv: InventoryAsset[]) => {
    if (!extracted) return;
    setExtracted(prev => prev ? { ...prev, inventory: inv, summary: { ...prev.summary!, total: inv.length, by_type: { real_estate: inv.filter(a => a.type === "real_estate").length, machinery_equipment: inv.filter(a => a.type === "machinery_equipment").length } } } : prev);
  }, [extracted]);

  const handleDescriptionChange = useCallback((desc: string) => {
    setExtracted(prev => prev ? { ...prev, description: desc } : prev);
  }, []);

  const handleDisciplineChange = useCallback((d: string) => {
    const labels: Record<string, string> = { real_estate: "تقييم عقاري", machinery_equipment: "تقييم آلات ومعدات", mixed: "تقييم مختلط" };
    setExtracted(prev => prev ? { ...prev, discipline: d, discipline_label: labels[d] || d } : prev);
  }, []);

  return (
    <div className={embedded ? "" : "min-h-screen"}>
      {!embedded && <TopBar />}
      <div className={embedded ? "space-y-6" : "p-6 max-w-6xl mx-auto space-y-6"}>
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Brain className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">نظام استخراج وجرد الأصول الذكي</h1>
            </div>
            <p className="text-sm text-muted-foreground">ارفع المستندات وسيقوم الذكاء الاصطناعي باستخراج جرد كامل للأصول مع الوصف والتصنيف</p>
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
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.tif,.tiff,.webp,.zip,.rar"
                onChange={(e) => handleFilesSelected(e.target.files)}
              />
              <FolderUp className={`w-10 h-10 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium text-foreground mb-0.5">اسحب الملفات هنا</p>
              <p className="text-[11px] text-muted-foreground">PDF, صور, Word, Excel, CSV, ZIP</p>
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
                <p className="text-sm text-muted-foreground/60">ارفع المستندات واضغط "تحليل بالذكاء الاصطناعي" لبدء الاستخراج والجرد</p>
              </div>
            )}

            {extracting && (
              <div className="bg-card rounded-lg border border-border p-8 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">جارٍ التحليل والجرد...</h3>
                    <p className="text-xs text-muted-foreground">{extractionPhase}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">التقدم</span>
                    <span className="font-medium text-foreground">{Math.round(extractionProgress)}%</span>
                  </div>
                  <Progress value={extractionProgress} className="h-2" />
                </div>
              </div>
            )}

            {extracted && !extracting && (
              <div className="space-y-4">
                {/* AI Notes */}
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

                {/* Client Info (if found) */}
                {(extracted.client?.clientName || extracted.client?.idNumber) && (
                  <div className="bg-card rounded-lg border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">بيانات العميل المستخرجة</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {extracted.client.clientName && (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-[10px] text-muted-foreground">الاسم</p>
                          <p className="text-xs font-semibold text-foreground">{extracted.client.clientName}</p>
                        </div>
                      )}
                      {extracted.client.idNumber && (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-[10px] text-muted-foreground">رقم الهوية</p>
                          <p className="text-xs font-semibold text-foreground">{extracted.client.idNumber}</p>
                        </div>
                      )}
                      {extracted.client.phone && (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-[10px] text-muted-foreground">الجوال</p>
                          <p className="text-xs font-semibold text-foreground">{extracted.client.phone}</p>
                        </div>
                      )}
                      {extracted.client.email && (
                        <div className="p-2 rounded-lg bg-muted/30 border border-border/50">
                          <p className="text-[10px] text-muted-foreground">البريد</p>
                          <p className="text-xs font-semibold text-foreground">{extracted.client.email}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Document Classification */}
                <div className="bg-card rounded-lg border border-border">
                  <div className="p-4 border-b border-border flex items-center gap-2">
                    <Tag className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">تصنيف المستندات</h3>
                    <Badge variant="secondary" className="text-[9px]">{uploadedFiles.length} ملف</Badge>
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
                                f.relevance === "high" ? "border-green-300 text-green-600 dark:text-green-400" :
                                f.relevance === "medium" ? "border-yellow-300 text-yellow-600 dark:text-yellow-400" :
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

                {/* ★ Asset Inventory Table — the core component ★ */}
                <AssetInventoryTable
                  discipline={extracted.discipline}
                  inventory={extracted.inventory}
                  description={extracted.description}
                  summary={extracted.summary}
                  onInventoryChange={handleInventoryChange}
                  onDescriptionChange={handleDescriptionChange}
                  onDisciplineChange={handleDisciplineChange}
                  onReanalyze={runExtraction}
                />

                {/* Purpose */}
                {extracted.suggestedPurpose && (
                  <div className="bg-card rounded-lg border border-border p-4">
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

                {/* Continue button */}
                <Button
                  className="w-full gap-2 text-sm py-5 rounded-xl shadow-sm"
                  size="lg"
                  onClick={() => navigate("/scope-and-pricing", { state: { extractedData: extracted } })}
                >
                  <ArrowLeft className="w-4 h-4" />
                  متابعة لتحديد نطاق العمل ({extracted.inventory.length} أصل)
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
