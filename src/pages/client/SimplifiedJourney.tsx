import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
}

type JourneyStep = "start" | "upload" | "processing" | "scope" | "complete";

const PURPOSE_OPTIONS: Record<string, string> = {
  financing: "تمويل",
  sale: "بيع",
  purchase: "شراء",
  financial_reporting: "تقارير مالية",
  zakat_tax: "زكاة / ضريبة",
  dispute_court: "نزاع / قضاء",
  expropriation: "نزع ملكية",
  insurance: "تأمين",
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

        newFiles.push({ id: crypto.randomUUID(), name: originalFilename, size: file.size, type: file.type, path: storageKey });
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

  // ── Step 2 → Step 3 (auto-process) ──
  const handleUploadDone = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: "يرجى رفع ملف واحد على الأقل", variant: "destructive" });
      return;
    }
    setStep("processing");
    setProcessingProgress(0);

    try {
      const { data, error } = await supabase.functions.invoke("asset-extraction-orchestrator", {
        body: {
          action: "create",
          userId: user.id,
          files: uploadedFiles.map(f => ({
            name: f.name, path: f.path, size: f.size, mimeType: f.type,
          })),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setJobId(data.jobId);
    } catch (err: any) {
      toast({ title: "خطأ في بدء المعالجة", description: err.message, variant: "destructive" });
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

          const { data: assets } = await supabase
            .from("extracted_assets")
            .select("*")
            .eq("job_id", jobId);

          const realEstate = (assets || []).filter(a => a.asset_type === "real_estate").length;
          const machinery = (assets || []).filter(a => a.asset_type === "machinery_equipment").length;
          const totalAssets = (assets || []).length;

          setScopeData({
            totalAssets,
            realEstate,
            machinery,
            assets: assets || [],
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
          valuation_type: scopeData.discipline as any,
          purpose: (purpose || null) as any,
          purpose_other: purpose === "other" ? purposeOther : null,
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
          type: "request_submitted",
          userId: user.id,
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

      <div className="max-w-2xl mx-auto px-4 pb-10">

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
                  تم تحليل المستندات وإعداد نطاق العمل تلقائياً — راجع وأكد
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <p className="text-xs text-muted-foreground">إجمالي الأصول</p>
                      <p className="text-2xl font-bold text-foreground">{scopeData.totalAssets}</p>
                    </div>
                    <div className="bg-card rounded-lg p-3 border border-border">
                      <p className="text-xs text-muted-foreground">المنهج المقترح</p>
                      <p className="text-sm font-semibold text-foreground mt-1">{scopeData.approach}</p>
                    </div>
                  </div>

                  {scopeData.realEstate > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{scopeData.realEstate} عقار</Badge>
                    </div>
                  )}
                  {scopeData.machinery > 0 && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{scopeData.machinery} معدة / آلة</Badge>
                    </div>
                  )}

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">الغرض</p>
                    <p className="text-sm font-medium text-foreground">
                      {purpose === "other" ? purposeOther : PURPOSE_OPTIONS[purpose]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">مستخدمو التقرير</p>
                    <p className="text-sm font-medium text-foreground">
                      {intendedUsers === "other" ? intendedUsersOther : USERS_OPTIONS[intendedUsers]}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">المستندات</p>
                    <p className="text-sm font-medium text-foreground">{uploadedFiles.length} ملف</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleConfirmScope}
                    className="flex-1 gap-2"
                    size="lg"
                    disabled={loading || scopeConfirmed}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    اعتماد وإرسال
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
