import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import AssetInventoryTable, { type InventoryAsset } from "@/components/client/AssetInventoryTable";

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
  Bot,
  CheckCircle,
  ArrowRight,
  Sparkles,
  User as UserIcon,
  FileCheck,
  Brain,
  MapPin,
  Navigation,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import logo from "@/assets/logo.png";
import AssetLocationPicker, { type AssetLocation } from "@/components/client/AssetLocationPicker";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
}

interface DocumentCategory {
  fileName: string;
  category: string;
  categoryLabel: string;
  relevance: string;
  extractedInfo?: string;
}

interface ExtractedResult {
  discipline: string;
  discipline_label: string;
  confidence: number;
  client?: {
    clientName?: string;
    idNumber?: string;
    phone?: string;
    email?: string;
  };
  description?: string;
  inventory?: InventoryAsset[];
  summary?: {
    total: number;
    by_type?: Record<string, number>;
    by_condition?: Record<string, number>;
  };
  // Legacy flat fields fallback
  asset?: { description?: string };
  assetFields?: { key: string; label: string; value: string; confidence: number; source?: string; group?: string }[];
  suggestedPurpose?: string;
  notes: string[];
  documentCategories: DocumentCategory[];
  analyzedFilesCount?: number;
  totalFilesCount?: number;
}

type Step = "upload" | "processing" | "extracted" | "submitted";

const CATEGORY_LABELS: Record<string, string> = {
  deed: "صك ملكية",
  building_permit: "رخصة بناء",
  floor_plan: "مخطط معماري",
  property_photo: "صورة عقار",
  machinery_photo: "صورة معدة",
  identity_doc: "وثيقة هوية",
  invoice: "فاتورة",
  contract: "عقد",
  technical_report: "تقرير فني",
  location_map: "خريطة موقع",
  spreadsheet: "جدول بيانات",
  archive: "ملف مضغوط",
  other: "أخرى",
};

