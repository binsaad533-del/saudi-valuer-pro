import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck, Home, LayoutGrid,
} from "lucide-react";
import type { SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  SectionGeneral, SectionLocation, SectionVerification, SectionDimensions,
  SectionExterior, SectionInterior, SectionCondition, SectionUtilities,
  SectionLayoutAreas, SectionValueFactors, SectionDocumentation,
  SectionNotesRecommendations, SectionRisks, SectionFinalCheck, SectionApproval,
} from "@/components/inspection/sections";
import { defaultFormData, PHOTO_CATEGORIES, DEFAULT_CHECKLIST } from "@/components/inspection/sections/types";
import type { FormData, PhotoItem, ChecklistItem } from "@/components/inspection/sections/types";

const STEPS = [
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

export default function FieldInspectionPage() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<FormData>(defaultFormData);
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

  // Auto-save to localStorage
  const autoSave = useCallback(() => {
    try {
      localStorage.setItem("field-inspection-data", JSON.stringify({ formData, step, photos: photos.map(p => ({ category: p.category, file_name: p.file_name })) }));
    } catch { /* ignore */ }
  }, [formData, step, photos]);

  useEffect(() => {
    const timer = setTimeout(autoSave, 3000);
    return () => clearTimeout(timer);
  }, [autoSave]);

  // Restore on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("field-inspection-data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.formData) setFormData(prev => ({ ...prev, ...parsed.formData }));
        if (typeof parsed.step === "number") setStep(parsed.step);
      }
    } catch { /* ignore */ }
  }, []);

  const captureGPS = () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("GPS غير متوفر في هذا المتصفح");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({ ...prev, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude }));
        setGpsLoading(false);
        toast.success("تم تحديد الموقع بنجاح");
      },
      () => { setGpsError("تعذر تحديد الموقع. يرجى تفعيل GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handlePhotoCapture = (category: string, files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      setPhotos(prev => [...prev, { category, file_name: file.name, preview: URL.createObjectURL(file), description: "" }]);
    }
    toast.success("تم إضافة الصور بنجاح");
  };

  const removePhoto = (photo: PhotoItem) => {
    setPhotos(prev => prev.filter(p => p !== photo));
  };

  const updatePhotoDescription = (photo: PhotoItem, description: string) => {
    setPhotos(prev => prev.map(p => p === photo ? { ...p, description } : p));
  };

  const suggestCategoryFromDescription = (desc: string): string | null => {
    const d = desc.toLowerCase();
    const keywords: Record<string, string[]> = {
      exterior_front: ["واجهة أمام", "المدخل", "الباب الرئيسي", "front"],
      exterior_back: ["واجهة خلف", "خلفي", "back"],
      exterior_left: ["يسرى", "يسار", "left"],
      exterior_right: ["يمنى", "يمين", "right"],
      street_view: ["شارع", "طريق", "street"],
      surroundings: ["محيط", "جيران", "حي", "surrounding"],
      interior_living: ["صالة", "معيشة", "مجلس", "living"],
      interior_kitchen: ["مطبخ", "kitchen"],
      interior_bathroom: ["حمام", "دورة مياه", "bathroom"],
      interior_bedroom: ["غرفة نوم", "bedroom"],
      site_plan: ["مخطط", "كروكي", "plan", "رسم"],
      floor_plan: ["دور", "طابق", "floor"],
      deed_photo: ["صك", "deed", "وثيقة", "عقد"],
      problem_cracks: ["تشقق", "شرخ", "crack", "كسر"],
      problem_moisture: ["رطوبة", "تسرب", "moisture", "water leak"],
      problem_other: ["مشكلة", "عيب", "تلف", "damage"],
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
      // Auto-move to suggested category
      setPhotos(prev => prev.map(p => p === photo ? { ...p, description, category: suggested } : p));
      const catLabel = PHOTO_CATEGORIES.find(c => c.key === suggested)?.label || suggested;
      toast.info(`📂 تم نقل الصورة تلقائياً إلى: ${catLabel}`);
    }
  };

  const requiredPhotoDone = PHOTO_CATEGORIES.filter(c => c.required).filter(c => photos.some(p => p.category === c.key)).length;
  const requiredPhotoTotal = PHOTO_CATEGORIES.filter(c => c.required).length;
  const checkedRequired = checklist.filter(c => c.is_required && c.is_checked).length;
  const totalRequired = checklist.filter(c => c.is_required).length;

  const sectionComplete = [
    !!(formData.inspector_name && formData.inspection_date && formData.asset_type),
    !!(formData.city && formData.gps_lat),
    !!(formData.matches_documents && formData.asset_description),
    !!(formData.land_area || formData.building_area),
    !!(formData.exterior_facade_material),
    !!(formData.interior_floors_type),
    !!(formData.overall_condition),
    true,
    !!(formData.total_building_area),
    true,
    requiredPhotoDone === requiredPhotoTotal,
    !!(formData.has_risks),
    !!(formData.data_complete),
    !!(formData.approval_inspector_name),
  ];
  const overallProgress = Math.round(sectionComplete.filter(Boolean).length / sectionComplete.length * 100);

  const canSubmit = () => {
    const hasGPS = !!(formData.gps_lat && formData.gps_lng);
    const hasAllPhotos = requiredPhotoDone === requiredPhotoTotal;
    const allChecked = checkedRequired === totalRequired;
    const hasCondition = !!formData.overall_condition;
    const hasDescription = !!formData.asset_description;
    return hasGPS && hasAllPhotos && allChecked && hasCondition && hasDescription;
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      const inspectorId = user?.id;
      if (!inspectorId) {
        toast.error("يجب تسجيل الدخول أولاً");
        setSubmitting(false);
        return;
      }

      // Build findings summary
      const findingsSummary = [
        `الحالة العامة: ${formData.overall_condition}`,
        `نوع العقار: ${formData.asset_type}`,
        `عمر المبنى: ${formData.exterior_building_age} سنة`,
        `عدد الطوابق: ${formData.num_floors}`,
        formData.inspector_final_notes ? `ملاحظات: ${formData.inspector_final_notes}` : "",
      ].filter(Boolean).join("\n");

      // Determine assignment_id (required UUID)
      const assignmentId = formData.assignment_ref && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(formData.assignment_ref) ? formData.assignment_ref : null;

      if (!assignmentId) {
        toast.error("يجب ربط المعاينة بمهمة تقييم. يرجى إدخال رقم المهمة في القسم الأول.");
        setSubmitting(false);
        return;
      }

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
          auto_saved_data: formData as any,
        })
        .select("id")
        .single();

      if (inspError) {
        console.error("Inspection save error:", inspError);
        toast.error("حدث خطأ أثناء حفظ المعاينة: " + inspError.message);
        setSubmitting(false);
        return;
      }

      // Upload photos to storage and save records
      if (inspection?.id && photos.length > 0) {
        for (const photo of photos) {
          if (!photo.file) continue;
          const filePath = `${inspectorId}/${inspection.id}/${Date.now()}_${photo.file_name}`;
          const { error: uploadErr } = await supabase.storage
            .from("inspection-photos")
            .upload(filePath, photo.file);

          if (!uploadErr) {
            await supabase.from("inspection_photos").insert({
              inspection_id: inspection.id,
              file_name: photo.file_name,
              file_path: filePath,
              category: photo.category,
              uploaded_by: inspectorId,
              latitude: formData.gps_lat ?? null,
              longitude: formData.gps_lng ?? null,
            });
          }
        }
      }

      // Save checklist items
      if (inspection?.id) {
        const checklistRows = checklist.map((item, idx) => ({
          inspection_id: inspection.id,
          label_ar: item.label_ar,
          category: item.category,
          is_checked: item.is_checked,
          is_required: item.is_required,
          sort_order: idx,
        }));
        await supabase.from("inspection_checklist_items").insert(checklistRows);
      }

      localStorage.removeItem("field-inspection-data");
      setSubmitted(true);
      toast.success("تم إرسال المعاينة بنجاح ✅");
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("حدث خطأ غير متوقع أثناء الإرسال");
    } finally {
      setSubmitting(false);
    }
  };

  // Success screen after submission
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-6 max-w-sm mx-auto">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-foreground">تم إرسال المعاينة بنجاح 🎉</h1>
            <p className="text-sm text-muted-foreground">
              تم حفظ جميع البيانات والصور في النظام وستُضاف تلقائياً لقائمة المقيّم المسؤول.
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 text-right space-y-1">
            <p className="text-xs text-muted-foreground">المعاين: <span className="font-medium text-foreground">{formData.inspector_name}</span></p>
            <p className="text-xs text-muted-foreground">التاريخ: <span className="font-medium text-foreground">{formData.approval_date}</span></p>
            <p className="text-xs text-muted-foreground">نوع العقار: <span className="font-medium text-foreground">{formData.asset_type}</span></p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/inspector")}>
              لوحة التحكم
            </Button>
            <Button className="flex-1" onClick={() => {
              setSubmitted(false);
              setFormData(defaultFormData);
              setPhotos([]);
              setSectionPhotos([]);
              setStep(0);
            }}>
              معاينة جديدة
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-card border-b shadow-sm">
        {/* Title row */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h1 className="text-sm font-bold text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            نموذج المعاينة الميدانية
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{overallProgress}%</span>
            <Badge variant="outline" className="text-xs">
              {STEPS[step].num} / {STEPS.length}
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <Progress value={overallProgress} className="h-1.5" />
        </div>

        {/* Current section indicator */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2.5 bg-primary/10 border border-primary/20 rounded-lg px-3 py-2">
            {(() => { const Icon = STEPS[step].icon; return <Icon className="w-4 h-4 text-primary" />; })()}
            <span className="text-xs font-bold text-primary">
              القسم {STEPS[step].num}
            </span>
            <Separator orientation="vertical" className="h-4 bg-primary/20" />
            <span className="text-xs font-semibold text-foreground">{STEPS[step].label}</span>
            {sectionComplete[step] && (
              <CheckCircle className="w-3.5 h-3.5 text-primary mr-auto" />
            )}
          </div>
        </div>

        {/* Horizontal Stepper */}
        <div className="relative px-2 pb-3">
          <div className="flex items-start overflow-x-auto gap-0 pb-1 scrollbar-hide">
            {STEPS.map((s, i) => {
              const isActive = i === step;
              const isDone = sectionComplete[i] && !isActive;
              return (
                <div key={s.key} className="flex flex-col items-center shrink-0 relative" style={{ minWidth: "64px" }}>
                  {/* Connector line */}
                  {i > 0 && (
                    <div
                      className={`absolute top-[14px] right-[50%] h-[2px] transition-colors ${
                        sectionComplete[i - 1] ? "bg-primary" : "bg-border"
                      }`}
                      style={{ width: "100%", zIndex: 0 }}
                    />
                  )}

                  {/* Circle */}
                  <button
                    onClick={() => setStep(i)}
                    className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-md scale-110"
                        : isDone
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted-foreground/30 bg-card text-muted-foreground"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <span className="text-[10px] font-bold">{s.num}</span>
                    )}
                  </button>

                  {/* Label */}
                  <span className={`text-[9px] mt-1 text-center leading-tight max-w-[60px] ${
                    isActive ? "text-primary font-bold" : isDone ? "text-primary/70" : "text-muted-foreground"
                  }`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Section navigation hint */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {step > 0 && (
            <>
              <span>{STEPS[step - 1].label}</span>
              <ChevronLeft className="w-3 h-3" />
            </>
          )}
          <span className="font-bold text-primary">{STEPS[step].label}</span>
          {step < STEPS.length - 1 && (
            <>
              <ChevronLeft className="w-3 h-3" />
              <span>{STEPS[step + 1].label}</span>
            </>
          )}
        </div>

        {step === 0 && <SectionGeneral formData={formData} updateField={updateField} />}
        {step === 1 && <SectionLocation formData={formData} updateField={updateField} gpsLoading={gpsLoading} gpsError={gpsError} onCaptureGPS={captureGPS} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 2 && <SectionVerification formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 3 && <SectionDimensions formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 4 && <SectionExterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 5 && <SectionInterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 6 && <SectionCondition formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 7 && <SectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 8 && <SectionLayoutAreas formData={formData} updateField={updateField} />}
        {step === 9 && <SectionValueFactors formData={formData} updateField={updateField} />}
        {step === 10 && <SectionNotesRecommendations formData={formData} updateField={updateField} submitting={submitting} onSubmit={handleSubmit} />}
        {step === 11 && <SectionDocumentation photos={photos} onCapture={handlePhotoCapture} onRemove={removePhoto} onDescriptionChange={handlePhotoDescriptionChange} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />}
        {step === 12 && <SectionRisks formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 13 && <SectionFinalCheck formData={formData} updateField={updateField} sectionComplete={sectionComplete} photos={photos} checkedRequired={checkedRequired} totalRequired={totalRequired} />}
        {step === 14 && <SectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t p-3 flex gap-3 z-20">
        <Button variant="outline" className="flex-1 h-12 text-base" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          <ChevronRight className="w-5 h-5 ml-1" /> السابق
        </Button>
        {step < STEPS.length - 1 ? (
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
