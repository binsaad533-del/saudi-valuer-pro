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
  ArrowRight, Building2, Cog, Shield, Table2,
} from "lucide-react";
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

type PageState = "form" | "processing" | "done";

const ASSET_TYPES = [
  { key: "real_estate", label: "عقار", icon: Building2, desc: "أراضٍ، مباني، شقق، فلل" },
  { key: "machinery_equipment", label: "آلات ومعدات", icon: Cog, desc: "معدات صناعية، أجهزة، مركبات، أثاث" },
] as const;

export default function SimpleClientRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [state, setState] = useState<PageState>("form");

  // Form fields
  const [assetType, setAssetType] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Processing
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

  // ── File helpers ──
  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-red-500" />;
    if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <Table2 className="w-4 h-4 text-green-500" />;
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

  // ── Submit ──
  const handleSubmit = async () => {
    if (!assetType) { toast({ title: "يرجى اختيار نوع الأصل", variant: "destructive" }); return; }
    if (uploadedFiles.length === 0) { toast({ title: "يرجى رفع ملف واحد على الأقل", variant: "destructive" }); return; }
    if (!user) return;

    setSubmitting(true);
    setState("processing");
    setProcessingProgress(10);
    setProcessingLabel("جارٍ تجهيز الطلب...");

    try {
      // ── Step 1: Parse Excel files locally (if any) ──
      const excelFiles = uploadedFiles.filter(f => isExcel(f.type, f.name));
      const otherFiles = uploadedFiles.filter(f => !isExcel(f.type, f.name));
      let assetInventory: any[] = [];

      if (excelFiles.length > 0) {
        setProcessingLabel("جارٍ قراءة ملفات Excel...");
        setProcessingProgress(20);
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
                  name: String(row.name || `أصل ${assetInventory.length + 1}`),
                  type: assetType,
                  category: row.type ? String(row.type) : null,
                  quantity: Number(row.quantity) || 1,
                  condition: row.condition ? String(row.condition) : "unknown",
                  confidence: mappings.filter(m => m.autoMapped).length >= 2 ? 80 : 50,
                  source: `${uf.name} → ${sheet.name}`,
                });
              }
            }
          } catch { /* skip broken files */ }
        }
      }

      setProcessingProgress(50);
      setProcessingLabel("جارٍ إنشاء الطلب...");

      // ── Step 2: Start AI orchestrator for non-Excel files ──
      let jobId: string | null = null;
      if (otherFiles.length > 0) {
        setProcessingLabel("جارٍ تحليل المستندات بالذكاء الاصطناعي...");
        try {
          const { data: jobData } = await supabase.functions.invoke("asset-extraction-orchestrator", {
            body: {
              action: "create",
              userId: user.id,
              files: otherFiles.map(f => ({ name: f.name, path: f.path, size: f.size, mimeType: f.type })),
            },
          });
          jobId = jobData?.jobId || null;
        } catch { /* AI extraction is optional — proceed without it */ }
      }

      setProcessingProgress(70);
      setProcessingLabel("جارٍ حفظ الطلب...");

      // ── Step 3: Create valuation_request ──
      const assetData = {
        discipline: assetType,
        inventory: assetInventory.map((a, i) => ({ id: i + 1, ...a })),
        summary: { total: assetInventory.length, by_type: { [assetType]: assetInventory.length } },
        jobId,
      };

      const { data: reqData, error: reqError } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (assetType === "machinery_equipment" ? "machinery" : assetType) as any,
          property_description_ar: notes || null,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            jobId,
            files: uploadedFiles.map(f => ({ name: f.name, path: f.path, type: f.type })),
            totalAssets: assetInventory.length,
            simplified: true,
            quick_request: true,
          },
          asset_data: assetData,
        } as any)
        .select()
        .single();

      if (reqError) throw reqError;

      const newRequestId = (reqData as any)?.id;

      // Link job
      if (jobId && newRequestId) {
        await supabase.from("processing_jobs").update({ request_id: newRequestId }).eq("id", jobId);
      }

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

      // Fire-and-forget: send notification
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
      setState("form");
    } finally {
      setSubmitting(false);
    }
  };

  // ── DONE ──
  if (state === "done") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-success mx-auto" />
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
            <h3 className="text-lg font-bold text-foreground mb-1">جارٍ تجهيز طلبك</h3>
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

  // ── FORM ──
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/client/dashboard")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة
          </Button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* ── 1. Asset Type ── */}
        <div className="space-y-2">
          <p className="text-sm font-semibold text-foreground">نوع الأصل <span className="text-destructive">*</span></p>
          <div className="grid grid-cols-2 gap-3">
            {ASSET_TYPES.map((t) => {
              const Icon = t.icon;
              const selected = assetType === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setAssetType(t.key)}
                  className={`relative text-right border-2 rounded-xl p-4 transition-all ${
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-foreground">{t.label}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                  {selected && (
                    <div className="absolute top-2 left-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── 2. File Upload ── */}
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

        {/* ── Submit ── */}
        <Button
          onClick={handleSubmit}
          className="w-full gap-2"
          size="lg"
          disabled={!assetType || uploadedFiles.length === 0 || uploading || submitting}
        >
          <Send className="w-4 h-4" />
          إرسال الطلب
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          بعد الإرسال، سيتم تحليل المستندات تلقائياً وإعداد نطاق العمل وعرض السعر.
          <br />لن يبدأ التقييم إلا بعد موافقتك على النطاق وتأكيد الدفع.
        </p>
      </div>
    </div>
  );
}
