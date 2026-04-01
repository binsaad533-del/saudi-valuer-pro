import { useState, useCallback, useEffect } from "react";
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
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft,
  Loader2, CheckCircle, AlertTriangle, Navigation, Trash2,
  Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck,
} from "lucide-react";
import SectionPhotoUpload, { type SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import AiSuggestionBox from "@/components/inspection/AiSuggestionBox";

/* ═══════ Constants ═══════ */

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

/* ═══════ Types ═══════ */

interface PhotoItem {
  category: string;
  file_name: string;
  preview: string;
}

interface ChecklistItem {
  category: string;
  label_ar: string;
  is_checked: boolean;
  is_required: boolean;
}

interface FormData {
  // Section 1: بيانات العقار الأساسية
  request_number: string;
  inspection_date: string;
  inspector_name: string;
  asset_type: string;
  deed_number: string;
  city: string;
  district: string;
  street: string;
  building_number: string;
  valuation_purpose: string;
  // Legacy/secondary
  assignment_ref: string;
  valuer_name: string;
  inspection_time: string;
  city: string;
  district: string;
  detailed_address: string;
  gps_lat: number | null;
  gps_lng: number | null;
  access_ease: string;
  matches_documents: string;
  asset_description: string;
  current_use: string;
  highest_best_use: string;
  land_area: string;
  building_area: string;
  num_floors: string;
  dimensions_notes: string;
  overall_condition: string;
  asset_age: string;
  finishing_level: string;
  condition_notes: string;
  electricity: boolean;
  water: boolean;
  sewage: boolean;
  roads_paved: boolean;
  utilities_notes: string;
  positive_factors: string;
  negative_factors: string;
  environmental_factors: string;
  regulatory_factors: string;
  has_risks: string;
  risk_details: string;
  data_complete: string;
  inspector_final_notes: string;
  confidential_notes: string;
  approval_inspector_name: string;
  approval_date: string;
}

const defaultFormData: FormData = {
  asset_type: "real_estate",
  deed_number: "",
  owner_name: "",
  property_use: "",
  property_number: "",
  plan_number: "",
  assignment_ref: "",
  valuer_name: "",
  inspector_name: "",
  inspection_date: new Date().toISOString().split("T")[0],
  inspection_time: new Date().toTimeString().slice(0, 5),
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
  confidential_notes: "",
  approval_inspector_name: "",
  approval_date: new Date().toISOString().split("T")[0],
};

/* ═══════ Helpers ═══════ */

function SectionHeader({ num, title, icon: Icon, subtitle }: { num: number; title: string; icon: any; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
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

/* ═══════ Main Component ═══════ */

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
      setPhotos(prev => [...prev, { category, file_name: file.name, preview: URL.createObjectURL(file) }]);
    }
    toast.success("تم إضافة الصور بنجاح");
  };

  const removePhoto = (photo: PhotoItem) => {
    setPhotos(prev => prev.filter(p => p !== photo));
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
    !!(formData.overall_condition),
    true,
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
    await new Promise(r => setTimeout(r, 1500));
    toast.success("تم إرسال المعاينة بنجاح ✅");
    localStorage.removeItem("field-inspection-data");
    setSubmitting(false);
  };

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
        {step === 0 && <SectionGeneral formData={formData} updateField={updateField} />}
        {step === 1 && <SectionLocation formData={formData} updateField={updateField} gpsLoading={gpsLoading} gpsError={gpsError} onCaptureGPS={captureGPS} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 2 && <SectionVerification formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 3 && <SectionDimensions formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 4 && <SectionCondition formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 5 && <SectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 6 && <SectionValueFactors formData={formData} updateField={updateField} />}
        {step === 7 && <SectionDocumentation photos={photos} onCapture={handlePhotoCapture} onRemove={removePhoto} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />}
        {step === 8 && <SectionRisks formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 9 && <SectionFinalCheck formData={formData} updateField={updateField} sectionComplete={sectionComplete} photos={photos} checkedRequired={checkedRequired} totalRequired={totalRequired} />}
        {step === 10 && <SectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />}
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

/* ═══════════════════════════════════════════
   Section Components
   ═══════════════════════════════════════════ */

function SectionGeneral({ formData, updateField }: { formData: FormData; updateField: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={1} title="بيانات العقار الأساسية" icon={Building2} subtitle="معلومات العقار والملكية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="نوع العقار" required>
          <RadioGroup value={formData.asset_type} onValueChange={v => updateField("asset_type", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "real_estate", label: "أرض" },
              { value: "villa", label: "فيلا" },
              { value: "apartment", label: "شقة" },
              { value: "commercial", label: "تجاري" },
              { value: "building", label: "عمارة" },
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
        <FieldGroup label="رقم الصك / العقد" required>
          <Input value={formData.deed_number} onChange={e => updateField("deed_number", e.target.value)} placeholder="أدخل رقم الصك أو العقد" />
        </FieldGroup>
        <FieldGroup label="اسم المالك" required>
          <Input value={formData.owner_name} onChange={e => updateField("owner_name", e.target.value)} placeholder="اسم مالك العقار" />
        </FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="رقم القطعة">
            <Input value={formData.property_number} onChange={e => updateField("property_number", e.target.value)} placeholder="رقم القطعة" />
          </FieldGroup>
          <FieldGroup label="رقم المخطط">
            <Input value={formData.plan_number} onChange={e => updateField("plan_number", e.target.value)} placeholder="رقم المخطط" />
          </FieldGroup>
        </div>
        <FieldGroup label="الاستخدام المحدد بالصك">
          <Input value={formData.property_use} onChange={e => updateField("property_use", e.target.value)} placeholder="مثال: سكني، تجاري، زراعي" />
        </FieldGroup>
        <Separator />
        <p className="text-xs text-muted-foreground font-medium">بيانات المعاينة</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="رقم المهمة">
            <Input value={formData.assignment_ref} onChange={e => updateField("assignment_ref", e.target.value)} placeholder="رقم المهمة" />
          </FieldGroup>
          <FieldGroup label="اسم المعاين" required>
            <Input value={formData.inspector_name} onChange={e => updateField("inspector_name", e.target.value)} placeholder="اسمك الكامل" />
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="تاريخ المعاينة" required>
            <Input type="date" value={formData.inspection_date} onChange={e => updateField("inspection_date", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="وقت المعاينة">
            <Input type="time" value={formData.inspection_time} onChange={e => updateField("inspection_time", e.target.value)} />
          </FieldGroup>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionLocation({ formData, updateField, gpsLoading, gpsError, onCaptureGPS, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={2} title="بيانات الموقع" icon={MapPin} subtitle="تحديد موقع الأصل بدقة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="المدينة" required>
            <Input value={formData.city} onChange={(e: any) => updateField("city", e.target.value)} placeholder="مثال: الرياض" />
          </FieldGroup>
          <FieldGroup label="الحي" required>
            <Input value={formData.district} onChange={(e: any) => updateField("district", e.target.value)} placeholder="مثال: النرجس" />
          </FieldGroup>
        </div>
        <FieldGroup label="العنوان التفصيلي">
          <Textarea value={formData.detailed_address} onChange={(e: any) => updateField("detailed_address", e.target.value)} placeholder="العنوان التفصيلي للأصل..." rows={2} />
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
          <RadioGroup value={formData.access_ease} onValueChange={(v: string) => updateField("access_ease", v)} className="flex gap-2">
            {[{ value: "excellent", label: "ممتاز" }, { value: "good", label: "جيد" }, { value: "poor", label: "ضعيف" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.access_ease === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        <SectionPhotoUpload section="location" label="صور الموقع والمحيط" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
      </CardContent>
    </Card>
  );
}

function SectionVerification({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={3} title="التحقق من الأصل" icon={Building2} subtitle="مطابقة الأصل الفعلي مع المستندات" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل الأصل مطابق للمستندات؟" required>
          <RadioGroup value={formData.matches_documents} onValueChange={(v: string) => updateField("matches_documents", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "yes" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />✅ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "no" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />❌ لا
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
          <Textarea value={formData.asset_description} onChange={(e: any) => updateField("asset_description", e.target.value)} placeholder="وصف تفصيلي للأصل المعاين..." rows={4} />
        </FieldGroup>
        <FieldGroup label="الاستخدام الحالي">
          <Input value={formData.current_use} onChange={(e: any) => updateField("current_use", e.target.value)} placeholder="مثال: سكني - فيلا مأهولة" />
        </FieldGroup>
        <FieldGroup label="الاستخدام الأعلى والأفضل (إن أمكن)">
          <Input value={formData.highest_best_use} onChange={(e: any) => updateField("highest_best_use", e.target.value)} placeholder="مثال: تجاري - موقع مناسب لمحلات" />
        </FieldGroup>
        <SectionPhotoUpload section="verification" label="صور التحقق من الأصل" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="verification"
          promptHint="تحقق من مطابقة الأصل للمستندات"
          context={{ matches_documents: formData.matches_documents, asset_description: formData.asset_description, current_use: formData.current_use }}
        />
      </CardContent>
    </Card>
  );
}

function SectionDimensions({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={4} title="المساحات والأبعاد" icon={Ruler} subtitle="القياسات والمساحات الفعلية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="مساحة الأرض (م²)">
            <Input type="number" value={formData.land_area} onChange={(e: any) => updateField("land_area", e.target.value)} placeholder="0" />
          </FieldGroup>
          <FieldGroup label="المساحة المبنية (م²)">
            <Input type="number" value={formData.building_area} onChange={(e: any) => updateField("building_area", e.target.value)} placeholder="0" />
          </FieldGroup>
        </div>
        <FieldGroup label="عدد الأدوار">
          <Input type="number" value={formData.num_floors} onChange={(e: any) => updateField("num_floors", e.target.value)} placeholder="0" />
        </FieldGroup>
        <FieldGroup label="تفاصيل إضافية">
          <Textarea value={formData.dimensions_notes} onChange={(e: any) => updateField("dimensions_notes", e.target.value)} placeholder="عدد الوحدات، المواقف، الملاحق، السرداب..." rows={3} />
        </FieldGroup>
        <SectionPhotoUpload section="dimensions" label="صور القياسات والمخططات" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="dimensions"
          promptHint="تحليل المساحات والأبعاد"
          context={{ land_area: formData.land_area, building_area: formData.building_area, num_floors: formData.num_floors }}
        />
      </CardContent>
    </Card>
  );
}

function SectionCondition({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={5} title="حالة الأصل" icon={Wrench} subtitle="تقييم الحالة الفعلية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="الحالة العامة" required>
          <RadioGroup value={formData.overall_condition} onValueChange={(v: string) => updateField("overall_condition", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "excellent", label: "ممتاز", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "good", label: "جيد", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
              { value: "average", label: "متوسط", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "poor", label: "سيء", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.overall_condition === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        <FieldGroup label="عمر الأصل (بالسنوات)">
          <Input type="number" value={formData.asset_age} onChange={(e: any) => updateField("asset_age", e.target.value)} placeholder="مثال: 10" />
        </FieldGroup>
        <FieldGroup label="مستوى التشطيب">
          <Select value={formData.finishing_level} onValueChange={(v: string) => updateField("finishing_level", v)}>
            <SelectTrigger><SelectValue placeholder="اختر مستوى التشطيب" /></SelectTrigger>
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
          <Textarea value={formData.condition_notes} onChange={(e: any) => updateField("condition_notes", e.target.value)} placeholder="تفاصيل عن الحالة الإنشائية، التشطيبات، العيوب..." rows={3} />
        </FieldGroup>
        <SectionPhotoUpload section="condition" label="صور حالة الأصل والعيوب" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="condition"
          promptHint="تقييم حالة الأصل"
          context={{ overall_condition: formData.overall_condition, asset_age: formData.asset_age, finishing_level: formData.finishing_level, condition_notes: formData.condition_notes }}
        />
      </CardContent>
    </Card>
  );
}

function SectionUtilities({ formData, updateField, checklist, setChecklist, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
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
                <Checkbox checked={formData[item.key]} onCheckedChange={(v: any) => updateField(item.key, !!v)} />
              </div>
            </label>
          ))}
          <FieldGroup label="ملاحظات المرافق">
            <Textarea value={formData.utilities_notes} onChange={(e: any) => updateField("utilities_notes", e.target.value)} placeholder="ملاحظات إضافية..." rows={2} />
          </FieldGroup>
        </CardContent>
      </Card>

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
      <SectionPhotoUpload section="utilities" label="صور المرافق والخدمات" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
    </div>
  );
}

function SectionValueFactors({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={7} title="العوامل المؤثرة على القيمة" icon={TrendingUp} subtitle="العوامل الإيجابية والسلبية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="إيجابيات الموقع">
          <Textarea value={formData.positive_factors} onChange={(e: any) => updateField("positive_factors", e.target.value)} placeholder="قرب من الخدمات، واجهة تجارية، شارع رئيسي..." rows={3} />
        </FieldGroup>
        <FieldGroup label="سلبيات الموقع">
          <Textarea value={formData.negative_factors} onChange={(e: any) => updateField("negative_factors", e.target.value)} placeholder="ضوضاء، ازدحام، بعد عن الخدمات..." rows={3} />
        </FieldGroup>
        <FieldGroup label="عوامل بيئية">
          <Textarea value={formData.environmental_factors} onChange={(e: any) => updateField("environmental_factors", e.target.value)} placeholder="تلوث، مصادر إزعاج، مناطق فيضانية..." rows={2} />
        </FieldGroup>
        <FieldGroup label="عوامل تنظيمية أو نظامية">
          <Textarea value={formData.regulatory_factors} onChange={(e: any) => updateField("regulatory_factors", e.target.value)} placeholder="قيود بناء، نزع ملكية، تغيير استخدام..." rows={2} />
        </FieldGroup>
        <AiSuggestionBox
          sectionKey="value_factors"
          promptHint="تحليل العوامل المؤثرة على القيمة"
          context={{ positive_factors: formData.positive_factors, negative_factors: formData.negative_factors }}
        />
      </CardContent>
    </Card>
  );
}

function SectionDocumentation({ photos, onCapture, onRemove, requiredPhotoDone, requiredPhotoTotal }: any) {
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
        <CardHeader className="pb-2"><CardTitle className="text-sm">📸 صور خارجية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {exteriorCats.map((cat) => (
            <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} onCapture={onCapture} onRemove={onRemove} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">🏠 صور داخلية</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {interiorCats.map((cat) => (
            <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} onCapture={onCapture} onRemove={onRemove} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function PhotoCategoryRow({ cat, photos, onCapture, onRemove }: any) {
  const catPhotos = photos.filter((p: PhotoItem) => p.category === cat.key);
  return (
    <div className={`border rounded-lg p-3 ${catPhotos.length > 0 ? "border-green-200 dark:border-green-800" : cat.required ? "border-yellow-200 dark:border-yellow-800" : "border-border"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{cat.label}</span>
          {cat.required && <Badge variant="secondary" className="text-[8px] px-1">مطلوب</Badge>}
        </div>
        <Badge variant={catPhotos.length > 0 ? "default" : "outline"} className="text-[10px]">{catPhotos.length} صور</Badge>
      </div>
      {catPhotos.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
          {catPhotos.map((p: PhotoItem, i: number) => (
            <div key={i} className="relative shrink-0 w-16 h-16 bg-muted rounded overflow-hidden group">
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              <button onClick={() => onRemove(p)} className="absolute top-0 left-0 bg-destructive/80 text-white p-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <label className="block">
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => onCapture(cat.key, e.target.files)} />
        <div className="flex items-center justify-center gap-2 h-10 border-2 border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors">
          <Camera className="w-4 h-4" /> التقاط / رفع صورة
        </div>
      </label>
    </div>
  );
}

function SectionRisks({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={9} title="المخاطر والملاحظات" icon={ShieldAlert} subtitle="أي مخاطر تؤثر على التقييم" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل توجد مخاطر تؤثر على التقييم؟" required>
          <RadioGroup value={formData.has_risks} onValueChange={(v: string) => updateField("has_risks", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "yes" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />⚠️ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "no" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />✅ لا
            </label>
          </RadioGroup>
        </FieldGroup>
        {formData.has_risks === "yes" && (
          <FieldGroup label="تفصيل المخاطر" required>
            <Textarea value={formData.risk_details} onChange={(e: any) => updateField("risk_details", e.target.value)} placeholder="وصف تفصيلي للمخاطر المحددة..." rows={4} className="border-destructive/30" />
          </FieldGroup>
        )}
        <SectionPhotoUpload section="risks" label="صور المخاطر المكتشفة" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="risks"
          promptHint="تحليل المخاطر"
          context={{ has_risks: formData.has_risks, risk_details: formData.risk_details }}
        />
      </CardContent>
    </Card>
  );
}

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
              {item.done ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />}
              <span className="text-sm">{item.label}</span>
            </div>
            <Badge variant={item.done ? "default" : "destructive"} className="text-[10px]">{item.done ? "مكتمل" : "ناقص"}</Badge>
          </div>
        ))}
        <Separator className="my-3" />
        <FieldGroup label="اكتمال البيانات" required>
          <RadioGroup value={formData.data_complete} onValueChange={(v: string) => updateField("data_complete", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "complete" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="complete" className="sr-only" />✅ مكتمل
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "incomplete" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="incomplete" className="sr-only" />⚠️ ناقص
            </label>
          </RadioGroup>
        </FieldGroup>
        <FieldGroup label="ملاحظات المعاين">
          <Textarea value={formData.inspector_final_notes} onChange={(e: any) => updateField("inspector_final_notes", e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
        </FieldGroup>
        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">ملاحظات سرية (للمقيّم فقط — لا تُضاف للتقرير)</span>
          </div>
          <Textarea
            value={formData.confidential_notes}
            onChange={(e: any) => updateField("confidential_notes", e.target.value)}
            placeholder="ملاحظات خاصة لا تظهر في التقرير النهائي... (مثال: شكوك حول صحة المستندات، ملاحظات شخصية)"
            rows={3}
            className="border-amber-200 dark:border-amber-800 bg-white dark:bg-background"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionApproval({ formData, updateField, canSubmit, submitting, onSubmit }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={11} title="اعتماد المعاينة" icon={UserCheck} subtitle="تأكيد واعتماد المعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm font-bold text-primary">"جودة المعاينة = جودة التقييم"</p>
          <p className="text-xs text-muted-foreground">أقر بأن جميع البيانات المدخلة صحيحة ودقيقة وتعكس الواقع الفعلي للأصل</p>
        </div>
        <FieldGroup label="اسم المعاين" required>
          <Input value={formData.approval_inspector_name} onChange={(e: any) => updateField("approval_inspector_name", e.target.value)} placeholder="الاسم الكامل للمعاين" />
        </FieldGroup>
        <FieldGroup label="تاريخ الاعتماد">
          <Input type="date" value={formData.approval_date} onChange={(e: any) => updateField("approval_date", e.target.value)} />
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
          بالضغط على "إرسال" فإنك تقر بصحة جميع البيانات المدخلة
        </p>
      </CardContent>
    </Card>
  );
}
