import { useState, useCallback, useRef } from "react";
import TopBar from "@/components/layout/TopBar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, FileText, FolderUp, Loader2, X, Sparkles, Tag, Hash,
  FileSearch, File, FileCheck, ShieldCheck, Ruler, User, MapPin,
  Building2, Phone, Mail, Image as ImageIcon, FileSpreadsheet,
  CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Copy, Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DOC_CATEGORIES = [
  { value: "deed", label: "صك ملكية", icon: FileCheck },
  { value: "building_permit", label: "رخصة بناء", icon: ShieldCheck },
  { value: "floor_plan", label: "مخطط معماري", icon: Ruler },
  { value: "property_photo", label: "صورة عقار", icon: ImageIcon },
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

export default function AIDocumentProcessingPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionPhase, setExtractionPhase] = useState("");
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [showClientData, setShowClientData] = useState(true);
  const [showAssetData, setShowAssetData] = useState(true);
  const [showExtractedNums, setShowExtractedNums] = useState(true);
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

  const generateMockResult = (files: UploadedFile[]): ExtractedData => {
    const guessCategory = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes("صك") || n.includes("deed")) return { category: "deed", label: "صك ملكية" };
      if (n.includes("رخص") || n.includes("permit")) return { category: "building_permit", label: "رخصة بناء" };
      if (n.includes("مخطط") || n.includes("plan")) return { category: "floor_plan", label: "مخطط معماري" };
      if (n.includes("هوي") || n.includes("id")) return { category: "identity_doc", label: "وثيقة هوية" };
      if (n.includes("فاتور") || n.includes("invoice")) return { category: "invoice", label: "فاتورة / سند" };
      if (n.includes("عقد") || n.includes("contract")) return { category: "contract", label: "عقد / اتفاقية" };
      if (/\.(jpg|jpeg|png|webp)$/i.test(n)) return { category: "property_photo", label: "صورة عقار" };
      if (n.includes("map") || n.includes("خريط")) return { category: "location_map", label: "خريطة موقع" };
      return { category: "other", label: "أخرى" };
    };

    return {
      discipline: "real_estate",
      discipline_label: "تقييم عقاري",
      confidence: 87,
      client: {
        clientName: "أحمد بن عبدالله المالكي",
        idNumber: "1088456723",
        phone: "0551234567",
        email: "ahmed.maliki@email.com",
      },
      asset: {
        description: "فيلا سكنية دورين مع ملحق",
        city: "الرياض",
        district: "حي النرجس",
        area: "625",
        deedNumber: "310298765",
        classification: "سكني",
      },
      suggestedPurpose: "تمويل عقاري — بنك الراجحي",
      notes: [
        "تم التعرف على صك إلكتروني يحتوي على بيانات الملكية",
        "المساحة المذكورة في الصك تتطابق مع المخطط المعماري",
        "يُنصح بالتحقق من تاريخ رخصة البناء",
        "⚠️ هذه بيانات تجريبية (Mock) للعرض التوضيحي",
      ],
      documentCategories: files.map(f => {
        const cat = guessCategory(f.name);
        return {
          fileName: f.name,
          category: cat.category,
          categoryLabel: cat.label,
          relevance: cat.category === "other" ? "low" : cat.category === "deed" ? "high" : "medium",
          extractedInfo: cat.category === "deed" ? "رقم الصك: 310298765 — المساحة: 625 م²" :
            cat.category === "identity_doc" ? "رقم الهوية: 1088456723" :
            cat.category === "property_photo" ? "واجهة رئيسية — حالة جيدة" : undefined,
        };
      }),
      extractedNumbers: [
        { label: "رقم الصك", value: "310298765", source: files[0]?.name || "صك" },
        { label: "مساحة الأرض", value: "625 م²", source: files[0]?.name || "صك" },
        { label: "رقم الهوية", value: "1088456723", source: "وثيقة هوية" },
        { label: "تاريخ الإصدار", value: "1445/03/15 هـ", source: files[0]?.name || "صك" },
      ],
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  const classifiedCount = uploadedFiles.filter(f => f.category).length;
  const highRelevanceCount = uploadedFiles.filter(f => f.relevance === "high").length;

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-5xl mx-auto space-y-6">
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
              <div className="bg-card rounded-lg border border-border p-12 text-center">
                <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                <h3 className="text-lg font-semibold text-foreground mb-1">جارٍ التحليل...</h3>
                <p className="text-sm text-muted-foreground">{extractionPhase}</p>
                <Progress value={extractionPhase.includes("رفع") ? 30 : 70} className="h-1.5 mt-4 max-w-xs mx-auto" />
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

                {/* Extracted Numbers */}
                {extracted.extractedNumbers && extracted.extractedNumbers.length > 0 && (
                  <div className="bg-card rounded-lg border border-border">
                    <button onClick={() => setShowExtractedNums(!showExtractedNums)}
                      className="w-full p-4 flex items-center justify-between border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">بيانات مستخرجة ({extracted.extractedNumbers.length})</h3>
                      </div>
                      {showExtractedNums ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {showExtractedNums && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {extracted.extractedNumbers.map((en, i) => (
                          <div key={i} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10 group">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] text-muted-foreground">{en.label}</p>
                              <p className="text-sm font-semibold text-foreground">{en.value}</p>
                              <p className="text-[9px] text-muted-foreground/50">من: {en.source}</p>
                            </div>
                            <button onClick={() => copyToClipboard(en.value)}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all text-muted-foreground">
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Client Data */}
                {extracted.client && Object.values(extracted.client).some(v => v) && (
                  <div className="bg-card rounded-lg border border-border">
                    <button onClick={() => setShowClientData(!showClientData)}
                      className="w-full p-4 flex items-center justify-between border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">بيانات العميل المستخرجة</h3>
                      </div>
                      {showClientData ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {showClientData && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: "clientName", label: "الاسم", icon: User },
                          { key: "idNumber", label: "رقم الهوية", icon: Hash },
                          { key: "phone", label: "الجوال", icon: Phone },
                          { key: "email", label: "البريد", icon: Mail },
                        ].filter(f => extracted.client[f.key as keyof typeof extracted.client]).map(f => (
                          <div key={f.key} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div>
                              <p className="text-[10px] text-muted-foreground">{f.label}</p>
                              <p className="text-sm font-medium text-foreground">{extracted.client[f.key as keyof typeof extracted.client]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Asset Data */}
                {extracted.asset && Object.values(extracted.asset).some(v => v) && (
                  <div className="bg-card rounded-lg border border-border">
                    <button onClick={() => setShowAssetData(!showAssetData)}
                      className="w-full p-4 flex items-center justify-between border-b border-border hover:bg-muted/20 transition-colors">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">بيانات الأصل المستخرجة</h3>
                      </div>
                      {showAssetData ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {showAssetData && (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          { key: "description", label: "الوصف", icon: FileText },
                          { key: "city", label: "المدينة", icon: MapPin },
                          { key: "district", label: "الحي", icon: MapPin },
                          { key: "area", label: "المساحة", icon: Ruler },
                          { key: "deedNumber", label: "رقم الصك", icon: FileCheck },
                          { key: "classification", label: "التصنيف", icon: Tag },
                          { key: "machineName", label: "اسم المعدة", icon: Building2 },
                          { key: "manufacturer", label: "المصنع", icon: Building2 },
                          { key: "model", label: "الموديل", icon: Tag },
                        ].filter(f => extracted.asset[f.key as keyof typeof extracted.asset]).map(f => (
                          <div key={f.key} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
                            <f.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground">{f.label}</p>
                              <p className="text-sm font-medium text-foreground truncate">{extracted.asset[f.key as keyof typeof extracted.asset]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggested Purpose */}
                {extracted.suggestedPurpose && (
                  <div className="bg-primary/5 rounded-lg border border-primary/20 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <p className="text-[11px] text-primary/60">غرض التقييم المقترح</p>
                      <p className="text-sm font-semibold text-primary">{extracted.suggestedPurpose}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
