import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MapPin, Camera, ClipboardCheck, StickyNote,
  Send, ChevronRight, ChevronLeft, Loader2,
  CheckCircle, AlertTriangle, Navigation, ImagePlus,
  Trash2, Eye, Info, Building2, Ruler, Wrench,
  Zap, TrendingUp, ShieldAlert, FileCheck, UserCheck,
} from "lucide-react";

// ── Photo Categories ──
const PHOTO_CATEGORIES = [
  { key: "exterior_front", label: "الواجهة الأمامية", required: true },
  { key: "exterior_back", label: "الواجهة الخلفية", required: true },
  { key: "exterior_left", label: "الواجهة اليسرى", required: true },
  { key: "exterior_right", label: "الواجهة اليمنى", required: true },
  { key: "street_view", label: "منظر الشارع", required: true },
  { key: "interior_living", label: "صالة المعيشة", required: false },
  { key: "interior_kitchen", label: "المطبخ", required: false },
  { key: "interior_bathroom", label: "دورة المياه", required: false },
  { key: "interior_bedroom", label: "غرفة النوم", required: false },
  { key: "surroundings", label: "المحيط العام", required: true },
];

// ── Default Checklist ──
const DEFAULT_CHECKLIST = [
  { category: "structure", label_ar: "الهيكل الإنشائي سليم", is_required: true },
  { category: "structure", label_ar: "لا توجد تشققات ظاهرة", is_required: true },
  { category: "structure", label_ar: "حالة السقف جيدة", is_required: true },
  { category: "utilities", label_ar: "توصيلات الكهرباء متوفرة", is_required: true },
  { category: "utilities", label_ar: "توصيلات المياه متوفرة", is_required: true },
  { category: "utilities", label_ar: "نظام الصرف الصحي يعمل", is_required: true },
  { category: "exterior", label_ar: "حالة الأسوار والبوابات", is_required: false },
  { category: "exterior", label_ar: "المواقف متوفرة", is_required: false },
  { category: "exterior", label_ar: "التشجير والمسطحات الخضراء", is_required: false },
  { category: "interior", label_ar: "حالة الأرضيات", is_required: true },
  { category: "interior", label_ar: "حالة الدهانات والجدران", is_required: true },
  { category: "interior", label_ar: "حالة النوافذ والأبواب", is_required: true },
  { category: "compliance", label_ar: "مطابقة للمخطط المعتمد", is_required: true },
  { category: "compliance", label_ar: "لا توجد مخالفات بناء", is_required: true },
];

// ── Steps ──
const STEPS = [
  { key: "general", label: "معلومات عامة", icon: Info, num: 1 },
  { key: "location", label: "بيانات الموقع", icon: MapPin, num: 2 },
  { key: "verification", label: "التحقق من الأصل", icon: Building2, num: 3 },
  { key: "dimensions", label: "المساحات", icon: Ruler, num: 4 },
  { key: "condition", label: "حالة الأصل", icon: Wrench, num: 5 },
  { key: "utilities", label: "المرافق", icon: Zap, num: 6 },
  { key: "value_factors", label: "العوامل المؤثرة", icon: TrendingUp, num: 7 },
  { key: "documentation", label: "التوثيق", icon: Camera, num: 8 },
  { key: "risks", label: "المخاطر", icon: ShieldAlert, num: 9 },
  { key: "final_check", label: "التحقق النهائي", icon: FileCheck, num: 10 },
  { key: "approval", label: "الاعتماد", icon: UserCheck, num: 11 },
];

interface PhotoItem {
  id?: string;
  category: string;
  file_name: string;
  file_path: string;
  file?: File;
  preview?: string;
}

interface ChecklistItem {
  id?: string;
  category: string;
  label_ar: string;
  is_checked: boolean;
  is_required: boolean;
  value?: string;
  notes?: string;
}

