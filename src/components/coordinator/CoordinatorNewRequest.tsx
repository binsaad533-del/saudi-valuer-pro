import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Loader2, Send, UserPlus, Users, Upload, FileText, Image, File, X,
  Brain, CheckCircle, Sparkles,
} from "lucide-react";
import { buildSafeStorageObject } from "@/lib/storage-path";

interface Props {
  clients: any[];
  onCreated: () => void;
}

const PURPOSES = [
  { value: "sale_purchase", label: "بيع / شراء" },
  { value: "mortgage", label: "رهن عقاري" },
  { value: "financing", label: "تمويل" },
  { value: "insurance", label: "تأمين" },
  { value: "legal", label: "قضائي" },
  { value: "zakat_tax", label: "زكاة / ضريبة" },
  { value: "financial_reporting", label: "تقارير مالية" },
  { value: "other", label: "أخرى" },
];

const VALUATION_TYPES = [
  { value: "real_estate", label: "🏠 تقييم عقاري" },
  { value: "machinery", label: "⚙️ آلات ومعدات" },
  { value: "mixed", label: "🏗️ مختلط (عقار + آلات)" },
];

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  storagePath?: string;
}

interface AIResult {
  propertyType?: string;
  propertyCity?: string;
  propertyDistrict?: string;
  propertyDescription?: string;
  landArea?: string;
  buildingArea?: string;
  isPortfolio?: boolean;
  assetCount?: number;
  assets?: any[];
  confidence?: number;
  summary?: string;
}

