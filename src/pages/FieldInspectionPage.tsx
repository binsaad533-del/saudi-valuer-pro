import { useState, useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck, Home, LayoutGrid, Cog, Bolt, Shield, Activity, HardDrive, Settings,
} from "lucide-react";
import type { SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  SectionGeneral, SectionLocation, SectionVerification, SectionDimensions,
  SectionExterior, SectionInterior, SectionCondition, SectionUtilities,
  SectionLayoutAreas, SectionValueFactors,
  SectionNotesRecommendations, SectionDocumentation, SectionRisks, SectionFinalCheck, SectionApproval,
} from "@/components/inspection/sections";
import { defaultFormData, PHOTO_CATEGORIES, DEFAULT_CHECKLIST } from "@/components/inspection/sections/types";
import type { FormData, PhotoItem, ChecklistItem } from "@/components/inspection/sections/types";
import MachineryGeneral from "@/components/inspection/sections/MachineryGeneral";
import MachineryMechanical from "@/components/inspection/sections/MachineryMechanical";
import MachineryElectrical from "@/components/inspection/sections/MachineryElectrical";
import MachineryStructural from "@/components/inspection/sections/MachineryStructural";
import MachineryOperation from "@/components/inspection/sections/MachineryOperation";
import MachinerySafety from "@/components/inspection/sections/MachinerySafety";
import MachineryMaintenance from "@/components/inspection/sections/MachineryMaintenance";

type Discipline = "real_estate" | "machinery_equipment" | "mixed";

const RE_STEPS = [
  { key: "general", label: "معلومات عامة", icon: Info, num: 1 },
  { key: "location", label: "بيانات الموقع", icon: MapPin, num: 2 },
  { key: "verification", label: "التحقق من الأصل", icon: Building2, num: 3 },
  { key: "dimensions", label: "المساحات", icon: Ruler, num: 4 },
  { key: "exterior", label: "المبنى - الخارج", icon: Home, num: 5 },
  { key: "interior", label: "المبنى - الداخل", icon: Building2, num: 6 },
  { key: "condition", label: "حالة الأصل", icon: Wrench, num: 7 },
  { key: "utilities", label: "المرافق", icon: Zap, num: 8 },
  { key: "layout_areas", label: "المخطط والمساحات", icon: LayoutGrid, num: 9 },
  { key: "value_factors", label: "العوامل المؤثرة", icon: TrendingUp, num: 10 },
  { key: "notes_recommendations", label: "ملاحظات وتوصيات", icon: ClipboardCheck, num: 11 },
  { key: "documentation", label: "التوثيق", icon: Camera, num: 12 },
  { key: "risks", label: "المخاطر", icon: ShieldAlert, num: 13 },
  { key: "final_check", label: "التحقق النهائي", icon: FileCheck, num: 14 },
  { key: "approval", label: "الاعتماد", icon: UserCheck, num: 15 },
];

const ME_STEPS = [
  { key: "me_general", label: "معلومات الأصل", icon: Cog, num: 1 },
  { key: "me_location", label: "بيانات الموقع", icon: MapPin, num: 2 },
  { key: "me_verification", label: "التحقق من الهوية", icon: Building2, num: 3 },
  { key: "me_mechanical", label: "الحالة الميكانيكية", icon: Settings, num: 4 },
  { key: "me_electrical", label: "الحالة الكهربائية", icon: Bolt, num: 5 },
  { key: "me_structural", label: "الحالة الهيكلية", icon: HardDrive, num: 6 },
  { key: "me_operation", label: "التشغيل والأداء", icon: Activity, num: 7 },
  { key: "me_safety", label: "السلامة والمعايير", icon: Shield, num: 8 },
  { key: "me_maintenance", label: "سجل الصيانة", icon: Wrench, num: 9 },
  { key: "me_documentation", label: "التوثيق الفوتوغرافي", icon: Camera, num: 10 },
  { key: "me_notes", label: "ملاحظات وتوصيات", icon: ClipboardCheck, num: 11 },
  { key: "me_risks", label: "المخاطر", icon: ShieldAlert, num: 12 },
  { key: "me_approval", label: "الفحص والاعتماد", icon: UserCheck, num: 13 },
];