// ── Form Data Interface ──
interface InspectionFormData {
  // Section 1 - General
  assignment_ref: string;
  valuer_name: string;
  inspector_name: string;
  inspection_date: string;
  inspection_time: string;
  asset_type: string;
  // Section 2 - Location
  city: string;
  district: string;
  detailed_address: string;
  gps_lat: number | null;
  gps_lng: number | null;
  access_ease: string;
  // Section 3 - Verification
  matches_documents: string;
  asset_description: string;
  current_use: string;
  highest_best_use: string;
  // Section 4 - Dimensions
  land_area: string;
  building_area: string;
  num_floors: string;
  dimensions_notes: string;
  // Section 5 - Condition
  overall_condition: string;
  asset_age: string;
  finishing_level: string;
  condition_notes: string;
  // Section 6 - Utilities
  electricity: boolean;
  water: boolean;
  sewage: boolean;
  roads_paved: boolean;
  utilities_notes: string;
  // Section 7 - Value Factors
  positive_factors: string;
  negative_factors: string;
  environmental_factors: string;
  regulatory_factors: string;
  // Section 8 - Documentation (handled by photos state)
  // Section 9 - Risks
  has_risks: string;
  risk_details: string;
  // Section 10 - Final Check
  data_complete: string;
  inspector_final_notes: string;
  // Section 11 - Approval
  approval_inspector_name: string;
  approval_date: string;
}

const defaultFormData: InspectionFormData = {
  assignment_ref: "",
  valuer_name: "",
  inspector_name: "",
  inspection_date: new Date().toISOString().split("T")[0],
  inspection_time: new Date().toTimeString().slice(0, 5),
  asset_type: "real_estate",
  city: "",
  district: "",
  detailed_address: "",
  gps_lat: null,
  gps_lng: null,
  access_ease: "",
  matches_documents: "",
  asset_description: "",
  current_use: "",
  highest_best_use: "",
  land_area: "",
  building_area: "",
  num_floors: "",
  dimensions_notes: "",
  overall_condition: "",
  asset_age: "",
  finishing_level: "",
  condition_notes: "",
  electricity: false,
  water: false,
  sewage: false,
  roads_paved: false,
  utilities_notes: "",
  positive_factors: "",
  negative_factors: "",
  environmental_factors: "",
  regulatory_factors: "",
  has_risks: "",
  risk_details: "",
  data_complete: "",
  inspector_final_notes: "",
  approval_inspector_name: "",
  approval_date: new Date().toISOString().split("T")[0],
};

