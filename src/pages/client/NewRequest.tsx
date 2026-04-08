import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import ProcessingStatusTracker from "@/components/client/ProcessingStatusTracker";
import AssetReviewWorkspace from "@/components/client/AssetReviewWorkspace";
import { buildSafeStorageObject, getUploadErrorMessage } from "@/lib/storage-path";
import { Upload, CheckCircle, ArrowRight, Brain, FileCheck } from "lucide-react";
import logo from "@/assets/logo.png";
import { DiscountCodeSection } from "@/components/client/request/DiscountCodeSection";
import { LocationsSummary } from "@/components/client/request/LocationsSummary";
import NewRequestUploadStep, { INTENDED_USERS_OPTIONS, type UploadedFile, type ClientInfo } from "@/components/client/request/NewRequestUploadStep";
import type { AssetLocation } from "@/components/client/AssetLocationPicker";

type Step = "upload" | "processing" | "review" | "submitted";

export default function NewRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<any>(null);
  const [step, setStep] = useState<Step>("upload");
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    contactName: "", contactPhone: "", contactEmail: "", idNumber: "",
    clientType: "", additionalNotes: "", purpose: "", purposeOther: "",
    intendedUsers: "", intendedUsersOther: "",
  });

  const [clientDiscountCode, setClientDiscountCode] = useState("");
  const [clientDiscountApplied, setClientDiscountApplied] = useState<{ code: string; percentage: number } | null>(null);
  const [clientCheckingDiscount, setClientCheckingDiscount] = useState(false);
  const [assetLocations, setAssetLocations] = useState<AssetLocation[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }
      setUser(user);
    };
    checkAuth();
  }, [navigate]);

  const handleFileUpload = async (fileList: FileList) => {
    if (!user) { toast({ title: "يجب تسجيل الدخول أولاً", variant: "destructive" }); return; }
    setUploading(true);
    const newFiles: UploadedFile[] = [];
    try {
      for (const file of Array.from(fileList)) {
        const { storageKey, originalFilename } = buildSafeStorageObject({ userId: user.id, originalFilename: file.name });
        const { error } = await supabase.storage.from("client-uploads").upload(storageKey, file);
        if (error) { toast({ title: `تعذر رفع الملف ${originalFilename}`, description: getUploadErrorMessage(error), variant: "destructive" }); continue; }
        newFiles.push({ id: crypto.randomUUID(), name: originalFilename, size: file.size, type: file.type, path: storageKey });
      }
      setUploadedFiles(prev => [...prev, ...newFiles]);
    } finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) handleFileUpload(e.target.files); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length > 0) handleFileUpload(e.dataTransfer.files); };
  const removeFile = (id: string) => setUploadedFiles(prev => prev.filter(f => f.id !== id));

  const startProcessing = async () => {
    if (!clientInfo.purpose) { toast({ title: "يرجى اختيار الغرض من التقييم", variant: "destructive" }); return; }
    if (clientInfo.purpose === "other" && !clientInfo.purposeOther.trim()) { toast({ title: "يرجى تحديد الغرض من التقييم", variant: "destructive" }); return; }
    if (!clientInfo.intendedUsers) { toast({ title: "يرجى اختيار مستخدم التقرير", variant: "destructive" }); return; }
    if (clientInfo.intendedUsers === "other" && !clientInfo.intendedUsersOther.trim()) { toast({ title: "يرجى تحديد مستخدم التقرير", variant: "destructive" }); return; }
    if (uploadedFiles.length === 0) { toast({ title: "يرجى رفع الوثائق أولاً", variant: "destructive" }); return; }
    if (!user) return;

    setStep("processing");
    try {
      const { data, error } = await supabase.functions.invoke("asset-extraction-orchestrator", {
        body: { action: "create", userId: user.id, files: uploadedFiles.map(f => ({ name: f.name, path: f.path, size: f.size, mimeType: f.type })) },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setJobId(data.jobId);
    } catch (err: any) {
      toast({ title: "خطأ في بدء المعالجة", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const handleProcessingReady = useCallback((readyJobId: string) => { setJobId(readyJobId); setStep("review"); }, []);
  const handleProcessingCancel = useCallback(() => { setStep("upload"); setJobId(null); }, []);

  const handleSubmitFromReview = async (assets: any[], discipline: string, description: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const assetData = {
        discipline,
        inventory: assets.filter(a => a.review_status !== "rejected").map(a => ({
          id: a.asset_index, name: a.name, type: a.asset_type, category: a.category,
          subcategory: a.subcategory, quantity: a.quantity, condition: a.condition,
          fields: a.asset_data?.fields || [], source: a.source_evidence, confidence: a.confidence,
        })),
        summary: { total: assets.filter(a => a.review_status !== "rejected").length, by_type: {
          real_estate: assets.filter(a => a.asset_type === "real_estate" && a.review_status !== "rejected").length,
          machinery_equipment: assets.filter(a => a.asset_type === "machinery_equipment" && a.review_status !== "rejected").length,
        }},
        description, jobId,
      };

      const { data, error } = await supabase.from("valuation_requests" as any).insert({
        client_user_id: user.id, valuation_type: (discipline || "real_estate") as any,
        property_description_ar: description || null, purpose: (clientInfo.purpose || null) as any,
        purpose_other: clientInfo.purpose === "other" ? clientInfo.purposeOther : null,
        intended_users_ar: clientInfo.intendedUsers === "other" ? clientInfo.intendedUsersOther : (INTENDED_USERS_OPTIONS[clientInfo.intendedUsers] || clientInfo.intendedUsers || null),
        status: "submitted" as any, submitted_at: new Date().toISOString(),
        ai_intake_summary: { jobId, files: uploadedFiles, clientInfo, assetLocations, totalAssets: assetData.inventory.length },
        asset_data: assetData,
      } as any).select().single();

      if (error) throw error;

      if (jobId && data) await supabase.from("processing_jobs").update({ request_id: (data as any).id }).eq("id", jobId);
      if (uploadedFiles.length > 0 && data) {
        const docs = uploadedFiles.map(f => ({ request_id: (data as any).id, uploaded_by: user.id, file_name: f.name, file_path: f.path, file_size: f.size, mime_type: f.type }));
        await supabase.from("request_documents" as any).insert(docs);
      }

      setRequestId((data as any)?.id || null);
      setStep("submitted");
      toast({ title: "تم إرسال طلب التقييم بنجاح" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleApplyDiscount = async () => {
    if (!clientDiscountCode.trim()) return;
    setClientCheckingDiscount(true);
    try {
      const { data, error } = await supabase.from("discount_codes").select("*").eq("code", clientDiscountCode.trim().toUpperCase()).eq("is_active", true).maybeSingle();
      if (error || !data) toast({ title: "كود غير صالح", variant: "destructive" });
      else { setClientDiscountApplied({ code: data.code, percentage: data.discount_percentage }); toast({ title: `تم تطبيق خصم ${data.discount_percentage}%` }); }
    } catch {}
    setClientCheckingDiscount(false);
  };

  const steps = [
    { key: "upload", label: "البيانات والوثائق", icon: Upload },
    { key: "processing", label: "تحليل ذكي", icon: Brain },
    { key: "review", label: "مراجعة الأصول", icon: FileCheck },
  ];
  const currentStepIndex = step === "submitted" ? steps.length : steps.findIndex(s => s.key === step);

  if (step === "submitted") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-card">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إرسال طلبك بنجاح</h2>
            <p className="text-sm text-muted-foreground mb-6">سيقوم فريقنا بمراجعة طلبك وإرسال عرض السعر ونطاق العمل في أقرب وقت.</p>
            <div className="space-y-2">
              <Button onClick={() => navigate("/client")} className="w-full">العودة للوحة التحكم</Button>
              {requestId && <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full">عرض تفاصيل الطلب</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3"><img src={logo} alt="جساس" className="w-8 h-8" /><h2 className="text-sm font-bold text-foreground">طلب تقييم جديد</h2></div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/client")}><ArrowRight className="w-4 h-4 ml-1" /> العودة</Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-6 pb-2">
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStepIndex;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isDone ? "bg-success text-success-foreground" : isActive ? "gradient-primary text-primary-foreground shadow-blue" : "bg-muted text-muted-foreground"}`}>
                    {isDone ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-[11px] font-medium ${isActive ? "text-primary" : isDone ? "text-success" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-3 mt-[-18px] rounded ${isDone ? "bg-success" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-8">
        {step === "upload" && (
          <NewRequestUploadStep
            clientInfo={clientInfo} onClientInfoChange={setClientInfo}
            uploadedFiles={uploadedFiles} uploading={uploading} dragOver={dragOver}
            onDragOver={() => setDragOver(true)} onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop} onFileSelect={() => fileInputRef.current?.click()}
            onRemoveFile={removeFile} fileInputRef={fileInputRef as any} onInputChange={handleInputChange}
            assetLocations={assetLocations} onLocationsChange={setAssetLocations}
            onStartProcessing={startProcessing}
          />
        )}

        {step === "processing" && <ProcessingStatusTracker jobId={jobId} onReady={handleProcessingReady} onCancel={handleProcessingCancel} />}

        {step === "review" && jobId && (
          <div className="space-y-4">
            <DiscountCodeSection code={clientDiscountCode} onCodeChange={setClientDiscountCode} applied={clientDiscountApplied} onApply={handleApplyDiscount} onClear={() => { setClientDiscountApplied(null); setClientDiscountCode(""); }} checking={clientCheckingDiscount} />
            <LocationsSummary locations={assetLocations} />
            <AssetReviewWorkspace jobId={jobId} onSubmit={handleSubmitFromReview} onBack={() => setStep("upload")} />
          </div>
        )}
      </div>
    </div>
  );
}