export default function CoordinatorNewRequest({ clients, onCreated }: Props) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [dragOver, setDragOver] = useState(false);
  const [form, setForm] = useState({ clientId: "", purpose: "", valuationType: "real_estate", notes: "" });
  const [newClient, setNewClient] = useState({ nameAr: "", phone: "", email: "" });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiMessage, setAiMessage] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);

  const update = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }));

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
    setUploading(true);
    const next = Array.from(fileList).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      type: file.type,
      file,
    }));
    setUploadedFiles(prev => [...prev, ...next]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files);
  };

  const runAIAnalysis = async () => {
    if (uploadedFiles.length === 0) {
      toast.error("يرجى رفع ملف واحد على الأقل");
      return;
    }

    setAiProcessing(true);
    setAiProgress(0);
    setAiMessage("جارٍ رفع الملفات...");

    try {
        const storagePaths: { path: string; name: string; mimeType: string }[] = [];

        for (const uf of uploadedFiles) {
          setAiProgress(p => Math.min(p + 10, 30));
          const { storageKey, originalFilename } = buildSafeStorageObject({
            userId: user?.id || "coordinator",
            originalFilename: uf.name,
          });
          const { error: uploadErr } = await supabase.storage
            .from("client-uploads")
            .upload(storageKey, uf.file);
          if (!uploadErr) {
            storagePaths.push({ path: storageKey, name: originalFilename, mimeType: uf.type });
            uf.storagePath = storageKey;
          }
        }

        setAiProgress(40);
        setAiMessage("تحليل المحتوى بالذكاء الاصطناعي...");

        const { data, error } = await supabase.functions.invoke("extract-documents", {
          body: {
            fileNames: uploadedFiles.map(f => f.name),
            fileDescriptions: [],
            storagePaths,
          },
        });

      if (error) throw error;

      setAiProgress(80);
      setAiMessage("استخراج البيانات...");

      const result: AIResult = {
        propertyType: data?.asset?.classification || "",
        propertyCity: data?.asset?.city || "",
        propertyDistrict: data?.asset?.district || "",
        propertyDescription: data?.asset?.description || "",
        landArea: data?.asset?.area || "",
        buildingArea: "",
        isPortfolio: false,
        assetCount: 1,
        confidence: data?.confidence || 75,
        summary: data?.notes?.join(" • ") || "تم تحليل الوثائق بنجاح",
      };

      // Auto-detect valuation type
      if (data?.discipline === "machinery") {
        setForm(prev => ({ ...prev, valuationType: "machinery" }));
      } else if (data?.discipline === "mixed") {
        setForm(prev => ({ ...prev, valuationType: "mixed" }));
      }

      // Auto-detect purpose
      if (data?.suggestedPurpose) {
        const matchedPurpose = PURPOSES.find(p =>
          data.suggestedPurpose.includes(p.label) || p.value === data.suggestedPurpose
        );
        if (matchedPurpose) setForm(prev => ({ ...prev, purpose: matchedPurpose.value }));
      }

      setAiResult(result);
      setAiProgress(100);
      setAiMessage("تم التحليل بنجاح!");
      toast.success("تم تحليل الوثائق واستخراج البيانات بنجاح");
    } catch (err: any) {
      console.error("AI analysis error:", err);
      toast.error(err?.message || "حدث خطأ أثناء التحليل الذكي");
      setAiResult(null);
    } finally {
      setTimeout(() => setAiProcessing(false), 500);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (clientMode === "existing" && !form.clientId) {
      toast.error("يرجى اختيار عميل من القائمة");
      return;
    }
    if (clientMode === "new" && !newClient.nameAr.trim()) {
      toast.error("يرجى إدخال اسم العميل الجديد");
      return;
    }
    if (!form.purpose) {
      toast.error("يرجى تحديد الغرض من التقييم");
      return;
    }

    setSaving(true);
    try {
      let clientId = form.clientId;

      // Create new client if needed
      if (clientMode === "new") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("user_id", user!.id)
          .single();

        if (!profile?.organization_id) throw new Error("لم يتم العثور على المنظمة");

        const { data: newClientData, error: clientError } = await supabase
          .from("clients")
          .insert({
            name_ar: newClient.nameAr.trim(),
            phone: newClient.phone.trim() || null,
            email: newClient.email.trim() || null,
            organization_id: profile.organization_id,
            created_by: user!.id,
          })
          .select("id")
          .single();

        if (clientError) throw clientError;
        clientId = newClientData.id;
      }

      // Build request data - let AI fill the details
      const { error } = await supabase.from("valuation_requests" as any).insert({
        client_id: clientId,
        valuation_type: form.valuationType as any,
        purpose: form.purpose,
        property_type: aiResult?.propertyType || null,
        property_city_ar: aiResult?.propertyCity || null,
        property_district_ar: aiResult?.propertyDistrict || null,
        property_description_ar: aiResult?.propertyDescription || null,
        land_area: aiResult?.landArea ? parseFloat(aiResult.landArea) : null,
        building_area: aiResult?.buildingArea ? parseFloat(aiResult.buildingArea) : null,
        is_portfolio: aiResult?.isPortfolio || false,
        portfolio_asset_count: aiResult?.assetCount || 0,
        notes: form.notes || null,
        status: "submitted",
        created_by: user?.id,
        submitted_by_coordinator: true,
        ai_intake_summary: aiResult ? { aiResult, files: uploadedFiles.map(f => ({ name: f.name, type: f.type })) } : null,
      } as any);

      if (error) throw error;

      toast.success("تم إنشاء الطلب بنجاح — الذكاء الاصطناعي سيكمل تحليل البيانات");

      // Reset form
      setForm({ clientId: "", purpose: "", valuationType: "real_estate", notes: "" });
      setNewClient({ nameAr: "", phone: "", email: "" });
      setUploadedFiles([]);
      setAiResult(null);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ أثناء إنشاء الطلب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" />
          إدخال طلب تقييم نيابةً عن العميل
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          أدخل المعلومات الأساسية وارفع الوثائق — الذكاء الاصطناعي يستخرج باقي التفاصيل
        </p>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* 1. Client Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">العميل *</Label>
          <Tabs value={clientMode} onValueChange={v => setClientMode(v as "existing" | "new")} dir="rtl">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="existing" className="text-xs gap-1.5">
                <Users className="w-3.5 h-3.5" />
                عميل موجود
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs gap-1.5">
                <UserPlus className="w-3.5 h-3.5" />
                عميل جديد
              </TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="mt-3">
              <Select value={form.clientId} onValueChange={v => update("clientId", v)}>
                <SelectTrigger><SelectValue placeholder="اختر العميل من القائمة" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name_ar} {c.phone ? `— ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>

            <TabsContent value="new" className="mt-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 rounded-lg border border-dashed border-primary/30 bg-primary/5">
                <div className="space-y-1">
                  <Label className="text-xs">اسم العميل *</Label>
                  <Input
                    placeholder="الاسم الكامل"
                    value={newClient.nameAr}
                    onChange={e => setNewClient(p => ({ ...p, nameAr: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رقم الجوال</Label>
                  <Input
                    placeholder="05xxxxxxxx"
                    value={newClient.phone}
                    onChange={e => setNewClient(p => ({ ...p, phone: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newClient.email}
                    onChange={e => setNewClient(p => ({ ...p, email: e.target.value }))}
                    dir="ltr"
                    className="text-left"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* 2. Essential Fields Only */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">نوع التقييم *</Label>
            <Select value={form.valuationType} onValueChange={v => update("valuationType", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VALUATION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">الغرض من التقييم *</Label>
            <Select value={form.purpose} onValueChange={v => update("purpose", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
              <SelectContent>
                {PURPOSES.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 3. File Upload */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Upload className="w-4 h-4" />
            الوثائق والمستندات
          </Label>

          <div
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.tif,.tiff"
              onChange={e => e.target.files && handleFileUpload(e.target.files)}
            />
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              اسحب الملفات هنا أو <span className="text-primary font-medium">اضغط للاختيار</span>
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              صكوك، رخص بناء، مخططات، صور العقار، فواتير الآلات، أو أي وثائق ذات صلة
            </p>
          </div>

          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              جارٍ الرفع...
            </div>
          )}

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5">
              {uploadedFiles.map(f => (
                <div key={f.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg text-xs">
                  {getFileIcon(f.type)}
                  <span className="flex-1 truncate">{f.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(f.size)}</span>
                  <button onClick={() => removeFile(f.id)} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">{uploadedFiles.length} ملف مرفوع</p>
            </div>
          )}
        </div>

        {/* 4. AI Analysis */}
        {uploadedFiles.length > 0 && !aiResult && (
          <Button
            onClick={runAIAnalysis}
            disabled={aiProcessing}
            variant="outline"
            className="w-full border-primary/30 text-primary hover:bg-primary/5"
          >
            {aiProcessing ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                {aiMessage}
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 ml-2" />
                تحليل الوثائق بالذكاء الاصطناعي
              </>
            )}
          </Button>
        )}

        {aiProcessing && (
          <Progress value={aiProgress} className="h-1.5" />
        )}

        {/* AI Results */}
        {aiResult && (
          <div className="p-3 rounded-lg border border-success/30 bg-success/5 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-success" />
              <span className="text-sm font-medium text-success">تم استخراج البيانات</span>
              {aiResult.confidence && (
                <Badge variant="outline" className="text-[10px] h-5 border-success/30 text-success">
                  ثقة {aiResult.confidence}%
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{aiResult.summary}</p>
            {(aiResult.propertyCity || aiResult.propertyDescription) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {aiResult.propertyCity && (
                  <div><span className="text-muted-foreground">المدينة:</span> {aiResult.propertyCity}</div>
                )}
                {aiResult.propertyDistrict && (
                  <div><span className="text-muted-foreground">الحي:</span> {aiResult.propertyDistrict}</div>
                )}
                {aiResult.propertyType && (
                  <div><span className="text-muted-foreground">النوع:</span> {aiResult.propertyType}</div>
                )}
                {aiResult.landArea && (
                  <div><span className="text-muted-foreground">المساحة:</span> {aiResult.landArea} م²</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. Notes */}
        <div className="space-y-1.5">
          <Label className="text-sm">ملاحظات المنسق (اختياري)</Label>
          <Textarea
            placeholder="أي ملاحظات إضافية للفريق..."
            value={form.notes}
            onChange={e => update("notes", e.target.value)}
            rows={2}
          />
        </div>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={saving} className="w-full md:w-auto">
          {saving ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Send className="w-4 h-4 ml-2" />}
          إرسال الطلب
        </Button>
      </CardContent>
    </Card>
  );
}