export default function MobileInspectionFlow() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [inspection, setInspection] = useState<any>(null);
  const [formData, setFormData] = useState<InspectionFormData>(defaultFormData);

  // GPS
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  // Photos & Checklist
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

    // Restore saved data
    const saved = data.auto_saved_data as any;
    if (saved?.formData) {
      setFormData(prev => ({ ...prev, ...saved.formData }));
    }
    if (saved?.step) setStep(saved.step);

    // Set GPS from inspection
    if (data.latitude && data.longitude) {
      setFormData(prev => ({
        ...prev,
        gps_lat: Number(data.latitude),
        gps_lng: Number(data.longitude),
      }));
    }

    // Set ref number
    const refNum = (data as any).valuation_assignments?.reference_number;
    if (refNum) {
      setFormData(prev => ({ ...prev, assignment_ref: refNum }));
    }

    if (data.notes_ar) updateField("inspector_final_notes", data.notes_ar);
    if (data.findings_ar) updateField("asset_description", data.findings_ar);

    // Load photos
    const { data: existingPhotos } = await supabase
      .from("inspection_photos")
      .select("*")
      .eq("inspection_id", inspectionId);
    if (existingPhotos) {
      setPhotos(existingPhotos.map(p => ({
        id: p.id, category: p.category, file_name: p.file_name, file_path: p.file_path,
      })));
    }

    // Load or init checklist
    const { data: existingChecklist } = await supabase
      .from("inspection_checklist_items")
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("sort_order");

    if (existingChecklist && existingChecklist.length > 0) {
      setChecklist(existingChecklist.map(c => ({
        id: c.id, category: c.category, label_ar: c.label_ar,
        is_checked: c.is_checked ?? false, is_required: c.is_required ?? true,
        value: c.value ?? undefined, notes: c.notes ?? undefined,
      })));
    } else {
      setChecklist(DEFAULT_CHECKLIST.map(c => ({ ...c, is_checked: false })));
    }

    setLoading(false);
  };

  // Auto-save
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
    if (!navigator.geolocation) {
      setGpsError("GPS غير متوفر في هذا المتصفح");
      setGpsLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
        }));
        setGpsLoading(false);
        toast.success("تم تحديد الموقع بنجاح");
      },
      () => {
        setGpsError("تعذر تحديد الموقع. يرجى تفعيل GPS");
        setGpsLoading(false);
      },
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

      const { error: uploadErr } = await supabase.storage
        .from("inspection-photos")
        .upload(path, file);

      if (uploadErr) {
        toast.error(`فشل رفع ${file.name}`);
        continue;
      }

      const { data: photoRow } = await supabase.from("inspection_photos").insert({
        inspection_id: inspectionId,
        category,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        latitude: formData.gps_lat ?? null,
        longitude: formData.gps_lng ?? null,
        uploaded_by: user?.id,
      }).select().single();

      if (photoRow) {
        setPhotos(prev => [...prev, {
          id: photoRow.id, category, file_name: file.name, file_path: path,
          preview: URL.createObjectURL(file),
        }]);
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
      inspection_id: inspectionId,
      category: c.category,
      label_ar: c.label_ar,
      is_checked: c.is_checked,
      is_required: c.is_required,
      value: c.value || null,
      notes: c.notes || null,
      sort_order: i,
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
    const hasCondition = !!formData.overall_condition;
    const hasDescription = !!formData.asset_description;
    return hasGPS && hasAllPhotos && allChecked && hasCondition && hasDescription;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !inspectionId) return;
    setSubmitting(true);
    await saveChecklist();

    // Calculate duration
    const startedAt = inspection?.started_at ? new Date(inspection.started_at) : null;
    const durationMin = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : null;

    await supabase.from("inspections").update({
      status: "submitted",
      completed: true,
      submitted_at: new Date().toISOString(),
      gps_verified: true,
      latitude: formData.gps_lat,
      longitude: formData.gps_lng,
      notes_ar: formData.inspector_final_notes || null,
      findings_ar: formData.asset_description || null,
      weather_conditions: formData.environmental_factors || null,
      access_granted: formData.matches_documents !== "no",
      duration_minutes: durationMin,
      auto_saved_data: { formData, step: 10, completed: true } as any,
    }).eq("id", inspectionId);

    toast.success("تم إرسال المعاينة بنجاح ✅");

    // Trigger AI analysis
    try {
      toast.info("جاري تحليل المعاينة بالذكاء الاصطناعي...");
      supabase.functions.invoke("analyze-inspection", {
        body: { inspection_id: inspectionId },
      });
    } catch (err) {
      console.error("Failed to trigger AI analysis:", err);
    }

    setSubmitting(false);
    navigate("/inspector");
  };

  // Progress calculation
  const sectionComplete = [
    !!(formData.inspector_name && formData.inspection_date && formData.asset_type),   // 1
    !!(formData.city && formData.gps_lat),                                             // 2
    !!(formData.matches_documents && formData.asset_description),                      // 3
    !!(formData.land_area || formData.building_area),                                  // 4
    !!(formData.overall_condition),                                                    // 5
    true,                                                                              // 6 (optional)
    true,                                                                              // 7 (optional)
    requiredPhotoDone === requiredPhotoTotal,                                           // 8
    !!(formData.has_risks),                                                            // 9
    !!(formData.data_complete),                                                        // 10
    !!(formData.approval_inspector_name),                                              // 11
  ];
  const overallProgress = Math.round(sectionComplete.filter(Boolean).length / sectionComplete.length * 100);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-card border-b p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/inspector")}>
            <ChevronRight className="w-4 h-4" /> رجوع
          </Button>
          <span className="text-xs font-bold text-primary">
            نموذج المعاينة الميدانية
          </span>
          <div className="flex items-center gap-1">
            {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Badge variant="outline" className="text-[10px]">
              {formData.assignment_ref || inspection?.assignment_id?.slice(0, 8)}
            </Badge>
          </div>
        </div>
        {/* Progress */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>الإنجاز الكلي</span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
        {/* Step indicators */}
        <div className="flex gap-0.5 mt-2 overflow-x-auto pb-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setStep(i)}
                className={`shrink-0 flex flex-col items-center py-1 px-1.5 rounded transition-colors min-w-[48px] ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : sectionComplete[i]
                      ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />
                <span className="text-[8px] mt-0.5 leading-tight">{s.num}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {step === 0 && <SectionGeneral formData={formData} updateField={updateField} />}
        {step === 1 && (
          <SectionLocation
            formData={formData}
            updateField={updateField}
            gpsLoading={gpsLoading}
            gpsError={gpsError}
            onCaptureGPS={captureGPS}
          />
        )}
        {step === 2 && <SectionVerification formData={formData} updateField={updateField} />}
        {step === 3 && <SectionDimensions formData={formData} updateField={updateField} />}
        {step === 4 && <SectionCondition formData={formData} updateField={updateField} />}
        {step === 5 && <SectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} />}
        {step === 6 && <SectionValueFactors formData={formData} updateField={updateField} />}
        {step === 7 && (
          <SectionDocumentation
            photos={photos}
            saving={saving}
            onCapture={handlePhotoCapture}
            onRemove={removePhoto}
            requiredPhotoDone={requiredPhotoDone}
            requiredPhotoTotal={requiredPhotoTotal}
          />
        )}
        {step === 8 && <SectionRisks formData={formData} updateField={updateField} />}
        {step === 9 && (
          <SectionFinalCheck
            formData={formData}
            updateField={updateField}
            sectionComplete={sectionComplete}
            photos={photos}
            checkedRequired={checkedRequired}
            totalRequired={totalRequired}
          />
        )}
        {step === 10 && (
          <SectionApproval
            formData={formData}
            updateField={updateField}
            canSubmit={canSubmit()}
            submitting={submitting}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div className="fixed bottom-0 inset-x-0 bg-card border-t p-3 flex gap-3 z-20">
        <Button
          variant="outline"
          className="flex-1 h-12 text-base"
          disabled={step === 0}
          onClick={() => setStep(s => s - 1)}
        >
          <ChevronRight className="w-5 h-5 ml-1" /> السابق
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1 h-12 text-base"
            onClick={() => {
              if (step === 5) saveChecklist();
              setStep(s => s + 1);
            }}
          >
            التالي <ChevronLeft className="w-5 h-5 mr-1" />
          </Button>
        ) : (
          <Button
            className="flex-1 h-12 text-base"
            disabled={!canSubmit() || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
            إرسال المعاينة
          </Button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Section Components
   ══════════════════════════════════════════════════════════ */

function SectionHeader({ num, title, icon: Icon, subtitle }: { num: number; title: string; icon: any; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
        {num}
      </div>
      <div className="flex-1">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" /> {title}
        </h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function FieldGroup({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1">
        {label}
        {required && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

// ── 1. General Info ──
function SectionGeneral({ formData, updateField }: { formData: InspectionFormData; updateField: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={1} title="معلومات عامة" icon={Info} subtitle="البيانات الأساسية للمعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="رقم المهمة">
          <Input value={formData.assignment_ref} readOnly className="bg-muted text-muted-foreground" />
        </FieldGroup>

        <FieldGroup label="اسم المقيّم">
          <Input value={formData.valuer_name} onChange={e => updateField("valuer_name", e.target.value)} placeholder="اسم المقيّم المسؤول" />
        </FieldGroup>

        <FieldGroup label="اسم المعاين" required>
          <Input value={formData.inspector_name} onChange={e => updateField("inspector_name", e.target.value)} placeholder="اسمك الكامل" />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="تاريخ المعاينة" required>
            <Input type="date" value={formData.inspection_date} onChange={e => updateField("inspection_date", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="وقت المعاينة">
            <Input type="time" value={formData.inspection_time} onChange={e => updateField("inspection_time", e.target.value)} />
          </FieldGroup>
        </div>

        <FieldGroup label="نوع الأصل" required>
          <RadioGroup value={formData.asset_type} onValueChange={v => updateField("asset_type", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "real_estate", label: "عقار" },
              { value: "facility", label: "منشأة" },
              { value: "machinery", label: "آلات ومعدات" },
              { value: "other", label: "أخرى" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center gap-2 border rounded-lg p-3 cursor-pointer transition-colors ${formData.asset_type === opt.value ? "border-primary bg-primary/5" : "border-border"}`}>
                <RadioGroupItem value={opt.value} />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 2. Location ──
function SectionLocation({ formData, updateField, gpsLoading, gpsError, onCaptureGPS }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={2} title="بيانات الموقع" icon={MapPin} subtitle="تحديد موقع الأصل بدقة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="المدينة" required>
            <Input value={formData.city} onChange={e => updateField("city", e.target.value)} placeholder="مثال: الرياض" />
          </FieldGroup>
          <FieldGroup label="الحي" required>
            <Input value={formData.district} onChange={e => updateField("district", e.target.value)} placeholder="مثال: النرجس" />
          </FieldGroup>
        </div>

        <FieldGroup label="العنوان التفصيلي">
          <Textarea value={formData.detailed_address} onChange={e => updateField("detailed_address", e.target.value)} placeholder="العنوان التفصيلي للأصل..." rows={2} />
        </FieldGroup>

        <FieldGroup label="الإحداثيات (GPS)" required>
          {formData.gps_lat && formData.gps_lng ? (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center space-y-1 border border-green-200 dark:border-green-800">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">تم تحديد الموقع</p>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                {formData.gps_lat.toFixed(6)}, {formData.gps_lng.toFixed(6)}
              </p>
            </div>
          ) : gpsError ? (
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
              <p className="text-sm text-destructive mt-1">{gpsError}</p>
            </div>
          ) : null}
          <Button onClick={onCaptureGPS} disabled={gpsLoading} className="w-full h-12" variant={formData.gps_lat ? "outline" : "default"}>
            {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Navigation className="w-5 h-5 ml-2" />}
            {formData.gps_lat ? "إعادة تحديد الموقع" : "تحديد الموقع"}
          </Button>
        </FieldGroup>

        <FieldGroup label="سهولة الوصول">
          <RadioGroup value={formData.access_ease} onValueChange={v => updateField("access_ease", v)} className="flex gap-2">
            {[
              { value: "excellent", label: "ممتاز" },
              { value: "good", label: "جيد" },
              { value: "poor", label: "ضعيف" },
            ].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.access_ease === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 3. Verification ──
function SectionVerification({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={3} title="التحقق من الأصل" icon={Building2} subtitle="مطابقة الأصل الفعلي مع المستندات" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل الأصل مطابق للمستندات؟" required>
          <RadioGroup value={formData.matches_documents} onValueChange={v => updateField("matches_documents", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "yes" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />
              ✅ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "no" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />
              ❌ لا
            </label>
          </RadioGroup>
        </FieldGroup>

        {formData.matches_documents === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> تنبيه: عدم التطابق سيتم تصعيده تلقائياً
            </p>
          </div>
        )}

        <FieldGroup label="وصف الأصل" required>
          <Textarea value={formData.asset_description} onChange={e => updateField("asset_description", e.target.value)} placeholder="وصف تفصيلي للأصل المعاين..." rows={4} />
        </FieldGroup>

        <FieldGroup label="الاستخدام الحالي">
          <Input value={formData.current_use} onChange={e => updateField("current_use", e.target.value)} placeholder="مثال: سكني - فيلا مأهولة" />
        </FieldGroup>

        <FieldGroup label="الاستخدام الأعلى والأفضل (إن أمكن)">
          <Input value={formData.highest_best_use} onChange={e => updateField("highest_best_use", e.target.value)} placeholder="مثال: تجاري - موقع مناسب لمحلات" />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 4. Dimensions ──
function SectionDimensions({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={4} title="المساحات والأبعاد" icon={Ruler} subtitle="القياسات والمساحات الفعلية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="مساحة الأرض (م²)">
            <Input type="number" value={formData.land_area} onChange={e => updateField("land_area", e.target.value)} placeholder="0" />
          </FieldGroup>
          <FieldGroup label="المساحة المبنية (م²)">
            <Input type="number" value={formData.building_area} onChange={e => updateField("building_area", e.target.value)} placeholder="0" />
          </FieldGroup>
        </div>

        <FieldGroup label="عدد الأدوار">
          <Input type="number" value={formData.num_floors} onChange={e => updateField("num_floors", e.target.value)} placeholder="0" />
        </FieldGroup>

        <FieldGroup label="تفاصيل إضافية">
          <Textarea value={formData.dimensions_notes} onChange={e => updateField("dimensions_notes", e.target.value)} placeholder="عدد الوحدات، المواقف، الملاحق، السرداب..." rows={3} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 5. Condition ──
function SectionCondition({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={5} title="حالة الأصل" icon={Wrench} subtitle="تقييم الحالة الفعلية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="الحالة العامة" required>
          <RadioGroup value={formData.overall_condition} onValueChange={v => updateField("overall_condition", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "excellent", label: "ممتاز", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "good", label: "جيد", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
              { value: "average", label: "متوسط", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "poor", label: "سيء", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.overall_condition === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="عمر الأصل (بالسنوات)">
          <Input type="number" value={formData.asset_age} onChange={e => updateField("asset_age", e.target.value)} placeholder="مثال: 10" />
        </FieldGroup>

        <FieldGroup label="مستوى التشطيب">
          <Select value={formData.finishing_level} onValueChange={v => updateField("finishing_level", v)}>
            <SelectTrigger>
              <SelectValue placeholder="اختر مستوى التشطيب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="luxury">فاخر (لوكس)</SelectItem>
              <SelectItem value="super">سوبر ديلوكس</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="standard">عادي</SelectItem>
              <SelectItem value="under_construction">تحت الإنشاء</SelectItem>
              <SelectItem value="shell">عظم</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="ملاحظات الحالة">
          <Textarea value={formData.condition_notes} onChange={e => updateField("condition_notes", e.target.value)} placeholder="تفاصيل عن الحالة الإنشائية، التشطيبات، العيوب..." rows={3} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 6. Utilities & Checklist ──
function SectionUtilities({ formData, updateField, checklist, setChecklist }: any) {
  const categoryLabels: Record<string, string> = {
    structure: "الهيكل الإنشائي",
    utilities: "المرافق والخدمات",
    exterior: "الخارجي",
    interior: "الداخلي",
    compliance: "المطابقة",
  };
  const categories = [...new Set(checklist.map((c: ChecklistItem) => c.category))];

  const toggle = (index: number) => {
    const next = [...checklist];
    next[index].is_checked = !next[index].is_checked;
    setChecklist(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader num={6} title="المرافق والخدمات" icon={Zap} subtitle="توفر الخدمات الأساسية" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "electricity" as const, label: "كهرباء", icon: "⚡" },
            { key: "water" as const, label: "ماء", icon: "💧" },
            { key: "sewage" as const, label: "صرف صحي", icon: "🔧" },
            { key: "roads_paved" as const, label: "طرق معبدة", icon: "🛣️" },
          ].map(item => (
            <label key={item.key} className={`flex items-center justify-between border rounded-lg p-3 cursor-pointer transition-colors ${formData[item.key] ? "border-green-300 bg-green-50 dark:bg-green-900/20" : "border-border"}`}>
              <div className="flex items-center gap-2">
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formData[item.key] ? "متوفر" : "غير متوفر"}</span>
                <Checkbox checked={formData[item.key]} onCheckedChange={v => updateField(item.key, !!v)} />
              </div>
            </label>
          ))}

          <FieldGroup label="ملاحظات المرافق">
            <Textarea value={formData.utilities_notes} onChange={(e: any) => updateField("utilities_notes", e.target.value)} placeholder="ملاحظات إضافية..." rows={2} />
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" /> قائمة الفحص التفصيلية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((cat: string) => (
            <div key={cat}>
              <p className="text-xs font-bold text-muted-foreground mb-2">{categoryLabels[cat] || cat}</p>
              {checklist.map((item: ChecklistItem, idx: number) => {
                if (item.category !== cat) return null;
                return (
                  <label key={idx} className="flex items-start gap-3 cursor-pointer py-1.5">
                    <Checkbox checked={item.is_checked} onCheckedChange={() => toggle(idx)} className="mt-0.5" />
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-sm">{item.label_ar}</span>
                      {item.is_required && <Badge variant="secondary" className="text-[8px] px-1">مطلوب</Badge>}
                    </div>
                  </label>
                );
              })}
              <Separator className="my-2" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ── 7. Value Factors ──
function SectionValueFactors({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={7} title="العوامل المؤثرة على القيمة" icon={TrendingUp} subtitle="العوامل الإيجابية والسلبية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="إيجابيات الموقع">
          <Textarea value={formData.positive_factors} onChange={e => updateField("positive_factors", e.target.value)} placeholder="قرب من الخدمات، واجهة تجارية، شارع رئيسي..." rows={3} />
        </FieldGroup>
        <FieldGroup label="سلبيات الموقع">
          <Textarea value={formData.negative_factors} onChange={e => updateField("negative_factors", e.target.value)} placeholder="ضوضاء، ازدحام، بعد عن الخدمات..." rows={3} />
        </FieldGroup>
        <FieldGroup label="عوامل بيئية">
          <Textarea value={formData.environmental_factors} onChange={e => updateField("environmental_factors", e.target.value)} placeholder="تلوث، مصادر إزعاج، مناطق فيضانية..." rows={2} />
        </FieldGroup>
        <FieldGroup label="عوامل تنظيمية أو نظامية">
          <Textarea value={formData.regulatory_factors} onChange={e => updateField("regulatory_factors", e.target.value)} placeholder="قيود بناء، نزع ملكية، تغيير استخدام..." rows={2} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 8. Documentation (Photos) ──
function SectionDocumentation({ photos, saving, onCapture, onRemove, requiredPhotoDone, requiredPhotoTotal }: any) {
  const exteriorCats = PHOTO_CATEGORIES.filter(c => c.key.startsWith("exterior") || c.key === "street_view" || c.key === "surroundings");
  const interiorCats = PHOTO_CATEGORIES.filter(c => c.key.startsWith("interior"));

  return (
    <div className="space-y-4">
      <SectionHeader num={8} title="التوثيق المصور" icon={Camera} subtitle={`إجباري — ${requiredPhotoDone}/${requiredPhotoTotal} صور مطلوبة مكتملة`} />

      {requiredPhotoDone < requiredPhotoTotal && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          التوثيق المصور إلزامي — أكمل جميع الصور المطلوبة
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">📸 صور الموقع والأصل (خارجية)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {exteriorCats.map((cat: any) => (
            <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} saving={saving} onCapture={onCapture} onRemove={onRemove} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🏠 صور الأصل (داخلية)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {interiorCats.map((cat: any) => (
            <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} saving={saving} onCapture={onCapture} onRemove={onRemove} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PhotoCategoryRow({ cat, photos, saving, onCapture, onRemove }: any) {
  const catPhotos = photos.filter((p: PhotoItem) => p.category === cat.key);
  return (
    <div className={`border rounded-lg p-3 ${catPhotos.length > 0 ? "border-green-200 dark:border-green-800" : cat.required ? "border-yellow-200 dark:border-yellow-800" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{cat.label}</span>
          {cat.required && <Badge variant="secondary" className="text-[8px] px-1">مطلوب</Badge>}
        </div>
        <Badge variant={catPhotos.length > 0 ? "default" : "outline"} className="text-[10px]">
          {catPhotos.length} صور
        </Badge>
      </div>
      {catPhotos.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {catPhotos.map((p: PhotoItem) => (
            <div key={p.file_path} className="relative shrink-0 w-16 h-16 bg-muted rounded overflow-hidden group">
              {p.preview ? (
                <img src={p.preview} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <button onClick={() => onRemove(p)} className="absolute top-0 left-0 bg-destructive/80 text-white p-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => onCapture(cat.key, e.target.files)} disabled={saving} />
        <div className="flex items-center justify-center gap-2 h-10 border-2 border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          التقاط / رفع صورة
        </div>
      </label>
    </div>
  );
}

// ── 9. Risks ──
function SectionRisks({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={9} title="المخاطر والملاحظات" icon={ShieldAlert} subtitle="أي مخاطر تؤثر على التقييم" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل توجد مخاطر تؤثر على التقييم؟" required>
          <RadioGroup value={formData.has_risks} onValueChange={v => updateField("has_risks", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "yes" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />
              ⚠️ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "no" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />
              ✅ لا
            </label>
          </RadioGroup>
        </FieldGroup>

        {formData.has_risks === "yes" && (
          <FieldGroup label="تفصيل المخاطر" required>
            <Textarea value={formData.risk_details} onChange={e => updateField("risk_details", e.target.value)} placeholder="وصف تفصيلي للمخاطر المحددة..." rows={4} className="border-destructive/30" />
          </FieldGroup>
        )}
      </CardContent>
    </Card>
  );
}

// ── 10. Final Check ──
function SectionFinalCheck({ formData, updateField, sectionComplete, photos, checkedRequired, totalRequired }: any) {
  const reviewItems = [
    { label: "معلومات عامة", done: sectionComplete[0] },
    { label: "بيانات الموقع + GPS", done: sectionComplete[1] },
    { label: "التحقق من الأصل", done: sectionComplete[2] },
    { label: "المساحات والأبعاد", done: sectionComplete[3] },
    { label: "حالة الأصل", done: sectionComplete[4] },
    { label: "المرافق والخدمات", done: true },
    { label: "العوامل المؤثرة", done: true },
    { label: `التوثيق المصور (${photos.length} صورة)`, done: sectionComplete[7] },
    { label: "المخاطر", done: sectionComplete[8] },
    { label: `قائمة الفحص (${checkedRequired}/${totalRequired})`, done: checkedRequired === totalRequired },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={10} title="التحقق النهائي" icon={FileCheck} subtitle="مراجعة اكتمال جميع البيانات" />
      </CardHeader>
      <CardContent className="space-y-3">
        {reviewItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2">
              {item.done ? (
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
              )}
              <span className="text-sm">{item.label}</span>
            </div>
            <Badge variant={item.done ? "default" : "destructive"} className="text-[10px]">
              {item.done ? "مكتمل" : "ناقص"}
            </Badge>
          </div>
        ))}

        <Separator className="my-3" />

        <FieldGroup label="اكتمال البيانات" required>
          <RadioGroup value={formData.data_complete} onValueChange={v => updateField("data_complete", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "complete" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="complete" className="sr-only" />
              ✅ مكتمل
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "incomplete" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="incomplete" className="sr-only" />
              ⚠️ ناقص
            </label>
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="ملاحظات المعاين">
          <Textarea value={formData.inspector_final_notes} onChange={e => updateField("inspector_final_notes", e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

// ── 11. Approval ──
function SectionApproval({ formData, updateField, canSubmit, submitting, onSubmit }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={11} title="اعتماد المعاينة" icon={UserCheck} subtitle="تأكيد واعتماد المعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm font-bold text-primary">
            "جودة المعاينة = جودة التقييم"
          </p>
          <p className="text-xs text-muted-foreground">
            أقر بأن جميع البيانات المدخلة صحيحة ودقيقة وتعكس الواقع الفعلي للأصل
          </p>
        </div>

        <FieldGroup label="اسم المعاين" required>
          <Input value={formData.approval_inspector_name} onChange={e => updateField("approval_inspector_name", e.target.value)} placeholder="الاسم الكامل للمعاين" />
        </FieldGroup>

        <FieldGroup label="تاريخ الاعتماد">
          <Input type="date" value={formData.approval_date} onChange={e => updateField("approval_date", e.target.value)} />
        </FieldGroup>

        {!canSubmit && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
            يرجى إكمال جميع المتطلبات الإلزامية قبل الإرسال
          </div>
        )}

        <Separator />

        <Button onClick={onSubmit} disabled={!canSubmit || submitting} className="w-full h-14 text-lg">
          {submitting ? <Loader2 className="w-6 h-6 animate-spin ml-2" /> : <Send className="w-6 h-6 ml-2" />}
          إرسال واعتماد المعاينة
        </Button>

        <p className="text-[10px] text-muted-foreground text-center">
          🔴 بعد الإرسال سيتم تحليل البيانات تلقائياً بواسطة رقيم ولن يمكن التعديل
        </p>
      </CardContent>
    </Card>
  );
}
