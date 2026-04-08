import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ChevronRight, ChevronLeft, Loader2, Send } from "lucide-react";

import {
  type InspectionFormData, type PhotoItem, type ChecklistItem,
  defaultInspectionFormData, PHOTO_CATEGORIES, DEFAULT_CHECKLIST, STEPS,
  MobileSectionGeneral, MobileSectionLocation, MobileSectionVerification,
  MobileSectionDimensions, MobileSectionCondition, MobileSectionUtilities,
  MobileSectionValueFactors, MobileSectionDocumentation, MobileSectionRisks,
  MobileSectionFinalCheck, MobileSectionApproval,
} from "@/components/inspector/mobile/MobileInspectionSections";

export default function MobileInspectionFlow() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [inspection, setInspection] = useState<any>(null);
  const [formData, setFormData] = useState<InspectionFormData>(defaultInspectionFormData);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);

  const updateField = <K extends keyof InspectionFormData>(key: K, value: InspectionFormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    if (inspectionId) loadInspection();
  }, [inspectionId]);

  const loadInspection = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inspections")
      .select("*, valuation_assignments(reference_number)")
      .eq("id", inspectionId)
      .single();

    if (!data) {
      toast.error("لم يتم العثور على المعاينة");
      navigate("/inspector");
      return;
    }

    setInspection(data);
    const saved = data.auto_saved_data as any;
    if (saved?.formData) setFormData(prev => ({ ...prev, ...saved.formData }));
    if (saved?.step) setStep(saved.step);

    if (data.latitude && data.longitude) {
      setFormData(prev => ({ ...prev, gps_lat: Number(data.latitude), gps_lng: Number(data.longitude) }));
    }

    const refNum = (data as any).valuation_assignments?.reference_number;
    if (refNum) setFormData(prev => ({ ...prev, assignment_ref: refNum }));
    if (data.notes_ar) updateField("inspector_final_notes", data.notes_ar);
    if (data.findings_ar) updateField("asset_description", data.findings_ar);

    const { data: existingPhotos } = await supabase.from("inspection_photos").select("*").eq("inspection_id", inspectionId);
    if (existingPhotos) {
      setPhotos(existingPhotos.map(p => ({ id: p.id, category: p.category, file_name: p.file_name, file_path: p.file_path })));
    }

    const { data: existingChecklist } = await supabase.from("inspection_checklist_items").select("*").eq("inspection_id", inspectionId).order("sort_order");
    if (existingChecklist && existingChecklist.length > 0) {
      setChecklist(existingChecklist.map(c => ({ id: c.id, category: c.category, label_ar: c.label_ar, is_checked: c.is_checked ?? false, is_required: c.is_required ?? true, value: c.value ?? undefined, notes: c.notes ?? undefined })));
    } else {
      setChecklist(DEFAULT_CHECKLIST.map(c => ({ ...c, is_checked: false })));
    }
    setLoading(false);
  };

  const autoSave = useCallback(async () => {
    if (!inspectionId) return;
    await supabase.from("inspections").update({
      auto_saved_data: { step, formData } as any,
      notes_ar: formData.inspector_final_notes || null,
      findings_ar: formData.asset_description || null,
      latitude: formData.gps_lat ?? null,
      longitude: formData.gps_lng ?? null,
    }).eq("id", inspectionId);
  }, [inspectionId, step, formData]);

  useEffect(() => {
    const timer = setTimeout(autoSave, 3000);
    return () => clearTimeout(timer);
  }, [autoSave]);

  const captureGPS = () => {
    setGpsLoading(true);
    setGpsError(null);
    if (!navigator.geolocation) { setGpsError("GPS غير متوفر في هذا المتصفح"); setGpsLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setFormData(prev => ({ ...prev, gps_lat: pos.coords.latitude, gps_lng: pos.coords.longitude })); setGpsLoading(false); toast.success("تم تحديد الموقع بنجاح"); },
      () => { setGpsError("تعذر تحديد الموقع. يرجى تفعيل GPS"); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handlePhotoCapture = async (category: string, files: FileList | null) => {
    if (!files || !inspectionId) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${inspectionId}/${category}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("inspection-photos").upload(path, file);
      if (uploadErr) { toast.error(`فشل رفع ${file.name}`); continue; }

      const { data: photoRow } = await supabase.from("inspection_photos").insert({
        inspection_id: inspectionId, category, file_name: file.name, file_path: path,
        file_size: file.size, mime_type: file.type,
        latitude: formData.gps_lat ?? null, longitude: formData.gps_lng ?? null, uploaded_by: user?.id,
      }).select().single();

      if (photoRow) {
        setPhotos(prev => [...prev, { id: photoRow.id, category, file_name: file.name, file_path: path, preview: URL.createObjectURL(file) }]);
      }
    }
    setSaving(false);
    toast.success("تم رفع الصور بنجاح");
  };

  const removePhoto = async (photo: PhotoItem) => {
    if (photo.id) {
      await supabase.from("inspection_photos").delete().eq("id", photo.id);
      await supabase.storage.from("inspection-photos").remove([photo.file_path]);
    }
    setPhotos(prev => prev.filter(p => p.file_path !== photo.file_path));
  };

  const saveChecklist = async () => {
    if (!inspectionId) return;
    await supabase.from("inspection_checklist_items").delete().eq("inspection_id", inspectionId);
    const items = checklist.map((c, i) => ({
      inspection_id: inspectionId, category: c.category, label_ar: c.label_ar,
      is_checked: c.is_checked, is_required: c.is_required, value: c.value || null, notes: c.notes || null, sort_order: i,
    }));
    await supabase.from("inspection_checklist_items").insert(items);
  };

  const requiredPhotoDone = PHOTO_CATEGORIES.filter(c => c.required).filter(c => photos.some(p => p.category === c.key)).length;
  const requiredPhotoTotal = PHOTO_CATEGORIES.filter(c => c.required).length;
  const checkedRequired = checklist.filter(c => c.is_required && c.is_checked).length;
  const totalRequired = checklist.filter(c => c.is_required).length;

  const canSubmit = () => {
    const hasGPS = !!(formData.gps_lat && formData.gps_lng);
    const hasAllPhotos = requiredPhotoDone === requiredPhotoTotal;
    const allChecked = checkedRequired === totalRequired;
    return hasGPS && hasAllPhotos && allChecked && !!formData.overall_condition && !!formData.asset_description;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !inspectionId) return;
    setSubmitting(true);
    await saveChecklist();

    const startedAt = inspection?.started_at ? new Date(inspection.started_at) : null;
    const durationMin = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : null;

    await supabase.from("inspections").update({
      status: "submitted", completed: true, submitted_at: new Date().toISOString(), gps_verified: true,
      latitude: formData.gps_lat, longitude: formData.gps_lng,
      notes_ar: formData.inspector_final_notes || null, findings_ar: formData.asset_description || null,
      weather_conditions: formData.environmental_factors || null, access_granted: formData.matches_documents !== "no",
      duration_minutes: durationMin, auto_saved_data: { formData, step: 10, completed: true } as any,
    }).eq("id", inspectionId);

    toast.success("تم إرسال المعاينة بنجاح ✅");

    try {
      toast.info("جاري تحليل المعاينة بالذكاء الاصطناعي...");
      supabase.functions.invoke("analyze-inspection", { body: { inspection_id: inspectionId } });
    } catch (err) { console.error("Failed to trigger AI analysis:", err); }

    setSubmitting(false);
    navigate("/inspector");
  };

  const sectionComplete = [
    !!(formData.inspector_name && formData.inspection_date && formData.asset_type),
    !!(formData.city && formData.gps_lat),
    !!(formData.matches_documents && formData.asset_description),
    !!(formData.land_area || formData.building_area),
    !!formData.overall_condition,
    true, true,
    requiredPhotoDone === requiredPhotoTotal,
    !!formData.has_risks,
    !!formData.data_complete,
    !!formData.approval_inspector_name,
  ];
  const overallProgress = Math.round(sectionComplete.filter(Boolean).length / sectionComplete.length * 100);

  if (loading) {
    return <div className="flex items-center justify-center h-screen bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-card border-b p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/inspector")}><ChevronRight className="w-4 h-4" /> رجوع</Button>
          <span className="text-xs font-bold text-primary">نموذج المعاينة الميدانية</span>
          <div className="flex items-center gap-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="text-[10px]">{formData.assignment_ref || inspection?.assignment_id?.slice(0, 8)}</Badge>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1"><span>الإنجاز الكلي</span><span>{overallProgress}%</span></div>
          <Progress value={overallProgress} className="h-2" />
        </div>
        <div className="flex gap-0.5 mt-2 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button key={s.key} onClick={() => setStep(i)} className={`shrink-0 flex flex-col items-center py-1 px-1.5 rounded transition-colors min-w-[48px] ${
                i === step ? "bg-primary text-primary-foreground" : sectionComplete[i] ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"
              }`}>
                <Icon className="w-3 h-3" /><span className="text-[8px] mt-0.5 leading-tight">{s.num}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {step === 0 && <MobileSectionGeneral formData={formData} updateField={updateField} />}
        {step === 1 && <MobileSectionLocation formData={formData} updateField={updateField} gpsLoading={gpsLoading} gpsError={gpsError} onCaptureGPS={captureGPS} />}
        {step === 2 && <MobileSectionVerification formData={formData} updateField={updateField} />}
        {step === 3 && <MobileSectionDimensions formData={formData} updateField={updateField} />}
        {step === 4 && <MobileSectionCondition formData={formData} updateField={updateField} />}
        {step === 5 && <MobileSectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} />}
        {step === 6 && <MobileSectionValueFactors formData={formData} updateField={updateField} />}
        {step === 7 && <MobileSectionDocumentation photos={photos} saving={saving} onCapture={handlePhotoCapture} onRemove={removePhoto} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />}
        {step === 8 && <MobileSectionRisks formData={formData} updateField={updateField} />}
        {step === 9 && <MobileSectionFinalCheck formData={formData} updateField={updateField} sectionComplete={sectionComplete} photos={photos} checkedRequired={checkedRequired} totalRequired={totalRequired} />}
        {step === 10 && <MobileSectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t p-3 flex gap-3 z-20">
        <Button variant="outline" className="flex-1 h-12 text-base" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
          <ChevronRight className="w-5 h-5 ml-1" /> السابق
        </Button>
        {step < STEPS.length - 1 ? (
          <Button className="flex-1 h-12 text-base" onClick={() => { if (step === 5) saveChecklist(); setStep(s => s + 1); }}>
            التالي <ChevronLeft className="w-5 h-5 mr-1" />
          </Button>
        ) : (
          <Button className="flex-1 h-12 text-base" disabled={!canSubmit() || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}إرسال المعاينة
          </Button>
        )}
      </div>
    </div>
  );
}