const PURPOSE_LABELS: Record<string, string> = {
  sale_purchase: "بيع / شراء",
  mortgage: "رهن عقاري",
  financial_reporting: "تقارير مالية",
  insurance: "تأمين",
  taxation: "ضريبي",
  litigation: "قضائي",
  investment: "استثمار",
  zakat: "زكاة",
  expropriation: "نزع ملكية",
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

  // AI extracted
  const [extractedResult, setExtractedResult] = useState<ExtractedResult | null>(null);
  const [inventoryAssets, setInventoryAssets] = useState<InventoryAsset[]>([]);
  const [editableDescription, setEditableDescription] = useState("");
  const [currentDiscipline, setCurrentDiscipline] = useState("real_estate");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");

  // Report client info
  const [clientInfo, setClientInfo] = useState({
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    idNumber: "",
    clientType: "",
    additionalNotes: "",
    purpose: "",
    intendedUsers: "",
  });

  // Discount code
  const [clientDiscountCode, setClientDiscountCode] = useState("");
  const [clientDiscountApplied, setClientDiscountApplied] = useState<{ code: string; percentage: number } | null>(null);
  const [clientCheckingDiscount, setClientCheckingDiscount] = useState(false);

  // Asset locations
  const [assetLocations, setAssetLocations] = useState<AssetLocation[]>([]);

  // Legacy conversion helper: convert flat assetFields to inventory format
  const convertFieldsToInventory = (fields: any[], disc: string): InventoryAsset[] => {
    if (!fields || fields.length === 0) return [];
    return [{
      id: 1,
      name: "أصل مستخرج",
      type: disc === "machinery_equipment" ? "machinery_equipment" : "real_estate",
      category: disc === "machinery_equipment" ? "معدة" : "عقار",
      quantity: 1,
      condition: "good",
      fields: fields.map(f => ({ key: f.key, label: f.label, value: f.value, confidence: f.confidence })),
      source: fields[0]?.source || "تحليل ذكي",
    }];
  };

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
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
    if (!user) return;
    setUploading(true);
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(filePath, file);

      if (error) {
        toast({ title: `خطأ في رفع ${file.name}`, description: error.message, variant: "destructive" });
        continue;
      }

      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        path: filePath,
      });
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  // ── AI Processing via extract-documents ──
  const processWithAI = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: "يرجى رفع الوثائق أولاً", variant: "destructive" });
      return;
    }

    setStep("processing");
    setProcessingProgress(0);
    setProcessingMessage("جارٍ تحميل الملفات وقراءة المحتوى...");

    try {
      const progressSteps = [
        { pct: 10, msg: "جارٍ تحميل الملفات وقراءة المحتوى..." },
        { pct: 25, msg: "تحليل الصور والمستندات بالذكاء الاصطناعي..." },
        { pct: 40, msg: "استخراج البيانات من الجداول والملفات..." },
        { pct: 55, msg: "جرد الأصول وتحديد المواصفات الفنية..." },
        { pct: 70, msg: "تصنيف المستندات وتحديد نوع التقييم..." },
      ];

      // Start progress animation
      let currentStep = 0;
      const progressInterval = setInterval(() => {
        if (currentStep < progressSteps.length) {
          setProcessingProgress(progressSteps[currentStep].pct);
          setProcessingMessage(progressSteps[currentStep].msg);
          currentStep++;
        }
      }, 1500);

      // Call extract-documents with actual storage paths
      const resp = await supabase.functions.invoke("extract-documents", {
        body: {
          fileNames: uploadedFiles.map(f => f.name),
          fileDescriptions: uploadedFiles.map(() => ""),
          storagePaths: uploadedFiles.map(f => ({
            path: f.path,
            name: f.name,
            mimeType: f.type,
          })),
        },
      });

      clearInterval(progressInterval);

      if (resp.error) throw new Error(resp.error.message || "فشل التحليل الذكي");

      const result = resp.data as ExtractedResult & { error?: string };

      if (result.error) throw new Error(result.error);

      // Auto-fill client info from AI extraction
      if (result.client) {
        setClientInfo(prev => ({
          ...prev,
          contactName: prev.contactName || result.client?.clientName || "",
          idNumber: prev.idNumber || result.client?.idNumber || "",
          contactPhone: prev.contactPhone || result.client?.phone || "",
          contactEmail: prev.contactEmail || result.client?.email || "",
        }));
      }

      if (result.suggestedPurpose && !clientInfo.purpose) {
        setClientInfo(prev => ({ ...prev, purpose: result.suggestedPurpose || prev.purpose }));
      }

      setExtractedResult(result);
      // Build inventory from result
      const inv = result.inventory || convertFieldsToInventory(result.assetFields || [], result.discipline);
      setInventoryAssets(inv);
      setCurrentDiscipline(result.discipline || "real_estate");
      setEditableDescription(result.description || result.asset?.description || "");

      setProcessingProgress(100);
      setProcessingMessage("تم الاستخراج بنجاح!");
      await new Promise(r => setTimeout(r, 500));
      setStep("extracted");
    } catch (err: any) {
      console.error("Extract error:", err);
      toast({ title: "خطأ في التحليل", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  // ── Submit ──
  const handleSubmitRequest = async () => {
    if (!user || !extractedResult) return;
    setLoading(true);

    try {
      const assetData = {
        discipline: currentDiscipline,
        inventory: inventoryAssets,
        summary: {
          total: inventoryAssets.length,
          by_type: {
            real_estate: inventoryAssets.filter(a => a.type === "real_estate").length,
            machinery_equipment: inventoryAssets.filter(a => a.type === "machinery_equipment").length,
          },
        },
        description: editableDescription,
      };

      const { data, error } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (currentDiscipline || "real_estate") as any,
          property_description_ar: editableDescription || null,
          purpose: (clientInfo.purpose || extractedResult.suggestedPurpose || null) as any,
          intended_users_ar: clientInfo.intendedUsers || null,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          ai_intake_summary: {
            extractedResult,
            inventoryAssets,
            editableDescription,
            files: uploadedFiles,
            clientInfo,
            assetLocations,
            documentCategories: extractedResult.documentCategories,
          },
          asset_data: assetData,
        } as any)
        .select()
        .single();

      if (error) throw error;

      if (uploadedFiles.length > 0 && data) {
        const reqData = data as any;
        const docs = uploadedFiles.map(f => ({
          request_id: reqData.id,
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




  // Step indicators
  const steps = [
    { key: "upload", label: "البيانات والوثائق", icon: Upload },
    { key: "processing", label: "تحليل ذكي", icon: Brain },
    { key: "extracted", label: "مراجعة وإرسال", icon: FileCheck },
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
                    <Select
                      value={clientInfo.purpose}
                      onValueChange={(val) => setClientInfo(p => ({ ...p, purpose: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الغرض" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PURPOSE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">نوع العميل <span className="text-destructive">*</span></Label>
                    <Select
                      value={clientInfo.clientType}
                      onValueChange={(val) => setClientInfo(p => ({ ...p, clientType: val }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="فرد أو جهة" />
                      </SelectTrigger>
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
                    <Input
                      value={clientInfo.contactName}
                      onChange={(e) => setClientInfo(p => ({ ...p, contactName: e.target.value }))}
                      placeholder="اسم الشخص أو الجهة"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">رقم الهوية / السجل التجاري</Label>
                    <Input
                      value={clientInfo.idNumber}
                      onChange={(e) => setClientInfo(p => ({ ...p, idNumber: e.target.value }))}
                      placeholder="رقم الهوية أو السجل"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">رقم الجوال <span className="text-destructive">*</span></Label>
                    <Input
                      value={clientInfo.contactPhone}
                      onChange={(e) => setClientInfo(p => ({ ...p, contactPhone: e.target.value }))}
                      placeholder="05XXXXXXXX"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">البريد الإلكتروني</Label>
                    <Input
                      value={clientInfo.contactEmail}
                      onChange={(e) => setClientInfo(p => ({ ...p, contactEmail: e.target.value }))}
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">مستخدمو التقرير <span className="text-destructive">*</span></Label>
                  <Input
                    value={clientInfo.intendedUsers}
                    onChange={(e) => setClientInfo(p => ({ ...p, intendedUsers: e.target.value }))}
                    placeholder="مثال: البنك، المستثمر، الجهة الحكومية..."
                  />
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
                  ارفع صكوك الملكية، المخططات، التقارير، الصور، جداول البيانات، أو أي مستندات ذات صلة. سيقوم الذكاء الاصطناعي بتحليل محتواها واستخراج كافة البيانات تلقائياً.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                    dragOver
                      ? "border-primary bg-primary/5 scale-[1.01]"
                      : "border-border hover:border-primary/40 hover:bg-muted/30"
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
                    PDF, صور, Word, Excel, CSV, ZIP
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
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.tif,.tiff,.zip,.rar,.7z,.gz,.webp"
                />

                {uploadedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground">
                      الملفات المرفوعة ({uploadedFiles.length})
                    </p>
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
                )}
              </CardContent>
            </Card>

            {/* Asset Locations */}
            <AssetLocationPicker locations={assetLocations} onChange={setAssetLocations} />

            {/* Next button */}
            <Button
              onClick={processWithAI}
              className="w-full gap-2"
              size="lg"
              disabled={uploadedFiles.length === 0 || uploading || !clientInfo.contactName.trim() || !clientInfo.purpose || !clientInfo.clientType || !clientInfo.contactPhone.trim() || !clientInfo.intendedUsers.trim()}
            >
              <Sparkles className="w-4 h-4" />
              تحليل الوثائق بالذكاء الاصطناعي
            </Button>
          </div>
        )}

        {/* === STEP 2: Processing === */}
        {step === "processing" && (
          <Card className="shadow-card">
            <CardContent className="p-10 text-center">
              <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Brain className="w-10 h-10 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">جارٍ التحليل الذكي للمستندات</h3>
              <p className="text-sm text-muted-foreground mb-6">{processingMessage}</p>

              <Progress value={processingProgress} className="mb-2" />
              <p className="text-xs text-muted-foreground">{processingProgress}%</p>

              <div className="mt-6 space-y-2 text-right">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {getFileIcon(file.type)}
                    <span className="truncate">{file.name}</span>
                    <CheckCircle className="w-3 h-3 text-success mr-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* === STEP 3: Extracted Data Review === */}
        {step === "extracted" && extractedResult && (
          <div className="space-y-4">
            {/* AI Notes */}
            {extractedResult.notes?.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Bot className="w-4 h-4 text-primary" />
                      ملاحظات التحليل الذكي
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      <ShieldCheck className="w-3 h-3 ml-1" />
                      دقة {Math.round(extractedResult.confidence * 100)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {extractedResult.notes.map((note, i) => (
                      <p key={i} className="text-sm text-foreground flex items-start gap-1.5">
                        <span className="text-primary mt-0.5">•</span>
                        {note}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Asset Inventory Table */}
            <AssetInventoryTable
              discipline={currentDiscipline}
              inventory={inventoryAssets}
              description={editableDescription}
              summary={extractedResult.summary}
              onInventoryChange={setInventoryAssets}
              onDescriptionChange={setEditableDescription}
              onDisciplineChange={setCurrentDiscipline}
              onReanalyze={() => {
                setStep("upload");
              }}
            />

            {/* Document Categories */}
            {extractedResult.documentCategories?.length > 0 && (
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-primary" />
                    تصنيف المستندات ({extractedResult.documentCategories.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {extractedResult.documentCategories.map((doc, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm text-foreground truncate flex-1">{doc.fileName}</span>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {CATEGORY_LABELS[doc.category] || doc.categoryLabel}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] shrink-0 ${
                            doc.relevance === "high" ? "border-emerald-300 text-emerald-600" :
                            doc.relevance === "medium" ? "border-amber-300 text-amber-600" :
                            "border-border text-muted-foreground"
                          }`}
                        >
                          {doc.relevance === "high" ? "عالي" : doc.relevance === "medium" ? "متوسط" : "منخفض"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

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
                      <a
                        key={loc.id}
                        href={loc.googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/40 transition-colors shadow-sm text-sm font-medium text-foreground hover:text-primary"
                      >
                        <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="max-w-[160px] truncate">{loc.name}</span>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Files summary */}
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  المستندات المرفوعة ({uploadedFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="flex items-center gap-2 text-xs">
                      {getFileIcon(file.type)}
                      <span className="text-foreground truncate">{file.name}</span>
                      <span className="text-muted-foreground mr-auto">{formatFileSize(file.size)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Discount Code */}
            <Card>
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      disabled={!clientDiscountCode.trim() || clientCheckingDiscount}
                      onClick={async () => {
                        setClientCheckingDiscount(true);
                        const { data, error } = await supabase
                          .from("discount_codes")
                          .select("*")
                          .eq("code", clientDiscountCode.toUpperCase().trim())
                          .eq("is_active", true)
                          .maybeSingle();
                        if (error || !data) {
                          toast({ title: "كود الخصم غير صالح", variant: "destructive" });
                        } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
                          toast({ title: "كود الخصم منتهي الصلاحية", variant: "destructive" });
                        } else if (data.max_uses && data.current_uses >= data.max_uses) {
                          toast({ title: "تم استنفاد عدد مرات استخدام هذا الكود", variant: "destructive" });
                        } else {
                          setClientDiscountApplied({ code: data.code, percentage: Number(data.discount_percentage) });
                          toast({ title: `تم تطبيق خصم ${data.discount_percentage}%` });
                        }
                        setClientCheckingDiscount(false);
                      }}
                    >
                      {clientCheckingDiscount ? <Loader2 className="w-3 h-3 animate-spin" /> : "تطبيق"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep("upload")} className="gap-2">
                <ArrowRight className="w-4 h-4" />
                رجوع
              </Button>
              <Button onClick={handleSubmitRequest} className="flex-1 gap-2" size="lg"
                disabled={loading || !clientInfo.contactName.trim() || !clientInfo.purpose || !clientInfo.contactPhone.trim() || !clientInfo.intendedUsers.trim()}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                إرسال طلب التقييم
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
