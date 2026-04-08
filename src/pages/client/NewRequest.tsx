import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ProcessingStatusTracker from "@/components/client/ProcessingStatusTracker";
import AssetReviewWorkspace from "@/components/client/AssetReviewWorkspace";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileText, Image, File, X, Loader2, CheckCircle, ArrowRight,
  Sparkles, User as UserIcon, FileCheck, Brain,
} from "lucide-react";
import logo from "@/assets/logo.png";
import AssetLocationPicker, { type AssetLocation } from "@/components/client/AssetLocationPicker";
import { DiscountCodeSection } from "@/components/client/request/DiscountCodeSection";
import { LocationsSummary } from "@/components/client/request/LocationsSummary";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

type Step = "upload" | "processing" | "review" | "submitted";

const PURPOSE_LABELS: Record<string, string> = {
  financing: "تمويل",
  sale: "بيع",
  purchase: "شراء",
  financial_reporting: "تقارير مالية",
  zakat_tax: "زكاة / ضريبة",
  dispute_court: "نزاع / قضاء",
  expropriation: "نزع ملكية",
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

export default function NewRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Files
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Processing job
  const [jobId, setJobId] = useState<string | null>(null);

  // Client info
  const [clientInfo, setClientInfo] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    idNumber: "",
    clientType: "",
    additionalNotes: "",
    purpose: "",
    purposeOther: "",
    intendedUsers: "",
    intendedUsersOther: "",
  });

  // Discount code
  const [clientDiscountCode, setClientDiscountCode] = useState("");
  const [clientDiscountApplied, setClientDiscountApplied] = useState<{ code: string; percentage: number } | null>(null);
  const [clientCheckingDiscount, setClientCheckingDiscount] = useState(false);

  // Asset locations
  const [assetLocations, setAssetLocations] = useState<AssetLocation[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
    };
    checkAuth();
  }, [navigate]);

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="w-4 h-4 text-info" />;
    if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
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

        newFiles.push({
          id: crypto.randomUUID(),
          name: originalFilename,
          size: file.size,
          type: file.type,
          path: storageKey,
        });
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFileUpload(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  // ── Start AI Processing via Orchestrator ──
  const startProcessing = async () => {
    if (!clientInfo.purpose) {
      toast({ title: "يرجى اختيار الغرض من التقييم", variant: "destructive" });
      return;
    }
    if (clientInfo.purpose === "other" && !clientInfo.purposeOther.trim()) {
      toast({ title: "يرجى تحديد الغرض من التقييم", variant: "destructive" });
      return;
    }
    if (!clientInfo.intendedUsers) {
      toast({ title: "يرجى اختيار مستخدم التقرير", variant: "destructive" });
      return;
    }
    if (clientInfo.intendedUsers === "other" && !clientInfo.intendedUsersOther.trim()) {
      toast({ title: "يرجى تحديد مستخدم التقرير", variant: "destructive" });
      return;
    }
    if (uploadedFiles.length === 0) {
      toast({ title: "يرجى رفع الوثائق أولاً", variant: "destructive" });
      return;
    }
    if (!user) return;

    setStep("processing");

    try {
      const { data, error } = await supabase.functions.invoke("asset-extraction-orchestrator", {
        body: {
          action: "create",
          userId: user.id,
          files: uploadedFiles.map(f => ({
            name: f.name,
            path: f.path,
            size: f.size,
            mimeType: f.type,
          })),
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setJobId(data.jobId);
    } catch (err: any) {
      console.error("Processing error:", err);
      toast({ title: "خطأ في بدء المعالجة", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleProcessingReady = useCallback((readyJobId: string) => {
    setJobId(readyJobId);
    setStep("review");
  }, []);

  const handleProcessingCancel = useCallback(() => {
    setStep("upload");
    setJobId(null);
  }, []);

  // ── Submit from review workspace ──
  const handleSubmitFromReview = async (assets: any[], discipline: string, description: string) => {
    if (!user) return;
    setLoading(true);

    try {
      const assetData = {
        discipline,
        inventory: assets.filter(a => a.review_status !== "rejected").map(a => ({
          id: a.asset_index,
          name: a.name,
          type: a.asset_type,
          category: a.category,
          subcategory: a.subcategory,
          quantity: a.quantity,
          condition: a.condition,
          fields: a.asset_data?.fields || [],
          source: a.source_evidence,
          confidence: a.confidence,
        })),
        summary: {
          total: assets.filter(a => a.review_status !== "rejected").length,
          by_type: {
            real_estate: assets.filter(a => a.asset_type === "real_estate" && a.review_status !== "rejected").length,
            machinery_equipment: assets.filter(a => a.asset_type === "machinery_equipment" && a.review_status !== "rejected").length,
          },
        },
        description,
        jobId,
      };

      const { data, error } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (discipline || "real_estate") as any,
          property_description_ar: description || null,
          purpose: (clientInfo.purpose || null) as any,
          purpose_other: clientInfo.purpose === "other" ? clientInfo.purposeOther : null,
          intended_users_ar: clientInfo.intendedUsers === "other"
            ? clientInfo.intendedUsersOther
            : (INTENDED_USERS_OPTIONS[clientInfo.intendedUsers] || clientInfo.intendedUsers || null),
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            jobId,
            files: uploadedFiles,
            clientInfo,
            assetLocations,
            totalAssets: assetData.inventory.length,
          },
          asset_data: assetData,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Link request to processing job
      if (jobId && data) {
        await supabase.from("processing_jobs")
          .update({ request_id: (data as any).id })
          .eq("id", jobId);
      }

      // Insert request_documents
      if (uploadedFiles.length > 0 && data) {
        const docs = uploadedFiles.map(f => ({
          request_id: (data as any).id,
          uploaded_by: user.id,
          file_name: f.name,
          file_path: f.path,
          file_size: f.size,
          mime_type: f.type,
        }));
        await supabase.from("request_documents" as any).insert(docs);
      }

      setRequestId((data as any)?.id || null);
      setStep("submitted");
      toast({ title: "تم إرسال طلب التقييم بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Discount code handler
  const handleApplyDiscount = async () => {
    if (!clientDiscountCode.trim()) return;
    setClientCheckingDiscount(true);
    try {
      const { data, error } = await supabase
        .from("discount_codes")
        .select("*")
        .eq("code", clientDiscountCode.trim().toUpperCase())
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        toast({ title: "كود غير صالح", variant: "destructive" });
      } else {
        setClientDiscountApplied({ code: data.code, percentage: data.discount_percentage });
        toast({ title: `تم تطبيق خصم ${data.discount_percentage}%` });
      }
    } catch { /* ignore */ }
    setClientCheckingDiscount(false);
  };

  // Step indicators
  const steps = [
    { key: "upload", label: "البيانات والوثائق", icon: Upload },
    { key: "processing", label: "تحليل ذكي", icon: Brain },
    { key: "review", label: "مراجعة الأصول", icon: FileCheck },
  ];

  const currentStepIndex = step === "submitted" ? steps.length : steps.findIndex(s => s.key === step);

  // === SUBMITTED ===
  if (step === "submitted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك بنجاح</h2>
            <p className="text-sm text-muted-foreground mb-6">
              سيقوم فريقنا بمراجعة طلبك وإرسال عرض السعر ونطاق العمل في أقرب وقت.
            </p>
            <div className="space-y-2">
              <Button onClick={() => navigate("/client")} className="w-full">العودة للوحة التحكم</Button>
              {requestId && (
                <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full">
                  عرض تفاصيل الطلب
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="جساس" className="w-8 h-8" />
            <h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/client")}>
            <ArrowRight className="w-4 h-4 ml-1" />
            العودة
          </Button>
        </div>
      </header>

      {/* Step Progress */}
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStepIndex;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                    isDone ? "bg-success text-success-foreground" :
                    isActive ? "gradient-primary text-primary-foreground shadow-blue" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[11px] font-medium ${isActive ? "text-primary" : isDone ? "text-success" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-3 mt-[-18px] rounded ${isDone ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {/* === STEP 1: Client Info + Upload === */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Report Client Info */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserIcon className="w-5 h-5 text-primary" />
                  بيانات عميل التقرير
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  أدخل بيانات الشخص أو الجهة التي سيُعد التقرير لصالحها.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">الغرض من التقييم <span className="text-destructive">*</span></Label>
                    <Select value={clientInfo.purpose} onValueChange={(val) => setClientInfo(p => ({ ...p, purpose: val, purposeOther: val !== "other" ? "" : p.purposeOther }))}>
                      <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {clientInfo.purpose === "other" && (
                      <Input
                        value={clientInfo.purposeOther}
                        onChange={(e) => setClientInfo(p => ({ ...p, purposeOther: e.target.value }))}
                        placeholder="حدد الغرض من التقييم"
                        className="mt-2"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">نوع العميل <span className="text-destructive">*</span></Label>
                    <Select value={clientInfo.clientType} onValueChange={(val) => setClientInfo(p => ({ ...p, clientType: val }))}>
                      <SelectTrigger><SelectValue placeholder="فرد أو جهة" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">فرد</SelectItem>
                        <SelectItem value="company">شركة / مؤسسة</SelectItem>
                        <SelectItem value="government">جهة حكومية</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">اسم عميل التقرير <span className="text-destructive">*</span></Label>
                    <Input value={clientInfo.contactName} onChange={(e) => setClientInfo(p => ({ ...p, contactName: e.target.value }))} placeholder="اسم الشخص أو الجهة" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">رقم الهوية / السجل التجاري</Label>
                    <Input value={clientInfo.idNumber} onChange={(e) => setClientInfo(p => ({ ...p, idNumber: e.target.value }))} placeholder="رقم الهوية أو السجل" dir="ltr" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">رقم الجوال <span className="text-destructive">*</span></Label>
                    <Input value={clientInfo.contactPhone} onChange={(e) => setClientInfo(p => ({ ...p, contactPhone: e.target.value }))} placeholder="05XXXXXXXX" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">البريد الإلكتروني</Label>
                    <Input value={clientInfo.contactEmail} onChange={(e) => setClientInfo(p => ({ ...p, contactEmail: e.target.value }))} placeholder="example@email.com" dir="ltr" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">مستخدمو التقرير <span className="text-destructive">*</span></Label>
                  <Select value={clientInfo.intendedUsers} onValueChange={(val) => setClientInfo(p => ({ ...p, intendedUsers: val, intendedUsersOther: val !== "other" ? "" : p.intendedUsersOther }))}>
                    <SelectTrigger><SelectValue placeholder="اختر مستخدم التقرير" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(INTENDED_USERS_OPTIONS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clientInfo.intendedUsers === "other" && (
                    <Input
                      value={clientInfo.intendedUsersOther}
                      onChange={(e) => setClientInfo(p => ({ ...p, intendedUsersOther: e.target.value }))}
                      placeholder="حدد مستخدم التقرير"
                      className="mt-2"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Documents Upload */}
            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Upload className="w-5 h-5 text-primary" />
                  الوثائق المتعلقة بالتقييم
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  ارفع صكوك الملكية، المخططات، التقارير، الصور، جداول البيانات، أو أي مستندات ذات صلة. سيتم تحليل محتواها واستخراج كافة البيانات تلقائياً.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                >
                  <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
                  <p className="text-sm font-medium text-foreground mb-1">
                    {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات هنا أو اضغط للاختيار"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF • صور • Word • Excel (XLSX, CSV) • ZIP — بأي عدد وحجم
                  </p>
                  {uploading && (
                    <div className="mt-2 flex items-center justify-center gap-2 text-primary">
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
                  onChange={handleInputChange}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.tif,.tiff,.zip,.rar,.7z,.gz,.webp,.heic,.ppt,.pptx,.xml,.json"
                />

                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      الملفات المرفوعة ({uploadedFiles.length})
                    </p>
                    <div className="max-h-[200px] overflow-y-auto space-y-1">
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

            {/* Asset Locations */}
            <AssetLocationPicker locations={assetLocations} onChange={setAssetLocations} />

            {/* Next button */}
            <Button
              onClick={startProcessing}
              className="w-full gap-2"
              size="lg"
              disabled={uploadedFiles.length === 0 || uploading || !clientInfo.contactName.trim() || !clientInfo.purpose || !clientInfo.clientType || !clientInfo.contactPhone.trim() || !clientInfo.intendedUsers.trim()}
            >
              <Sparkles className="w-4 h-4" />
              تحليل الوثائق واستخراج البيانات ({uploadedFiles.length} ملف)
            </Button>
          </div>
        )}

        {/* === STEP 2: Processing === */}
        {step === "processing" && (
          <ProcessingStatusTracker
            jobId={jobId}
            onReady={handleProcessingReady}
            onCancel={handleProcessingCancel}
          />
        )}

        {/* === STEP 3: Review Workspace === */}
        {step === "review" && jobId && (
          <div className="space-y-4">
            {/* Discount Code */}
            <Card className="shadow-card">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">كود خصم (اختياري)</span>
                </div>
                {clientDiscountApplied ? (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{clientDiscountApplied.code}</span>
                      <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 border-0">-{clientDiscountApplied.percentage}%</Badge>
                    </div>
                    <button onClick={() => { setClientDiscountApplied(null); setClientDiscountCode(""); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={clientDiscountCode}
                      onChange={(e) => setClientDiscountCode(e.target.value.toUpperCase())}
                      placeholder="أدخل كود الخصم"
                      className="font-mono tracking-wider text-sm"
                      dir="ltr"
                    />
                    <Button variant="outline" size="sm" onClick={handleApplyDiscount} disabled={clientCheckingDiscount || !clientDiscountCode.trim()}>
                      {clientCheckingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : "تطبيق"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Asset Locations Summary */}
            {assetLocations.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    مواقع الأصول ({assetLocations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {assetLocations.map(loc => (
                      <button key={loc.id} type="button" onClick={() => openLocationInGoogleMaps(loc)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/40 transition-colors shadow-sm text-sm font-medium text-foreground hover:text-primary">
                        <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="max-w-[160px] truncate">{loc.name}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <AssetReviewWorkspace
              jobId={jobId}
              onSubmit={handleSubmitFromReview}
              onBack={() => setStep("upload")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
