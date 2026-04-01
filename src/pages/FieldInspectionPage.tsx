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
  FileCheck, UserCheck, Home, Upload,
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
  { key: "exterior", label: "المبنى - الخارج", icon: Home, num: 5 },
  { key: "interior", label: "المبنى - الداخل", icon: Building2, num: 6 },
  { key: "condition", label: "حالة الأصل", icon: Wrench, num: 7 },
  { key: "utilities", label: "المرافق", icon: Zap, num: 8 },
  { key: "value_factors", label: "العوامل المؤثرة", icon: TrendingUp, num: 9 },
  { key: "documentation", label: "التوثيق", icon: Camera, num: 10 },
  { key: "risks", label: "المخاطر", icon: ShieldAlert, num: 11 },
  { key: "final_check", label: "التحقق النهائي", icon: FileCheck, num: 12 },
  { key: "approval", label: "الاعتماد", icon: UserCheck, num: 13 },
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
  detailed_address: string;
  // Section 2: الموقع والمحيط
  district_type: string;
  district_level: string;
  nearby_mosque: string;
  nearby_mosque_distance: string;
  nearby_school: string;
  nearby_school_distance: string;
  nearby_hospital: string;
  nearby_hospital_distance: string;
  nearby_mall: string;
  nearby_mall_distance: string;
  nearby_highway: string;
  nearby_highway_distance: string;
  gps_lat: number | null;
  gps_lng: number | null;
  access_ease: string;
  surrounding_positives: string;
  surrounding_negatives: string;
  location_confidential_notes: string;
  matches_documents: string;
  asset_description: string;
  current_use: string;
  highest_best_use: string;
  total_area: string;
  front_north_length: string;
  front_north_desc: string;
  front_north_boundary: string;
  front_north_plate: string;
  front_south_length: string;
  front_south_desc: string;
  front_south_boundary: string;
  front_south_plate: string;
  front_east_length: string;
  front_east_desc: string;
  front_east_boundary: string;
  front_east_plate: string;
  front_west_length: string;
  front_west_desc: string;
  front_west_boundary: string;
  front_west_plate: string;
  area_matches_deed: string;
  land_area: string;
  building_area: string;
  num_floors: string;
  dimensions_notes: string;
  // Section 5: المبنى - الخارج
  exterior_building_age: string;
  exterior_num_floors: string;
  exterior_structure_type: string;
  exterior_facade_finishing: string;
  exterior_facade_material: string;
  exterior_facade_condition: string;
  exterior_paint_condition: string;
  exterior_windows_type: string;
  exterior_windows_condition: string;
  exterior_doors_type: string;
  exterior_doors_condition: string;
  exterior_roof_type: string;
  exterior_roof_condition: string;
  exterior_roof_insulation: string;
  exterior_roof_leaks: string;
  exterior_fence_type: string;
  exterior_fence_condition: string;
  exterior_parking: string;
  exterior_parking_count: string;
  exterior_parking_condition: string;
  exterior_main_entrance_type: string;
  exterior_main_entrance_condition: string;
  exterior_landscaping: string;
  exterior_entrance_count: string;
  exterior_notes: string;
  // Section 6: المبنى - الداخل
  interior_floors_type: string;
  interior_floors_condition: string;
  interior_walls_type: string;
  interior_walls_condition: string;
  interior_ceilings_type: string;
  interior_ceilings_condition: string;
  interior_kitchen_type: string;
  interior_kitchen_condition: string;
  interior_bathrooms_count: string;
  interior_bathrooms_condition: string;
  interior_doors_type: string;
  interior_doors_condition: string;
  interior_windows_type: string;
  interior_windows_condition: string;
  interior_stairs_type: string;
  interior_stairs_condition: string;
  interior_ac_type: string;
  interior_ac_condition: string;
  interior_electrical_condition: string;
  interior_plumbing_condition: string;
  interior_rooms_count: string;
  interior_halls_count: string;
  interior_bathrooms_count_num: string;
  interior_kitchens_count: string;
  interior_overall_finishing: string;
  interior_notes: string;
  overall_condition: string;
  asset_age: string;
  finishing_level: string;
  condition_notes: string;
  electricity_status: string;
  electricity_condition: string;
  water_source: string;
  water_condition: string;
  sewage_type: string;
  sewage_condition: string;
  roads_paved: boolean;
  gas_status: string;
  internet_status: string;
  central_ac_status: string;
  elevator_status: string;
  elevator_count: string;
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
  request_number: `INS-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  inspection_date: new Date().toISOString().split("T")[0],
  inspector_name: "",
  asset_type: "",
  deed_number: "",
  city: "",
  district: "",
  street: "",
  building_number: "",
  valuation_purpose: "",
  assignment_ref: "",
  valuer_name: "",
  inspection_time: new Date().toTimeString().slice(0, 5),
  detailed_address: "",
  district_type: "",
  district_level: "",
  nearby_mosque: "",
  nearby_mosque_distance: "",
  nearby_school: "",
  nearby_school_distance: "",
  nearby_hospital: "",
  nearby_hospital_distance: "",
  nearby_mall: "",
  nearby_mall_distance: "",
  nearby_highway: "",
  nearby_highway_distance: "",
  gps_lat: null,
  gps_lng: null,
  access_ease: "",
  surrounding_positives: "",
  surrounding_negatives: "",
  location_confidential_notes: "",
  matches_documents: "",
  asset_description: "",
  current_use: "",
  highest_best_use: "",
  total_area: "",
  front_north_length: "",
  front_north_desc: "",
  front_north_boundary: "",
  front_north_plate: "",
  front_south_length: "",
  front_south_desc: "",
  front_south_boundary: "",
  front_south_plate: "",
  front_east_length: "",
  front_east_desc: "",
  front_east_boundary: "",
  front_east_plate: "",
  front_west_length: "",
  front_west_desc: "",
  front_west_boundary: "",
  front_west_plate: "",
  area_matches_deed: "",
  land_area: "",
  building_area: "",
  num_floors: "",
  dimensions_notes: "",
  exterior_building_age: "",
  exterior_num_floors: "",
  exterior_structure_type: "",
  exterior_facade_finishing: "",
  exterior_facade_material: "",
  exterior_facade_condition: "",
  exterior_paint_condition: "",
  exterior_windows_type: "",
  exterior_windows_condition: "",
  exterior_doors_type: "",
  exterior_doors_condition: "",
  exterior_roof_type: "",
  exterior_roof_condition: "",
  exterior_roof_insulation: "",
  exterior_roof_leaks: "",
  exterior_fence_type: "",
  exterior_fence_condition: "",
  exterior_parking: "",
  exterior_parking_count: "",
  exterior_parking_condition: "",
  exterior_main_entrance_type: "",
  exterior_main_entrance_condition: "",
  exterior_landscaping: "",
  exterior_entrance_count: "",
  exterior_notes: "",
  interior_floors_type: "",
  interior_floors_condition: "",
  interior_walls_type: "",
  interior_walls_condition: "",
  interior_ceilings_type: "",
  interior_ceilings_condition: "",
  interior_kitchen_type: "",
  interior_kitchen_condition: "",
  interior_bathrooms_count: "",
  interior_bathrooms_condition: "",
  interior_doors_type: "",
  interior_doors_condition: "",
  interior_windows_type: "",
  interior_windows_condition: "",
  interior_stairs_type: "",
  interior_stairs_condition: "",
  interior_ac_type: "",
  interior_ac_condition: "",
  interior_electrical_condition: "",
  interior_plumbing_condition: "",
  interior_rooms_count: "",
  interior_halls_count: "",
  interior_bathrooms_count_num: "",
  interior_kitchens_count: "",
  interior_overall_finishing: "",
  interior_notes: "",
  overall_condition: "",
  asset_age: "",
  finishing_level: "",
  condition_notes: "",
  electricity_status: "",
  electricity_condition: "",
  water_source: "",
  water_condition: "",
  sewage_type: "",
  sewage_condition: "",
  roads_paved: false,
  gas_status: "",
  internet_status: "",
  central_ac_status: "",
  elevator_status: "",
  elevator_count: "",
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
    !!(formData.exterior_facade_material),
    !!(formData.interior_floors_type),
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
        {step === 4 && <SectionExterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 5 && <SectionInterior formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 6 && <SectionCondition formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 7 && <SectionUtilities formData={formData} updateField={updateField} checklist={checklist} setChecklist={setChecklist} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 8 && <SectionValueFactors formData={formData} updateField={updateField} />}
        {step === 9 && <SectionDocumentation photos={photos} onCapture={handlePhotoCapture} onRemove={removePhoto} requiredPhotoDone={requiredPhotoDone} requiredPhotoTotal={requiredPhotoTotal} />}
        {step === 10 && <SectionRisks formData={formData} updateField={updateField} sectionPhotos={sectionPhotos} onAddPhoto={addSectionPhoto} onRemovePhoto={removeSectionPhoto} />}
        {step === 11 && <SectionFinalCheck formData={formData} updateField={updateField} sectionComplete={sectionComplete} photos={photos} checkedRequired={checkedRequired} totalRequired={totalRequired} />}
        {step === 12 && <SectionApproval formData={formData} updateField={updateField} canSubmit={canSubmit()} submitting={submitting} onSubmit={handleSubmit} />}
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
        <SectionHeader num={1} title="بيانات العقار الأساسية" icon={Building2} subtitle="معلومات العقار والمعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* رقم الطلب التلقائي */}
        <div className="bg-muted/50 border rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">رقم الطلب</span>
          <Badge variant="secondary" className="font-mono text-sm">{formData.request_number}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="تاريخ المعاينة" required>
            <Input type="date" value={formData.inspection_date} onChange={e => updateField("inspection_date", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="اسم المعاين" required>
            <Input value={formData.inspector_name} onChange={e => updateField("inspector_name", e.target.value)} placeholder="الاسم الكامل" />
          </FieldGroup>
        </div>

        <FieldGroup label="نوع العقار" required>
          <RadioGroup value={formData.asset_type} onValueChange={v => updateField("asset_type", v)} className="grid grid-cols-3 gap-2">
            {[
              { value: "apartment", label: "شقة" },
              { value: "villa", label: "فيلا" },
              { value: "land", label: "أرض" },
              { value: "commercial", label: "تجاري" },
              { value: "industrial", label: "صناعي" },
              { value: "other", label: "أخرى" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-1.5 border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.asset_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="رقم الصك" required>
          <Input value={formData.deed_number} onChange={e => updateField("deed_number", e.target.value)} placeholder="أدخل رقم الصك" />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="المدينة" required>
            <Input value={formData.city} onChange={e => updateField("city", e.target.value)} placeholder="مثال: الرياض" />
          </FieldGroup>
          <FieldGroup label="الحي" required>
            <Input value={formData.district} onChange={e => updateField("district", e.target.value)} placeholder="مثال: النرجس" />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="الشارع">
            <Input value={formData.street} onChange={e => updateField("street", e.target.value)} placeholder="اسم أو رقم الشارع" />
          </FieldGroup>
          <FieldGroup label="رقم المبنى">
            <Input value={formData.building_number} onChange={e => updateField("building_number", e.target.value)} placeholder="رقم المبنى" />
          </FieldGroup>
        </div>

        <FieldGroup label="الغرض من التقييم" required>
          <Select value={formData.valuation_purpose} onValueChange={v => updateField("valuation_purpose", v)}>
            <SelectTrigger><SelectValue placeholder="اختر الغرض من التقييم" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mortgage">رهن عقاري</SelectItem>
              <SelectItem value="sale">بيع / شراء</SelectItem>
              <SelectItem value="insurance">تأمين</SelectItem>
              <SelectItem value="zakat">زكاة</SelectItem>
              <SelectItem value="financial_reporting">قوائم مالية</SelectItem>
              <SelectItem value="dispute">نزاع / تقاضي</SelectItem>
              <SelectItem value="investment">استثمار</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function SectionLocation({ formData, updateField, gpsLoading, gpsError, onCaptureGPS, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const nearbyServices = [
    { key: "mosque", label: "مسجد", icon: "🕌" },
    { key: "school", label: "مدرسة", icon: "🏫" },
    { key: "hospital", label: "مستشفى", icon: "🏥" },
    { key: "mall", label: "مول / مركز تجاري", icon: "🛒" },
    { key: "highway", label: "طريق رئيسي", icon: "🛣️" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={2} title="الموقع والمحيط" icon={MapPin} subtitle="وصف الحي والخدمات المحيطة" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* نوع الحي */}
        <FieldGroup label="نوع الحي" required>
          <RadioGroup value={formData.district_type} onValueChange={(v: string) => updateField("district_type", v)} className="flex gap-2">
            {[{ value: "residential", label: "سكني" }, { value: "commercial", label: "تجاري" }, { value: "mixed", label: "مختلط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.district_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        {/* مستوى الحي */}
        <FieldGroup label="مستوى الحي" required>
          <RadioGroup value={formData.district_level} onValueChange={(v: string) => updateField("district_level", v)} className="flex gap-2">
            {[{ value: "upscale", label: "راقي" }, { value: "average", label: "متوسط" }, { value: "popular", label: "شعبي" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.district_level === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        {/* قرب الخدمات */}
        <p className="text-xs font-bold text-muted-foreground">قرب الخدمات</p>
        <div className="space-y-3">
          {nearbyServices.map(svc => {
            const fieldYes = `nearby_${svc.key}` as keyof typeof formData;
            const fieldDist = `nearby_${svc.key}_distance` as keyof typeof formData;
            const isYes = formData[fieldYes] === "yes";
            return (
              <div key={svc.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">{svc.icon} {svc.label}</span>
                  <RadioGroup value={String(formData[fieldYes] || "")} onValueChange={(v: string) => updateField(fieldYes, v)} className="flex gap-1.5">
                    <label className={`px-3 py-1 border rounded-md text-xs cursor-pointer transition-colors ${isYes ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
                      <RadioGroupItem value="yes" className="sr-only" />نعم
                    </label>
                    <label className={`px-3 py-1 border rounded-md text-xs cursor-pointer transition-colors ${formData[fieldYes] === "no" ? "border-muted-foreground bg-muted font-medium" : "border-border"}`}>
                      <RadioGroupItem value="no" className="sr-only" />لا
                    </label>
                  </RadioGroup>
                </div>
                {isYes && (
                  <Input
                    value={String(formData[fieldDist] || "")}
                    onChange={(e: any) => updateField(fieldDist, e.target.value)}
                    placeholder="المسافة التقريبية (مثال: 500 متر)"
                    className="h-8 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* GPS */}
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

        <Separator />

        <FieldGroup label="✅ إيجابيات المحيط">
          <Textarea value={formData.surrounding_positives} onChange={(e: any) => updateField("surrounding_positives", e.target.value)} placeholder="مثال: قرب من مدارس ومساجد، شوارع مسفلتة، إنارة جيدة، حدائق..." rows={3} />
        </FieldGroup>
        <FieldGroup label="⚠️ سلبيات المحيط">
          <Textarea value={formData.surrounding_negatives} onChange={(e: any) => updateField("surrounding_negatives", e.target.value)} placeholder="مثال: ضوضاء، ازدحام مروري، قرب من محطة كهرباء، أرض فضاء مهملة..." rows={3} />
        </FieldGroup>

        <SectionPhotoUpload section="location" label="صور الموقع والمحيط" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

        <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">ملاحظات الموقع للمعاين (سرية — للمقيّم فقط)</span>
          </div>
          <Textarea
            value={formData.location_confidential_notes}
            onChange={(e: any) => updateField("location_confidential_notes", e.target.value)}
            placeholder="ملاحظات سرية عن الموقع لا تظهر في التقرير..."
            rows={2}
            className="border-amber-200 dark:border-amber-800 bg-white dark:bg-background"
          />
        </div>

        <AiSuggestionBox
          sectionKey="location"
          promptHint="تحليل الموقع والمحيط والخدمات القريبة"
          context={{
            district_type: formData.district_type,
            district_level: formData.district_level,
            nearby_mosque: formData.nearby_mosque,
            nearby_school: formData.nearby_school,
            nearby_hospital: formData.nearby_hospital,
            nearby_mall: formData.nearby_mall,
            nearby_highway: formData.nearby_highway,
            surrounding_positives: formData.surrounding_positives,
            surrounding_negatives: formData.surrounding_negatives,
            access_ease: formData.access_ease,
          }}
        />
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
  const facades = [
    { key: "north", label: "الشمال", icon: "⬆️" },
    { key: "south", label: "الجنوب", icon: "⬇️" },
    { key: "east", label: "الشرق", icon: "➡️" },
    { key: "west", label: "الغرب", icon: "⬅️" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={4} title="الحدود والمساحة" icon={Ruler} subtitle="المساحة الإجمالية وأطوال الواجهات" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="المساحة الإجمالية (م²)" required>
          <Input type="number" value={formData.total_area} onChange={(e: any) => updateField("total_area", e.target.value)} placeholder="مثال: 625" />
        </FieldGroup>

        <Separator />
        <p className="text-xs font-bold text-muted-foreground">الواجهات والحدود</p>

        {facades.map(f => {
          const lengthKey = `front_${f.key}_length` as keyof typeof formData;
          const descKey = `front_${f.key}_desc` as keyof typeof formData;
          const boundaryKey = `front_${f.key}_boundary` as keyof typeof formData;
          const plateKey = `front_${f.key}_plate` as keyof typeof formData;
          const isStreet = formData[boundaryKey] === "street";
          return (
            <div key={f.key} className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">{f.icon} {f.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">الطول (م)</Label>
                  <Input type="number" value={String(formData[lengthKey] || "")} onChange={(e: any) => updateField(lengthKey, e.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">نوع الحد</Label>
                  <Select value={String(formData[boundaryKey] || "")} onValueChange={(v: string) => updateField(boundaryKey, v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="street">شارع</SelectItem>
                      <SelectItem value="neighbor">جار</SelectItem>
                      <SelectItem value="wall">سور</SelectItem>
                      <SelectItem value="passage">ممر</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">يطل على</Label>
                <Input value={String(formData[descKey] || "")} onChange={(e: any) => updateField(descKey, e.target.value)} placeholder="وصف: شارع 15م / جار عبدالله / ..." className="mt-1" />
              </div>
              {isStreet && (
                <div>
                  <Label className="text-xs text-muted-foreground">رقم لوحة الشارع (إن وجدت)</Label>
                  <Input value={String(formData[plateKey] || "")} onChange={(e: any) => updateField(plateKey, e.target.value)} placeholder="مثال: شارع 25" className="mt-1" />
                </div>
              )}
            </div>
          );
        })}

        <Separator />

        <FieldGroup label="تطابق المساحة مع الصك" required>
          <RadioGroup value={formData.area_matches_deed} onValueChange={(v: string) => updateField("area_matches_deed", v)} className="flex gap-2">
            {[{ value: "yes", label: "✅ نعم" }, { value: "no", label: "❌ لا" }, { value: "slight_diff", label: "↔️ فرق بسيط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.area_matches_deed === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.area_matches_deed === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> تنبيه: عدم تطابق المساحة يستوجب توثيق الفارق بالتفصيل
            </p>
          </div>
        )}

        <Separator />

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
        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.dimensions_notes} onChange={(e: any) => updateField("dimensions_notes", e.target.value)} placeholder="عدد الوحدات، المواقف، الملاحق، السرداب..." rows={3} />
        </FieldGroup>

        {/* رفع صورة مخطط الموقع */}
        <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">رفع صورة مخطط الموقع</span>
          </div>
          <p className="text-xs text-muted-foreground">أرفق مخطط الموقع المعتمد أو الكروكي (صورة أو مسح ضوئي)</p>
          <SectionPhotoUpload section="site_plan" label="مخطط الموقع" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        </div>

        <SectionPhotoUpload section="dimensions" label="صور القياسات والمخططات" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="dimensions"
          promptHint="تحليل الحدود والمساحات"
          context={{ total_area: formData.total_area, land_area: formData.land_area, building_area: formData.building_area, num_floors: formData.num_floors, front_north_length: formData.front_north_length, front_south_length: formData.front_south_length, front_east_length: formData.front_east_length, front_west_length: formData.front_west_length }}
        />
      </CardContent>
    </Card>
  );
}

function SectionExterior({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const conditionOptions = [
    { value: "excellent", label: "ممتازة" },
    { value: "good", label: "جيدة" },
    { value: "acceptable", label: "مقبولة" },
    { value: "poor", label: "رديئة" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={5} title="المبنى - الخارج" icon={Home} subtitle="وصف مكونات المبنى الخارجية وحالتها" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* بيانات المبنى الأساسية */}
        <p className="text-xs font-bold text-muted-foreground">🏢 بيانات المبنى الأساسية</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="عمر المبنى (سنة)" required>
            <Input type="number" value={formData.exterior_building_age} onChange={(e: any) => updateField("exterior_building_age", e.target.value)} placeholder="مثال: 10" />
          </FieldGroup>
          <FieldGroup label="عدد الأدوار" required>
            <Input type="number" value={formData.exterior_num_floors} onChange={(e: any) => updateField("exterior_num_floors", e.target.value)} placeholder="مثال: 3" />
          </FieldGroup>
        </div>
        <FieldGroup label="نوع الهيكل الإنشائي" required>
          <RadioGroup value={formData.exterior_structure_type} onValueChange={(v: string) => updateField("exterior_structure_type", v)} className="flex gap-2">
            {[{ value: "concrete", label: "خرساني" }, { value: "steel", label: "حديدي" }, { value: "wood", label: "خشبي" }, { value: "mixed", label: "مختلط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-xs transition-colors ${formData.exterior_structure_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        {/* الواجهة */}
        <p className="text-xs font-bold text-muted-foreground">🏗️ الواجهة الخارجية</p>
        <FieldGroup label="مادة الواجهة" required>
          <Select value={formData.exterior_facade_material} onValueChange={(v: string) => updateField("exterior_facade_material", v)}>
            <SelectTrigger><SelectValue placeholder="اختر مادة الواجهة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stone">حجر</SelectItem>
              <SelectItem value="brick">طوب</SelectItem>
              <SelectItem value="plaster">لياسة / بياض</SelectItem>
              <SelectItem value="glass">زجاج</SelectItem>
              <SelectItem value="cladding">كلادينج</SelectItem>
              <SelectItem value="mixed">مختلط</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="حالة الواجهة">
          <RadioGroup value={formData.exterior_facade_condition} onValueChange={(v: string) => updateField("exterior_facade_condition", v)} className="flex gap-2">
            {conditionOptions.map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_facade_condition === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="نوع تشطيب الواجهة">
          <Select value={formData.exterior_facade_finishing} onValueChange={(v: string) => updateField("exterior_facade_finishing", v)}>
            <SelectTrigger><SelectValue placeholder="اختر نوع التشطيب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paint">دهان</SelectItem>
              <SelectItem value="stone_cladding">تكسية حجرية</SelectItem>
              <SelectItem value="marble">رخام</SelectItem>
              <SelectItem value="ceramic">سيراميك</SelectItem>
              <SelectItem value="grc">GRC</SelectItem>
              <SelectItem value="curtain_wall">حائط ستائري (زجاج)</SelectItem>
              <SelectItem value="composite">مركّب / مختلط</SelectItem>
              <SelectItem value="none">بدون تشطيب</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="حالة الدهان الخارجي">
          <RadioGroup value={formData.exterior_paint_condition} onValueChange={(v: string) => updateField("exterior_paint_condition", v)} className="flex gap-2">
            {conditionOptions.map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_paint_condition === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        {/* النوافذ والأبواب */}
        <p className="text-xs font-bold text-muted-foreground">🪟 النوافذ والأبواب</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع النوافذ">
            <Select value={formData.exterior_windows_type} onValueChange={(v: string) => updateField("exterior_windows_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="upvc">UPVC</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة النوافذ">
            <Select value={formData.exterior_windows_condition} onValueChange={(v: string) => updateField("exterior_windows_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأبواب الخارجية">
            <Select value={formData.exterior_doors_type} onValueChange={(v: string) => updateField("exterior_doors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="glass">زجاج</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأبواب">
            <Select value={formData.exterior_doors_condition} onValueChange={(v: string) => updateField("exterior_doors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <Separator />

        {/* السطح */}
        <p className="text-xs font-bold text-muted-foreground">🏠 السطح</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السطح">
            <Select value={formData.exterior_roof_type} onValueChange={(v: string) => updateField("exterior_roof_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concrete">خرساني</SelectItem>
                <SelectItem value="steel">حديد / معدني</SelectItem>
                <SelectItem value="tiles">قرميد</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السطح">
            <Select value={formData.exterior_roof_condition} onValueChange={(v: string) => updateField("exterior_roof_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="العزل">
            <Select value={formData.exterior_roof_insulation} onValueChange={(v: string) => updateField("exterior_roof_insulation", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal_water">حراري ومائي</SelectItem>
                <SelectItem value="thermal">حراري فقط</SelectItem>
                <SelectItem value="water">مائي فقط</SelectItem>
                <SelectItem value="none">بدون عزل</SelectItem>
                <SelectItem value="unknown">غير معروف</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="تسربات مائية">
            <RadioGroup value={formData.exterior_roof_leaks} onValueChange={(v: string) => updateField("exterior_roof_leaks", v)} className="flex gap-2">
              {[{ value: "no", label: "لا يوجد" }, { value: "minor", label: "بسيطة" }, { value: "major", label: "كبيرة" }].map(opt => (
                <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_roof_leaks === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                  <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
                </label>
              ))}
            </RadioGroup>
          </FieldGroup>
        </div>

        <Separator />

        {/* الأسوار والمداخل */}
        <p className="text-xs font-bold text-muted-foreground">🚧 الأسوار والمدخل والمواقف</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السور">
            <Select value={formData.exterior_fence_type} onValueChange={(v: string) => updateField("exterior_fence_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concrete_block">بلك خرساني</SelectItem>
                <SelectItem value="stone">حجر</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
                <SelectItem value="none">لا يوجد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السور">
            <Select value={formData.exterior_fence_condition} onValueChange={(v: string) => updateField("exterior_fence_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* المدخل الرئيسي */}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع المدخل الرئيسي">
            <Select value={formData.exterior_main_entrance_type} onValueChange={(v: string) => updateField("exterior_main_entrance_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iron_gate">بوابة حديد</SelectItem>
                <SelectItem value="automatic">بوابة أوتوماتيك</SelectItem>
                <SelectItem value="glass_door">باب زجاجي</SelectItem>
                <SelectItem value="wood_door">باب خشبي</SelectItem>
                <SelectItem value="open">مفتوح (بدون بوابة)</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة المدخل">
            <Select value={formData.exterior_main_entrance_condition} onValueChange={(v: string) => updateField("exterior_main_entrance_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* المواقف */}
        <FieldGroup label="المواقف">
          <RadioGroup value={formData.exterior_parking} onValueChange={(v: string) => updateField("exterior_parking", v)} className="flex gap-2">
            {[{ value: "covered", label: "مغطاة" }, { value: "open", label: "مفتوحة" }, { value: "basement", label: "سرداب" }, { value: "none", label: "لا يوجد" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_parking === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.exterior_parking && formData.exterior_parking !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="عدد المواقف">
              <Input type="number" value={formData.exterior_parking_count} onChange={(e: any) => updateField("exterior_parking_count", e.target.value)} placeholder="0" />
            </FieldGroup>
            <FieldGroup label="حالة المواقف">
              <Select value={formData.exterior_parking_condition} onValueChange={(v: string) => updateField("exterior_parking_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>
        )}

        <FieldGroup label="التشجير والمسطحات الخضراء">
          <RadioGroup value={formData.exterior_landscaping} onValueChange={(v: string) => updateField("exterior_landscaping", v)} className="flex gap-2">
            {[{ value: "excellent", label: "ممتاز" }, { value: "average", label: "متوسط" }, { value: "none", label: "لا يوجد" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_landscaping === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="عدد المداخل">
          <Input type="number" value={formData.exterior_entrance_count} onChange={(e: any) => updateField("exterior_entrance_count", e.target.value)} placeholder="مثال: 2" />
        </FieldGroup>

        <Separator />

        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.exterior_notes} onChange={(e: any) => updateField("exterior_notes", e.target.value)} placeholder="أي ملاحظات إضافية عن الحالة الخارجية للمبنى..." rows={3} />
        </FieldGroup>

        <Separator />
        <p className="text-xs font-bold text-muted-foreground">📸 صور الواجهات</p>
        <SectionPhotoUpload section="exterior_front" label="الواجهة الأمامية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_back" label="الواجهة الخلفية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_side" label="الواجهة الجانبية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_general" label="صور عامة للمبنى" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="exterior"
          promptHint="تحليل حالة المبنى الخارجية"
          context={{
            facade_material: formData.exterior_facade_material,
            facade_condition: formData.exterior_facade_condition,
            paint_condition: formData.exterior_paint_condition,
            roof_type: formData.exterior_roof_type,
            roof_condition: formData.exterior_roof_condition,
            fence_type: formData.exterior_fence_type,
            parking: formData.exterior_parking,
          }}
        />
      </CardContent>
    </Card>
  );
}

function SectionInterior({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const conditionOptions = [
    { value: "excellent", label: "ممتازة" },
    { value: "good", label: "جيدة" },
    { value: "acceptable", label: "مقبولة" },
    { value: "poor", label: "رديئة" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={6} title="المبنى - الداخل" icon={Building2} subtitle="وصف مكونات المبنى الداخلية وحالتها" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* عدد الغرف والصالات */}
        <p className="text-xs font-bold text-muted-foreground">🏠 التوزيع الداخلي</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="عدد الغرف">
            <Input type="number" value={formData.interior_rooms_count} onChange={(e: any) => updateField("interior_rooms_count", e.target.value)} placeholder="مثال: 5" />
          </FieldGroup>
          <FieldGroup label="عدد الصالات">
            <Input type="number" value={formData.interior_halls_count} onChange={(e: any) => updateField("interior_halls_count", e.target.value)} placeholder="مثال: 2" />
          </FieldGroup>
          <FieldGroup label="عدد دورات المياه">
            <Input type="number" value={formData.interior_bathrooms_count_num} onChange={(e: any) => updateField("interior_bathrooms_count_num", e.target.value)} placeholder="مثال: 4" />
          </FieldGroup>
          <FieldGroup label="عدد المطابخ">
            <Input type="number" value={formData.interior_kitchens_count} onChange={(e: any) => updateField("interior_kitchens_count", e.target.value)} placeholder="مثال: 1" />
          </FieldGroup>
        </div>

        <Separator />

        {/* الأرضيات */}
        <p className="text-xs font-bold text-muted-foreground">🧱 الأرضيات</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأرضيات" required>
            <Select value={formData.interior_floors_type} onValueChange={(v: string) => updateField("interior_floors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marble">رخام</SelectItem>
                <SelectItem value="ceramic">سيراميك</SelectItem>
                <SelectItem value="porcelain">بورسلان</SelectItem>
                <SelectItem value="granite">جرانيت</SelectItem>
                <SelectItem value="parquet">باركيه</SelectItem>
                <SelectItem value="carpet">موكيت</SelectItem>
                <SelectItem value="vinyl">فينيل</SelectItem>
                <SelectItem value="concrete">خرساني بدون تشطيب</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأرضيات">
            <Select value={formData.interior_floors_condition} onValueChange={(v: string) => updateField("interior_floors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* الجدران */}
        <p className="text-xs font-bold text-muted-foreground">🧱 الجدران</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع التشطيب">
            <Select value={formData.interior_walls_type} onValueChange={(v: string) => updateField("interior_walls_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paint">دهان</SelectItem>
                <SelectItem value="wallpaper">ورق جدران</SelectItem>
                <SelectItem value="wood_panels">تجليد خشب</SelectItem>
                <SelectItem value="stone">حجر</SelectItem>
                <SelectItem value="gypsum">جبس</SelectItem>
                <SelectItem value="plaster">لياسة بدون دهان</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الجدران">
            <Select value={formData.interior_walls_condition} onValueChange={(v: string) => updateField("interior_walls_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* الأسقف */}
        <p className="text-xs font-bold text-muted-foreground">✨ الأسقف الداخلية</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأسقف">
            <Select value={formData.interior_ceilings_type} onValueChange={(v: string) => updateField("interior_ceilings_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gypsum_board">جبس بورد</SelectItem>
                <SelectItem value="paint">دهان مباشر</SelectItem>
                <SelectItem value="decorative">ديكور مزخرف</SelectItem>
                <SelectItem value="suspended">سقف معلق</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="concrete">خرساني ظاهر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأسقف">
            <Select value={formData.interior_ceilings_condition} onValueChange={(v: string) => updateField("interior_ceilings_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* النوافذ */}
        <p className="text-xs font-bold text-muted-foreground">🪟 النوافذ</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع النوافذ">
            <Select value={formData.interior_windows_type} onValueChange={(v: string) => updateField("interior_windows_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="upvc">UPVC</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="double_glazed">زجاج مزدوج</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة النوافذ">
            <Select value={formData.interior_windows_condition} onValueChange={(v: string) => updateField("interior_windows_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <Separator />

        {/* المطبخ */}
        <p className="text-xs font-bold text-muted-foreground">🍳 المطبخ</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع المطبخ">
            <Select value={formData.interior_kitchen_type} onValueChange={(v: string) => updateField("interior_kitchen_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="builtin">مطبخ مدمج</SelectItem>
                <SelectItem value="modular">تجهيز جاهز</SelectItem>
                <SelectItem value="open">مفتوح</SelectItem>
                <SelectItem value="basic">أساسي</SelectItem>
                <SelectItem value="none">بدون تجهيز</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة المطبخ">
            <Select value={formData.interior_kitchen_condition} onValueChange={(v: string) => updateField("interior_kitchen_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* دورات المياه */}
        <p className="text-xs font-bold text-muted-foreground">🚿 دورات المياه</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="العدد">
            <Input type="number" value={formData.interior_bathrooms_count} onChange={(e: any) => updateField("interior_bathrooms_count", e.target.value)} placeholder="مثال: 4" />
          </FieldGroup>
          <FieldGroup label="الحالة">
            <Select value={formData.interior_bathrooms_condition} onValueChange={(v: string) => updateField("interior_bathrooms_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <Separator />

        {/* الأبواب الداخلية */}
        <p className="text-xs font-bold text-muted-foreground">🚪 الأبواب والسلالم</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأبواب الداخلية">
            <Select value={formData.interior_doors_type} onValueChange={(v: string) => updateField("interior_doors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wood_solid">خشب صلب</SelectItem>
                <SelectItem value="wood_hollow">خشب مفرغ</SelectItem>
                <SelectItem value="pvc">PVC</SelectItem>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="glass">زجاج</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأبواب">
            <Select value={formData.interior_doors_condition} onValueChange={(v: string) => updateField("interior_doors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السلالم">
            <Select value={formData.interior_stairs_type} onValueChange={(v: string) => updateField("interior_stairs_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marble">رخام</SelectItem>
                <SelectItem value="granite">جرانيت</SelectItem>
                <SelectItem value="concrete">خرساني</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="none">لا يوجد (دور واحد)</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السلالم">
            <Select value={formData.interior_stairs_condition} onValueChange={(v: string) => updateField("interior_stairs_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <Separator />

        {/* التكييف والأنظمة */}
        <p className="text-xs font-bold text-muted-foreground">❄️ التكييف والأنظمة</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع التكييف">
            <Select value={formData.interior_ac_type} onValueChange={(v: string) => updateField("interior_ac_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="central">مركزي</SelectItem>
                <SelectItem value="split">سبلت</SelectItem>
                <SelectItem value="window">شباك</SelectItem>
                <SelectItem value="ducted">مخفي (دكت)</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
                <SelectItem value="none">لا يوجد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة التكييف">
            <Select value={formData.interior_ac_condition} onValueChange={(v: string) => updateField("interior_ac_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="حالة الكهرباء الداخلية">
            <Select value={formData.interior_electrical_condition} onValueChange={(v: string) => updateField("interior_electrical_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السباكة">
            <Select value={formData.interior_plumbing_condition} onValueChange={(v: string) => updateField("interior_plumbing_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <Separator />

        {/* حالة التشطيب الداخلي الكلية */}
        <p className="text-xs font-bold text-muted-foreground">⭐ التقييم الكلي للتشطيب الداخلي</p>
        <FieldGroup label="حالة التشطيب الداخلي الكلية" required>
          <Select value={formData.interior_overall_finishing} onValueChange={(v: string) => updateField("interior_overall_finishing", v)}>
            <SelectTrigger><SelectValue placeholder="اختر التقييم الكلي" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="luxury">فاخر (لوكس)</SelectItem>
              <SelectItem value="super">سوبر ديلوكس</SelectItem>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="acceptable">مقبول</SelectItem>
              <SelectItem value="poor">ضعيف</SelectItem>
              <SelectItem value="unfinished">بدون تشطيب</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.interior_notes} onChange={(e: any) => updateField("interior_notes", e.target.value)} placeholder="أي ملاحظات إضافية عن الحالة الداخلية، عيوب، رطوبة، روائح..." rows={3} />
        </FieldGroup>

        {/* صور الداخل */}
        <Separator />
        <p className="text-xs font-bold text-muted-foreground">📸 صور المبنى الداخلية</p>
        <SectionPhotoUpload section="interior_living" label="الصالة / المعيشة" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_kitchen" label="المطبخ" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_bathroom" label="دورات المياه" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_rooms" label="غرف النوم" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_general" label="صور عامة داخلية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

        <AiSuggestionBox
          sectionKey="interior"
          promptHint="تحليل حالة المبنى الداخلية والتشطيبات"
          context={{
            floors_type: formData.interior_floors_type,
            floors_condition: formData.interior_floors_condition,
            walls_condition: formData.interior_walls_condition,
            ceilings_condition: formData.interior_ceilings_condition,
            kitchen_condition: formData.interior_kitchen_condition,
            bathrooms_condition: formData.interior_bathrooms_condition,
            ac_type: formData.interior_ac_type,
            ac_condition: formData.interior_ac_condition,
            electrical: formData.interior_electrical_condition,
            plumbing: formData.interior_plumbing_condition,
            rooms_count: formData.interior_rooms_count,
          }}
        />
      </CardContent>
    </Card>
  );
}

function SectionCondition({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={7} title="حالة الأصل" icon={Wrench} subtitle="تقييم الحالة الفعلية" />
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
          <SectionHeader num={8} title="المرافق والخدمات" icon={Zap} subtitle="توفر الخدمات الأساسية" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* الكهرباء */}
          <p className="text-xs font-bold text-muted-foreground">⚡ الكهرباء</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="حالة التوفر">
              <Select value={formData.electricity_status} onValueChange={(v: string) => updateField("electricity_status", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">متوفر</SelectItem>
                  <SelectItem value="temporary">مؤقت</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة الكهرباء">
              <Select value={formData.electricity_condition} onValueChange={(v: string) => updateField("electricity_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الماء */}
          <p className="text-xs font-bold text-muted-foreground">💧 المياه</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="مصدر المياه">
              <Select value={formData.water_source} onValueChange={(v: string) => updateField("water_source", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">شبكة عامة</SelectItem>
                  <SelectItem value="tank">خزان</SelectItem>
                  <SelectItem value="well">بئر</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة المياه">
              <Select value={formData.water_condition} onValueChange={(v: string) => updateField("water_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الصرف الصحي */}
          <p className="text-xs font-bold text-muted-foreground">🔧 الصرف الصحي</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="نوع الصرف">
              <Select value={formData.sewage_type} onValueChange={(v: string) => updateField("sewage_type", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">شبكة عامة</SelectItem>
                  <SelectItem value="septic">خزان امتصاص (بيارة)</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة الصرف">
              <Select value={formData.sewage_condition} onValueChange={(v: string) => updateField("sewage_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الطرق */}
          <p className="text-xs font-bold text-muted-foreground">🛣️ الطرق</p>
          <label className={`flex items-center justify-between border rounded-lg p-3 cursor-pointer transition-colors ${formData.roads_paved ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">طرق معبدة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formData.roads_paved ? "متوفر" : "غير متوفر"}</span>
              <Checkbox checked={formData.roads_paved} onCheckedChange={(v: any) => updateField("roads_paved", !!v)} />
            </div>
          </label>

          <Separator />

          {/* الغاز */}
          <p className="text-xs font-bold text-muted-foreground">🔥 الغاز</p>
          <FieldGroup label="حالة الغاز">
            <Select value={formData.gas_status} onValueChange={(v: string) => updateField("gas_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="central">غاز مركزي</SelectItem>
                <SelectItem value="cylinder">أسطوانات</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* الإنترنت */}
          <p className="text-xs font-bold text-muted-foreground">🌐 الإنترنت</p>
          <FieldGroup label="حالة الإنترنت">
            <Select value={formData.internet_status} onValueChange={(v: string) => updateField("internet_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fiber">ألياف بصرية</SelectItem>
                <SelectItem value="dsl">DSL</SelectItem>
                <SelectItem value="available">متوفر</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          <Separator />

          {/* التكييف المركزي */}
          <p className="text-xs font-bold text-muted-foreground">❄️ التكييف المركزي</p>
          <FieldGroup label="حالة التكييف المركزي">
            <Select value={formData.central_ac_status} onValueChange={(v: string) => updateField("central_ac_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available_working">متوفر ويعمل</SelectItem>
                <SelectItem value="available_broken">متوفر لا يعمل</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* المصعد */}
          <p className="text-xs font-bold text-muted-foreground">🛗 المصعد</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="حالة المصعد">
              <Select value={formData.elevator_status} onValueChange={(v: string) => updateField("elevator_status", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available_working">متوفر ويعمل</SelectItem>
                  <SelectItem value="available_broken">متوفر لا يعمل</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            {formData.elevator_status && formData.elevator_status !== "unavailable" && (
              <FieldGroup label="عدد المصاعد">
                <Input type="number" value={formData.elevator_count} onChange={(e: any) => updateField("elevator_count", e.target.value)} placeholder="مثال: 2" />
              </FieldGroup>
            )}
          </div>

          <Separator />

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

      <AiSuggestionBox
        sectionKey="utilities"
        promptHint="تحليل حالة المرافق والخدمات المتوفرة"
        context={{
          electricity_status: formData.electricity_status,
          electricity_condition: formData.electricity_condition,
          water_source: formData.water_source,
          water_condition: formData.water_condition,
          sewage_type: formData.sewage_type,
          sewage_condition: formData.sewage_condition,
          roads_paved: formData.roads_paved,
          utilities_notes: formData.utilities_notes,
          checklist_done: checklist.filter((c: any) => c.is_checked).length,
          checklist_total: checklist.length,
        }}
      />
    </div>
  );
}

function SectionValueFactors({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={9} title="العوامل المؤثرة على القيمة" icon={TrendingUp} subtitle="العوامل الإيجابية والسلبية" />
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
      <SectionHeader num={10} title="التوثيق المصور" icon={Camera} subtitle={`إجباري — ${requiredPhotoDone}/${requiredPhotoTotal} صور مطلوبة مكتملة`} />
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
        <SectionHeader num={11} title="المخاطر والملاحظات" icon={ShieldAlert} subtitle="أي مخاطر تؤثر على التقييم" />
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
        <SectionHeader num={12} title="التحقق النهائي" icon={FileCheck} subtitle="مراجعة اكتمال جميع البيانات" />
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
        <SectionHeader num={13} title="اعتماد المعاينة" icon={UserCheck} subtitle="تأكيد واعتماد المعاينة" />
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