export default function FieldInspectionPage() {
  const [searchParams] = useSearchParams();
  const disciplineParam = (searchParams.get("discipline") || "real_estate") as Discipline;
  const [discipline, setDiscipline] = useState<Discipline>(disciplineParam);
  const [mixedTab, setMixedTab] = useState<"real_estate" | "machinery">("real_estate");

  const activeSteps = discipline === "machinery_equipment" ? ME_STEPS
    : discipline === "mixed" ? (mixedTab === "real_estate" ? RE_STEPS : ME_STEPS)
    : RE_STEPS;

  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [meFormData, setMeFormData] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [sectionPhotos, setSectionPhotos] = useState<SectionPhoto[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST.map(c => ({ ...c, is_checked: false }))
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const addSectionPhoto = (photo: SectionPhoto) => setSectionPhotos(prev => [...prev, photo]);
  const removeSectionPhoto = (photo: SectionPhoto) => setSectionPhotos(prev => prev.filter(p => p !== photo));

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const updateMeField = (key: string, value: any) => {
    setMeFormData(prev => ({ ...prev, [key]: value }));
  };

  // Reset step when switching tabs in mixed mode
  useEffect(() => { setStep(0); }, [mixedTab]);

  const autoSave = useCallback(() => {
    try {
      localStorage.setItem("field-inspection-data", JSON.stringify({ formData, meFormData, step, discipline, photos: photos.map(p => ({ category: p.category, file_name: p.file_name })) }));
    } catch { /* ignore */ }
  }, [formData, meFormData, step, discipline, photos]);

  useEffect(() => { const t = setTimeout(autoSave, 3000); return () => clearTimeout(t); }, [autoSave]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("field-inspection-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData(prev => ({ ...prev, ...parsed.formData }));
        if (parsed.meFormData) setMeFormData(parsed.meFormData);
        if (typeof parsed.step === "number") setStep(parsed.step);
        if (parsed.discipline) setDiscipline(parsed.discipline);
      }
    } catch { /* ignore */ }
  }, []);

  const captureGPS = () => {
    setGpsLoading(true); setGpsError(null);
    if (!navigator.geolocation) { setGpsError("GPS غير متوفر"); setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormData(prev => ({ ...prev, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude })); setGpsLoading(false); toast.success("تم تحديد الموقع"); },
      () => { setGpsError("تعذر تحديد الموقع"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handlePhotoCapture = (category: string, files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      setPhotos(prev => [...prev, { category, file_name: file.name, preview: URL.createObjectURL(file), description: "" }]);
    }
    toast.success("تم إضافة الصور");
  };

  const removePhoto = (photo: PhotoItem) => setPhotos(prev => prev.filter(p => p !== photo));
  const updatePhotoDescription = (photo: PhotoItem, description: string) => setPhotos(prev => prev.map(p => p === photo ? { ...p, description } : p));

  const suggestCategoryFromDescription = (desc: string): string | null => {
    const d = desc.toLowerCase();
    const keywords: Record<string, string[]> = {
      exterior_front: ["واجهة أمام", "المدخل", "front"], exterior_back: ["واجهة خلف", "back"],
      street_view: ["شارع", "street"], interior_living: ["صالة", "مجلس"],
      interior_kitchen: ["مطبخ"], interior_bathroom: ["حمام"], interior_bedroom: ["غرفة نوم"],
      deed_photo: ["صك", "وثيقة"], problem_cracks: ["تشقق", "شرخ"], problem_moisture: ["رطوبة", "تسرب"],
    };
    for (const [cat, words] of Object.entries(keywords)) {
      if (words.some(w => d.includes(w))) return cat;
    }
    return null;
  };

  const handlePhotoDescriptionChange = (photo: PhotoItem, description: string) => {
    updatePhotoDescription(photo, description);
    const suggested = suggestCategoryFromDescription(description);
    if (suggested && suggested !== photo.category) {
      setPhotos(prev => prev.map(p => p === photo ? { ...p, description, category: suggested } : p));
      const catLabel = PHOTO_CATEGORIES.find(c => c.key === suggested)?.label || suggested;
      toast.info(`📂 تم نقل الصورة تلقائياً إلى: ${catLabel}`);
    }
  };

  const requiredPhotoDone = PHOTO_CATEGORIES.filter(c => c.required).filter(c => photos.some(p => p.category === c.key)).length;
  const requiredPhotoTotal = PHOTO_CATEGORIES.filter(c => c.required).length;
  const checkedRequired = checklist.filter(c => c.is_required && c.is_checked).length;
  const totalRequired = checklist.filter(c => c.is_required).length;

  const overallProgress = Math.round((step / (activeSteps.length - 1)) * 100);

  const canSubmit = () => {
    const hasGPS = !!(formData.gps_lat && formData.gps_lng);
    if (discipline === "machinery_equipment") return hasGPS && !!meFormData.machine_name;
    return hasGPS && !!formData.overall_condition && !!formData.asset_description;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      const inspectorId = user?.id;
      if (!inspectorId) { toast.error("يجب تسجيل الدخول أولاً"); setSubmitting(false); return; }

      const assignmentId = formData.assignment_ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.assignment_ref) ? formData.assignment_ref : null;
      if (!assignmentId) { toast.error("يجب ربط المعاينة بمهمة تقييم."); setSubmitting(false); return; }

      const findingsSummary = discipline === "machinery_equipment"
        ? [`الآلة: ${meFormData.machine_name || ""}`, `الحالة: ${meFormData.operational_status || ""}`, `الشركة: ${meFormData.manufacturer || ""}`].filter(Boolean).join("\n")
        : [`الحالة: ${formData.overall_condition}`, `النوع: ${formData.asset_type}`, `العمر: ${formData.exterior_building_age} سنة`].filter(Boolean).join("\n");

      const { data: inspection, error: inspError } = await supabase
        .from("inspections")
        .insert({
          inspector_id: inspectorId,
          assignment_id: assignmentId,
          inspection_date: formData.approval_date || new Date().toISOString().split("T")[0],
          status: "submitted",
          completed: true,
          latitude: formData.gps_lat ?? null,
          longitude: formData.gps_lng ?? null,
          gps_verified: !!(formData.gps_lat && formData.gps_lng),
          findings_ar: findingsSummary,
          notes_ar: formData.confidential_notes || null,
          submitted_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          type: discipline,
          auto_saved_data: { ...formData, meFormData, discipline } as any,
        })
        .select("id")
        .single();

      if (inspError) { toast.error("خطأ: " + inspError.message); setSubmitting(false); return; }

      if (inspection?.id && photos.length > 0) {
        for (const photo of photos) {
          if (!photo.file) continue;
          const filePath = `${inspectorId}/${inspection.id}/${Date.now()}_${photo.file_name}`;
          const { error: uploadErr } = await supabase.storage.from("inspection-photos").upload(filePath, photo.file);
          if (!uploadErr) {
            await supabase.from("inspection_photos").insert({
              inspection_id: inspection.id, file_name: photo.file_name, file_path: filePath,
              category: photo.category, uploaded_by: inspectorId,
            });
          }
        }
      }

      if (inspection?.id) {
        const checklistRows = checklist.map((item, idx) => ({
          inspection_id: inspection.id, label_ar: item.label_ar, category: item.category,
          is_checked: item.is_checked, is_required: item.is_required, sort_order: idx,
        }));
        await supabase.from("inspection_checklist_items").insert(checklistRows);
      }

      localStorage.removeItem("field-inspection-data");
      setSubmitted(true);
      toast.success("تم إرسال المعاينة بنجاح ✅");
    } catch (err: any) {
      toast.error("حدث خطأ غير متوقع");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-6 max-w-sm mx-auto">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">تم إرسال المعاينة بنجاح 🎉</h1>
            <p className="text-sm text-muted-foreground">تم حفظ جميع البيانات والصور.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/inspector")}>لوحة التحكم</Button>
            <Button className="flex-1" onClick={() => { setSubmitted(false); setFormData(defaultFormData); setMeFormData({}); setPhotos([]); setStep(0); }}>معاينة جديدة</Button>
          </div>
        </div>
      </div>
    );
  }

  // Render current section content
  const renderStepContent = () => {
    const currentKey = activeSteps[step]?.key;

    // Real estate sections
    if (currentKey === "general") return <SectionGeneral formData={formData} updateField={updateField} />;
    if (currentKey === "location") return <SectionLocation formData={formData} updateField={updateField} gpsLoading={gpsLoading} gpsError={gpsError} onCaptureGPS={captureGPS} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "verification") return <SectionVerification formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "dimensions") return <SectionDimensions formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "exterior") return <SectionExterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "interior") return <SectionInterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "condition") return <SectionCondition formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "utilities") return <SectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "layout_areas") return <SectionLayoutAreas formData={formData} updateField={updateField} />;
    if (currentKey === "value_factors") return <SectionValueFactors formData={formData} updateField={updateField} />;
    if (currentKey === "notes_recommendations") return <SectionNotesRecommendations formData={formData} updateField={updateField} submitting={submitting} onSubmit={handleSubmit} />;
    if (currentKey === "documentation") return <SectionDocumentation photos={photos} onCapture={handlePhotoCapture} onRemove={removePhoto} onDescriptionChange={handlePhotoDescriptionChange} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />;
    if (currentKey === "risks") return <SectionRisks formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "final_check") return <SectionFinalCheck formData={formData} updateField={updateField} sectionComplete={[]} photos={photos} checkedRequired={checkedRequired} totalRequired={totalRequired} />;
    if (currentKey === "approval") return <SectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />;

    // Machinery sections
    if (currentKey === "me_general") return <MachineryGeneral formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_location") return <SectionLocation formData={formData} updateField={updateField} gpsLoading={gpsLoading} gpsError={gpsError} onCaptureGPS={captureGPS} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "me_verification") return <SectionVerification formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "me_mechanical") return <MachineryMechanical formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_electrical") return <MachineryElectrical formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_structural") return <MachineryStructural formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_operation") return <MachineryOperation formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_safety") return <MachinerySafety formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_maintenance") return <MachineryMaintenance formData={meFormData} updateField={updateMeField} />;
    if (currentKey === "me_documentation") return <SectionDocumentation photos={photos} onCapture={handlePhotoCapture} onRemove={removePhoto} onDescriptionChange={handlePhotoDescriptionChange} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />;
    if (currentKey === "me_notes") return <SectionNotesRecommendations formData={formData} updateField={updateField} submitting={submitting} onSubmit={handleSubmit} />;
    if (currentKey === "me_risks") return <SectionRisks formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />;
    if (currentKey === "me_approval") return <SectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />;

    return null;
  };

  const disciplineLabel = discipline === "real_estate" ? "🏠 معاينة عقارية" : discipline === "machinery_equipment" ? "⚙️ معاينة آلات ومعدات" : "🏗️ معاينة مختلطة";

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-sm font-bold text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            نموذج المعاينة الميدانية
          </h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">{disciplineLabel}</Badge>
            <span className="text-xs text-muted-foreground">{overallProgress}%</span>
            <Badge variant="outline" className="text-xs">
              {activeSteps[step]?.num || 1} / {activeSteps.length}
            </Badge>
          </div>
        </div>

        <div className="px-4 pb-2">
          <Progress value={overallProgress} className="h-1.5" />
        </div>

        {/* Mixed mode tabs */}
        {discipline === "mixed" && (
          <div className="px-4 pb-2">
            <Tabs value={mixedTab} onValueChange={v => setMixedTab(v as any)}>
              <TabsList className="w-full">
                <TabsTrigger value="real_estate" className="flex-1 text-xs">🏠 عقارات</TabsTrigger>
                <TabsTrigger value="machinery" className="flex-1 text-xs">⚙️ آلات ومعدات</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Current section */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            {(() => { const Icon = activeSteps[step]?.icon || Info; return <Icon className="w-4 h-4 text-primary" />; })()}
            <span className="text-xs font-bold text-primary">القسم {activeSteps[step]?.num}</span>
            <Separator orientation="vertical" className="h-4 bg-primary/20" />
            <span className="text-xs font-semibold text-foreground">{activeSteps[step]?.label}</span>
          </div>
        </div>

        {/* Horizontal stepper */}
        <div className="relative px-2 pb-3">
          <div className="flex items-start overflow-x-auto gap-0 pb-1 scrollbar-hide">
            {activeSteps.map((s, i) => {
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.key} className="flex flex-col items-center shrink-0 relative" style={{ minWidth: "64px" }}>
                  {i > 0 && <div className={`absolute top-[14px] right-[50%] h-[2px] transition-colors ${isDone ? "bg-primary" : "bg-border"}`} style={{ width: "100%", zIndex: 0 }} />}
                  <button onClick={() => setStep(i)} className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all ${
                    isActive ? "border-primary bg-primary text-primary-foreground shadow-md scale-110" :
                    isDone ? "border-primary bg-primary/10 text-primary" : "border-muted-foreground/30 bg-card text-muted-foreground"
                  }`}>
                    {isDone ? <CheckCircle className="w-4 h-4" /> : <span className="text-[10px] font-bold">{s.num}</span>}
                  </button>
                  <span className={`text-[9px] mt-1 text-center leading-tight max-w-[60px] ${isActive ? "text-primary font-bold" : isDone ? "text-primary/70" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {step > 0 && (<><span>{activeSteps[step - 1].label}</span><ChevronLeft className="w-3 h-3" /></>)}
          <span className="font-bold text-primary">{activeSteps[step]?.label}</span>
          {step < activeSteps.length - 1 && (<><ChevronLeft className="w-3 h-3" /><span>{activeSteps[step + 1].label}</span></>)}
        </div>
        {renderStepContent()}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t p-3 flex gap-3 z-20">
        <Button variant="outline" className="flex-1 h-12 text-base" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          <ChevronRight className="w-5 h-5 ml-1" /> السابق
        </Button>
        {step < activeSteps.length - 1 ? (
          <Button className="flex-1 h-12 text-base" onClick={() => setStep(s => s + 1)}>
            التالي <ChevronLeft className="w-5 h-5 mr-1" />
          </Button>
        ) : (
          <Button className="flex-1 h-12 text-base" disabled={!canSubmit() || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
            إرسال المعاينة
          </Button>
        )}
      </div>
    </div>
  );
}
