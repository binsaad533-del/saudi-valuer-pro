import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
  ArrowLeft,
  Sparkles,
  User as UserIcon,
  Phone,
  Mail,
  FileCheck,
  Brain,
  Target,
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

interface AIExtractedData {
  valuationType: string;
  propertyType: string;
  purpose: string;
  propertyDescription: string;
  propertyCity: string;
  propertyDistrict: string;
  propertyAddress: string;
  landArea: string;
  buildingArea: string;
  intendedUse: string;
  intendedUsers: string;
  assetCount: number;
  isPortfolio: boolean;
  assets: any[];
  confidence: number;
  summary: string;
}

type Step = "upload" | "processing" | "extracted" | "submitted";

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
  const [extractedData, setExtractedData] = useState<AIExtractedData | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState("");

  // Report client info (not the logged-in user)
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

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // No pre-fill - client info is for the report client, not the logged-in user
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

  // AI Processing
  const processWithAI = async () => {
    if (uploadedFiles.length === 0) {
      toast({ title: "يرجى رفع الوثائق أولاً", variant: "destructive" });
      return;
    }

    setStep("processing");
    setProcessingProgress(0);
    setProcessingMessage("جارٍ تحليل الوثائق المرفوعة...");

    try {
      // Simulate progress stages
      const progressSteps = [
        { pct: 15, msg: "قراءة الملفات والتعرف على المحتوى..." },
        { pct: 35, msg: "استخراج بيانات العقار والأصول..." },
        { pct: 55, msg: "تحديد نوع التقييم والغرض..." },
        { pct: 75, msg: "تصنيف الوثائق وترتيبها..." },
        { pct: 90, msg: "إعداد ملخص الطلب..." },
      ];

      for (const ps of progressSteps) {
        setProcessingProgress(ps.pct);
        setProcessingMessage(ps.msg);
        await new Promise(r => setTimeout(r, 600));
      }

      // Call AI extraction
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-intake`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: `قم بتحليل الوثائق التالية واستخرج جميع بيانات طلب التقييم منها.
الملفات المرفوعة: ${uploadedFiles.map(f => f.name).join(", ")}

أريد منك استخراج البيانات التالية بصيغة JSON فقط بدون أي نص إضافي:
{
  "valuationType": "real_estate|machinery|mixed",
  "propertyType": "residential|commercial|land|industrial|mixed_use|agricultural|hospitality",
  "purpose": "sale_purchase|mortgage|financial_reporting|insurance|taxation|litigation|investment|other",
  "propertyDescription": "وصف تفصيلي",
  "propertyCity": "المدينة",
  "propertyDistrict": "الحي",
  "propertyAddress": "العنوان الكامل",
  "landArea": "المساحة بالأرقام فقط",
  "buildingArea": "المساحة بالأرقام فقط",
  "intendedUse": "الاستخدام المقصود",
  "intendedUsers": "المستخدمون المقصودون",
  "assetCount": 1,
  "isPortfolio": false,
  "assets": [],
  "confidence": 0.85,
  "summary": "ملخص شامل لطلب التقييم"
}

إذا لم تستطع تحديد أي حقل، اتركه فارغاً. لا تكتب أي شيء خارج JSON.`,
              },
            ],
            systemPrompt: `أنت محرك استخراج بيانات لشركة تقييم عقاري في السعودية. 
حلل الوثائق المرفوعة واستخرج جميع المعلومات المطلوبة.
أجب بصيغة JSON فقط بدون أي نص إضافي أو markdown.
إذا كانت الوثائق تحتوي على عدة أصول، اضبط isPortfolio=true واملأ مصفوفة assets.
كل أصل في المصفوفة يحتوي: asset_name_ar, asset_type, asset_category, city_ar, description_ar.`,
            valuationType: "real_estate",
            formData: {},
            files: uploadedFiles.map(f => ({ name: f.name, type: f.type })),
          }),
        }
      );

      if (!resp.ok || !resp.body) throw new Error("فشل التحليل الذكي");

      // Read the streaming response
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ") || line.trim() === "") continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) fullContent += content;
          } catch { /* partial chunk */ }
        }
      }

      // Parse AI response
      let extracted: AIExtractedData;
      try {
        // Try to find JSON in the response
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extracted = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("لم يتم العثور على بيانات");
        }
      } catch {
        // Fallback with defaults
        extracted = {
          valuationType: "real_estate",
          propertyType: "",
          purpose: "",
          propertyDescription: "",
          propertyCity: "",
          propertyDistrict: "",
          propertyAddress: "",
          landArea: "",
          buildingArea: "",
          intendedUse: "",
          intendedUsers: "",
          assetCount: 1,
          isPortfolio: false,
          assets: [],
          confidence: 0.5,
          summary: "تم رفع الوثائق بنجاح. يرجى مراجعة البيانات المستخرجة.",
        };
      }

      setExtractedData(extracted);
      setProcessingProgress(100);
      setProcessingMessage("تم الاستخراج بنجاح!");

      await new Promise(r => setTimeout(r, 500));
      setStep("extracted");
    } catch (err: any) {
      toast({ title: "خطأ في التحليل", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleSubmitRequest = async () => {
    if (!user || !extractedData) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("valuation_requests" as any)
        .insert({
          client_user_id: user.id,
          valuation_type: (extractedData.valuationType || "real_estate") as any,
          property_type: (extractedData.propertyType || null) as any,
          property_description_ar: extractedData.propertyDescription || null,
          property_address_ar: extractedData.propertyAddress || null,
          property_city_ar: extractedData.propertyCity || null,
          property_district_ar: extractedData.propertyDistrict || null,
          land_area: extractedData.landArea ? parseFloat(extractedData.landArea) : null,
          building_area: extractedData.buildingArea ? parseFloat(extractedData.buildingArea) : null,
          purpose: (clientInfo.purpose || extractedData.purpose || null) as any,
          intended_use_ar: extractedData.intendedUse || null,
          intended_users_ar: extractedData.intendedUsers || null,
          status: "submitted" as any,
          submitted_at: new Date().toISOString(),
          is_portfolio: extractedData.isPortfolio || false,
          portfolio_asset_count: extractedData.isPortfolio ? extractedData.assets?.length || 0 : 0,
          ai_intake_summary: {
            extractedData,
            files: uploadedFiles,
            clientInfo,
          },
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Save portfolio assets
      if (extractedData.isPortfolio && extractedData.assets?.length > 0 && data) {
        const reqData = data as any;
        const assets = extractedData.assets.map((a: any, i: number) => ({
          request_id: reqData.id,
          asset_type: a.asset_type || "real_estate",
          asset_category: a.asset_category || "other",
          asset_name_ar: a.asset_name_ar || `أصل ${i + 1}`,
          city_ar: a.city_ar || null,
          description_ar: a.description_ar || null,
          ai_extracted: true,
          ai_confidence: extractedData.confidence || 0.85,
          sort_order: i,
        }));
        await supabase.from("portfolio_assets" as any).insert(assets);
      }

      // Save documents
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

  const VALUATION_TYPE_LABELS: Record<string, string> = {
    real_estate: "🏠 تقييم عقاري",
    machinery: "⚙️ تقييم آلات ومعدات",
    mixed: "🏗️ تقييم مختلط",
  };

  const PROPERTY_TYPE_LABELS: Record<string, string> = {
    residential: "سكني", commercial: "تجاري", land: "أرض",
    industrial: "صناعي", mixed_use: "متعدد الاستخدام",
    agricultural: "زراعي", hospitality: "فندقي",
  };

  const PURPOSE_LABELS: Record<string, string> = {
    sale_purchase: "بيع / شراء", mortgage: "رهن عقاري",
    financial_reporting: "تقارير مالية", insurance: "تأمين",
    taxation: "ضريبي", litigation: "قضائي",
    investment: "استثمار", other: "أخرى",
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
                        <SelectItem value="sale_purchase">بيع / شراء</SelectItem>
                        <SelectItem value="mortgage">رهن عقاري</SelectItem>
                        <SelectItem value="financial_reporting">تقارير مالية</SelectItem>
                        <SelectItem value="insurance">تأمين</SelectItem>
                        <SelectItem value="taxation">ضريبي</SelectItem>
                        <SelectItem value="litigation">قضائي</SelectItem>
                        <SelectItem value="investment">استثمار</SelectItem>
                        <SelectItem value="zakat">زكاة</SelectItem>
                        <SelectItem value="expropriation">نزع ملكية</SelectItem>
                        <SelectItem value="other">أخرى</SelectItem>
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
                  ارفع صكوك الملكية، المخططات، التقارير، الصور، أو أي مستندات ذات صلة.
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
                    PDF, صور, Word, Excel
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
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt,.tif,.tiff"
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

            {/* Next button */}
            <Button
              onClick={processWithAI}
              className="w-full gap-2"
              size="lg"
              disabled={uploadedFiles.length === 0 || uploading || !clientInfo.contactName.trim() || !clientInfo.purpose || !clientInfo.clientType || !clientInfo.contactPhone.trim() || !clientInfo.intendedUsers.trim()}
            >
              <Sparkles className="w-4 h-4" />
              تحليل الوثائق والمتابعة
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
              <h3 className="text-lg font-bold text-foreground mb-2">جارٍ التحليل الذكي</h3>
              <p className="text-sm text-muted-foreground mb-6">{processingMessage}</p>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all duration-500"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
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
        {step === "extracted" && extractedData && (
          <div className="space-y-4">
            <Card className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileCheck className="w-5 h-5 text-primary" />
                    البيانات المستخرجة
                  </CardTitle>
                  {extractedData.confidence > 0 && (
                    <Badge variant={extractedData.confidence > 0.7 ? "default" : "secondary"} className="text-xs">
                      دقة {Math.round(extractedData.confidence * 100)}%
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  تم استخراج البيانات التالية من وثائقك. راجعها ثم انتقل للخطوة التالية.
                </p>
              </CardHeader>
              <CardContent>
                {extractedData.summary && (
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                    <div className="flex items-start gap-2">
                      <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-foreground">{extractedData.summary}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {extractedData.valuationType && (
                    <InfoItem label="نوع التقييم" value={VALUATION_TYPE_LABELS[extractedData.valuationType] || extractedData.valuationType} />
                  )}
                  {extractedData.propertyType && (
                    <InfoItem label="نوع العقار" value={PROPERTY_TYPE_LABELS[extractedData.propertyType] || extractedData.propertyType} />
                  )}
                  {extractedData.purpose && (
                    <InfoItem label="الغرض" value={PURPOSE_LABELS[extractedData.purpose] || extractedData.purpose} />
                  )}
                  {extractedData.propertyCity && (
                    <InfoItem label="المدينة" value={extractedData.propertyCity} />
                  )}
                  {extractedData.propertyDistrict && (
                    <InfoItem label="الحي" value={extractedData.propertyDistrict} />
                  )}
                  {extractedData.propertyAddress && (
                    <InfoItem label="العنوان" value={extractedData.propertyAddress} />
                  )}
                  {extractedData.landArea && (
                    <InfoItem label="مساحة الأرض" value={`${extractedData.landArea} م²`} />
                  )}
                  {extractedData.buildingArea && (
                    <InfoItem label="مساحة البناء" value={`${extractedData.buildingArea} م²`} />
                  )}
                </div>

                {extractedData.propertyDescription && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">وصف العقار</p>
                    <p className="text-sm text-foreground">{extractedData.propertyDescription}</p>
                  </div>
                )}

                {extractedData.isPortfolio && extractedData.assets?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">
                      أصول المحفظة ({extractedData.assets.length})
                    </p>
                    <div className="space-y-2">
                      {extractedData.assets.map((asset: any, i: number) => (
                        <div key={i} className="p-3 rounded-lg border border-border bg-card">
                          <p className="text-sm font-medium text-foreground">{asset.asset_name_ar || `أصل ${i + 1}`}</p>
                          <p className="text-xs text-muted-foreground">
                            {asset.city_ar && `${asset.city_ar} • `}
                            {asset.asset_type === "machinery" ? "آلات ومعدات" : "عقار"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg bg-muted/50">
      <p className="text-[11px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
