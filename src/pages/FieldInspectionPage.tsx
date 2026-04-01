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
  FileCheck, UserCheck, Home, Upload, LayoutGrid,
} from "lucide-react";
import SectionPhotoUpload, { type SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import AiSuggestionBox from "@/components/inspection/AiSuggestionBox";

/* ═══════ Constants ═══════ */

const PHOTO_CATEGORIES = [
  { key: "exterior_front", label: "الواجهة الأمامية", group: "exterior", required: true },
  { key: "exterior_back", label: "الواجهة الخلفية", group: "exterior", required: true },
  { key: "exterior_left", label: "الواجهة اليسرى", group: "exterior", required: true },
  { key: "exterior_right", label: "الواجهة اليمنى", group: "exterior", required: true },
  { key: "street_view", label: "منظر الشارع", group: "exterior", required: true },
  { key: "interior_living", label: "صالة المعيشة", group: "interior", required: false },
  { key: "interior_kitchen", label: "المطبخ", group: "interior", required: false },
  { key: "interior_bathroom", label: "دورة المياه", group: "interior", required: false },
  { key: "interior_bedroom", label: "غرفة النوم", group: "interior", required: false },
  { key: "surroundings", label: "المحيط العام", group: "exterior", required: true },
  { key: "site_plan", label: "المخطط / الكروكي", group: "plan", required: false },
  { key: "floor_plan", label: "مخطط الأدوار", group: "plan", required: false },
  { key: "deed_photo", label: "صورة الصك", group: "plan", required: false },
  { key: "problem_cracks", label: "تشققات / عيوب", group: "problems", required: false },
  { key: "problem_moisture", label: "رطوبة / تسربات", group: "problems", required: false },
  { key: "problem_other", label: "مشاكل أخرى", group: "problems", required: false },
  { key: "other", label: "صور إضافية", group: "other", required: false },
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
  { key: "layout_areas", label: "المخطط والمساحات", icon: LayoutGrid, num: 9 },
  { key: "value_factors", label: "العوامل المؤثرة", icon: TrendingUp, num: 10 },
  { key: "notes_recommendations", label: "ملاحظات وتوصيات", icon: ClipboardCheck, num: 11 },
  { key: "documentation", label: "التوثيق", icon: Camera, num: 12 },
  { key: "risks", label: "المخاطر", icon: ShieldAlert, num: 13 },
  { key: "final_check", label: "التحقق النهائي", icon: FileCheck, num: 14 },
  { key: "approval", label: "الاعتماد", icon: UserCheck, num: 15 },
];

/* ═══════ Types ═══════ */

interface PhotoItem {
  category: string;
  file_name: string;
  preview: string;
  description: string;
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
  maintenance_rating: string;
  cracks_severity: string;
  moisture_severity: string;
  corrosion_severity: string;
  fire_damage_severity: string;
  structural_damage_severity: string;
  damage_details: string;
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
  utilities_confidential_notes: string;
  total_building_area: string;
  floor_areas: string;
  floor_count_detail: string;
  layout_notes: string;
  garden_area: string;
  parking_area: string;
  annex_area: string;
  area_matches_license: string;
  positive_factors: Record<string, string>;
  positive_factors_other: string;
  negative_factors: Record<string, string>;
  negative_factors_other: string;
  environmental_factors: string;
  regulatory_factors: string;
  inspector_observations: string;
  inspector_recommendations: string;
  additional_notes: string;
  inspector_verdict: string;
  inspector_verdict_notes: string;
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
  maintenance_rating: "",
  cracks_severity: "none",
  moisture_severity: "none",
  corrosion_severity: "none",
  fire_damage_severity: "none",
  structural_damage_severity: "none",
  damage_details: "",
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
  utilities_confidential_notes: "",
  total_building_area: "",
  floor_areas: "",
  floor_count_detail: "",
  layout_notes: "",
  garden_area: "",
  parking_area: "",
  annex_area: "",
  area_matches_license: "",
  positive_factors: {} as Record<string, string>,
  negative_factors: {} as Record<string, string>,
  negative_factors_other: "",
  positive_factors_other: "",
  environmental_factors: "",
  regulatory_factors: "",
  inspector_observations: "",
  inspector_recommendations: "",
  additional_notes: "",
  inspector_verdict: "",
  inspector_verdict_notes: "",
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
        {step === 8 && <SectionLayoutAreas formData={formData} updateField={updateField} />}
        {step === 9 && <SectionValueFactors formData={formData} updateField={updateField} />}
        {step === 10 && <SectionNotesRecommendations formData={formData} updateField={updateField} />}
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
        <FieldGroup label="التقييم الكلي للصيانة" required>
          <RadioGroup value={formData.maintenance_rating} onValueChange={(v: string) => updateField("maintenance_rating", v)} className="grid grid-cols-3 gap-2">
            {[
              { value: "excellent", label: "ممتازة", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "good", label: "جيدة", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
              { value: "average", label: "متوسطة", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "needs_maintenance", label: "تحتاج صيانة", color: "border-orange-500 bg-orange-50 dark:bg-orange-900/20" },
              { value: "poor", label: "رديئة", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.maintenance_rating === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        <p className="text-xs font-bold text-muted-foreground">🔍 الأضرار والعيوب المكتشفة</p>
        <div className="space-y-2">
          {[
            { key: "cracks_severity", label: "تشققات", icon: "🧱" },
            { key: "moisture_severity", label: "رطوبة / تسربات", icon: "💧" },
            { key: "corrosion_severity", label: "تآكل / صدأ", icon: "⚙️" },
            { key: "fire_damage_severity", label: "أضرار حريق", icon: "🔥" },
            { key: "structural_damage_severity", label: "أضرار هيكلية", icon: "🏗️" },
          ].map(item => (
            <div key={item.key} className={`flex items-center justify-between border rounded-lg p-3 transition-colors ${formData[item.key] && formData[item.key] !== "none" ? (formData[item.key] === "severe" ? "border-destructive/50 bg-destructive/5" : formData[item.key] === "moderate" ? "border-orange-400/50 bg-orange-50/50 dark:bg-orange-900/10" : "border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/10") : "border-border"}`}>
              <span className="text-sm font-medium">{item.icon} {item.label}</span>
              <Select value={formData[item.key] || "none"} onValueChange={(v: string) => updateField(item.key, v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">لا يوجد</SelectItem>
                  <SelectItem value="minor">بسيط</SelectItem>
                  <SelectItem value="moderate">متوسط</SelectItem>
                  <SelectItem value="severe">خطير</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {[formData.cracks_severity, formData.moisture_severity, formData.corrosion_severity, formData.fire_damage_severity, formData.structural_damage_severity].some((v: string) => v && v !== "none") && (
          <FieldGroup label="تفاصيل الأضرار">
            <Textarea value={formData.damage_details} onChange={(e: any) => updateField("damage_details", e.target.value)} placeholder="صف الأضرار بالتفصيل: موقعها، حجمها، تأثيرها..." rows={3} />
          </FieldGroup>
        )}

        <FieldGroup label="ملاحظات الحالة">
          <Textarea value={formData.condition_notes} onChange={(e: any) => updateField("condition_notes", e.target.value)} placeholder="تفاصيل عن الحالة الإنشائية، التشطيبات، العيوب..." rows={3} />
        </FieldGroup>
        <SectionPhotoUpload section="condition" label="صور حالة الأصل والعيوب" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="damage" label="📸 صور المشاكل والأضرار (تشققات، رطوبة، تلف)" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="condition"
          promptHint="تقييم حالة الأصل والصيانة مع تقدير تكلفة الصيانة المتوقعة"
          context={{ overall_condition: formData.overall_condition, asset_age: formData.asset_age, finishing_level: formData.finishing_level, maintenance_rating: formData.maintenance_rating, cracks_severity: formData.cracks_severity, moisture_severity: formData.moisture_severity, corrosion_severity: formData.corrosion_severity, fire_damage_severity: formData.fire_damage_severity, structural_damage_severity: formData.structural_damage_severity, damage_details: formData.damage_details, condition_notes: formData.condition_notes }}
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

      <div className="border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300">ملاحظات المعاين على الخدمات (سرية — للمقيّم فقط)</span>
        </div>
        <Textarea
          value={formData.utilities_confidential_notes}
          onChange={(e: any) => updateField("utilities_confidential_notes", e.target.value)}
          placeholder="ملاحظات سرية عن حالة الخدمات لا تظهر في التقرير... (مثال: اشتباه بتوصيلات غير نظامية، روائح صرف صحي)"
          rows={2}
          className="border-amber-200 dark:border-amber-800 bg-white dark:bg-background"
        />
      </div>

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

function SectionLayoutAreas({ formData, updateField }: any) {
  const floorAreas = formData.floor_areas ? formData.floor_areas.split(",") : [];

  const updateFloorArea = (index: number, value: string) => {
    const areas = formData.floor_areas ? formData.floor_areas.split(",") : [];
    while (areas.length <= index) areas.push("");
    areas[index] = value;
    updateField("floor_areas", areas.join(","));
  };

  const floorLabels = (i: number) => {
    if (i === 0) return "البدروم / القبو";
    if (i === 1) return "الدور الأرضي";
    if (i === 2) return "الدور الأول";
    if (i === 3) return "الدور الثاني";
    if (i === 4) return "الدور الثالث";
    return `الدور ${i - 1}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={9} title="المخطط والمساحات" icon={LayoutGrid} subtitle="تفصيل المساحات لكل دور" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="مساحة البناء الكلية (م²)" required>
            <Input type="number" value={formData.total_building_area} onChange={(e: any) => updateField("total_building_area", e.target.value)} placeholder="مثال: 450" />
          </FieldGroup>
          <FieldGroup label="عدد الأدوار (للتفصيل)">
            <Input type="number" min={1} max={10} value={formData.floor_count_detail} onChange={(e: any) => updateField("floor_count_detail", e.target.value)} placeholder="مثال: 3" />
          </FieldGroup>
        </div>

        {formData.total_building_area && formData.land_area && parseFloat(formData.land_area) > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">📊 نسبة البناء إلى الأرض</span>
            <span className={`text-lg font-bold ${parseFloat(formData.total_building_area) / parseFloat(formData.land_area) > 3 ? "text-destructive" : "text-primary"}`}>
              {((parseFloat(formData.total_building_area) / parseFloat(formData.land_area)) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {formData.floor_count_detail && parseInt(formData.floor_count_detail) > 0 && (
          <>
            <Separator />
            <p className="text-xs font-bold text-muted-foreground">📐 مساحة كل دور (م²)</p>
            <div className="space-y-2">
              {Array.from({ length: Math.min(parseInt(formData.floor_count_detail), 10) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{floorLabels(i)}</span>
                  <Input
                    type="number"
                    value={floorAreas[i] || ""}
                    onChange={(e: any) => updateFloorArea(i, e.target.value)}
                    placeholder="م²"
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            {floorAreas.filter((a: string) => a && parseFloat(a) > 0).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">إجمالي مساحات الأدوار</p>
                <p className="text-lg font-bold text-primary">
                  {floorAreas.reduce((sum: number, a: string) => sum + (parseFloat(a) || 0), 0).toLocaleString("ar-SA")} م²
                </p>
                {formData.total_building_area && Math.abs(floorAreas.reduce((sum: number, a: string) => sum + (parseFloat(a) || 0), 0) - parseFloat(formData.total_building_area)) > 1 && (
                  <p className="text-xs text-destructive mt-1">⚠️ يختلف عن المساحة الكلية المدخلة ({parseFloat(formData.total_building_area).toLocaleString("ar-SA")} م²)</p>
                )}
              </div>
            )}
          </>
        )}

        <Separator />

        <p className="text-xs font-bold text-muted-foreground">🌿 المساحات الإضافية (م²)</p>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="🌳 الحديقة / الفناء">
            <Input type="number" value={formData.garden_area} onChange={(e: any) => updateField("garden_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
          <FieldGroup label="🚗 المواقف">
            <Input type="number" value={formData.parking_area} onChange={(e: any) => updateField("parking_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
          <FieldGroup label="🏠 الملاحق">
            <Input type="number" value={formData.annex_area} onChange={(e: any) => updateField("annex_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
        </div>

        <Separator />

        <FieldGroup label="تطابق المساحة مع الرخصة" required>
          <RadioGroup value={formData.area_matches_license} onValueChange={(v: string) => updateField("area_matches_license", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "yes", label: "✅ نعم", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "no", label: "❌ لا", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.area_matches_license === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.area_matches_license === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            عدم تطابق المساحة مع الرخصة يستوجب التوثيق بالتفصيل وإبلاغ المقيّم
          </div>
        )}

        <FieldGroup label="ملاحظات المخطط">
          <Textarea value={formData.layout_notes} onChange={(e: any) => updateField("layout_notes", e.target.value)} placeholder="ملاحظات عن توزيع المساحات، الملاحق، السطح..." rows={2} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}


function SectionValueFactors({ formData, updateField }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={10} title="العوامل المؤثرة على القيمة" icon={TrendingUp} subtitle="العوامل الإيجابية والسلبية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="✅ عوامل إيجابية">
          <div className="space-y-2">
            {[
              { id: "view", label: "إطلالة مميزة (View)" },
              { id: "prime_location", label: "موقع مميز" },
              { id: "luxury_finish", label: "تشطيب راقي" },
              { id: "modern", label: "حديث البناء" },
            ].map((factor) => {
              const isSelected = factor.id in formData.positive_factors;
              return (
                <div key={factor.id} className="rounded-lg border border-border bg-background p-2.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const current = { ...formData.positive_factors };
                        if (checked) { current[factor.id] = "medium"; } else { delete current[factor.id]; }
                        updateField("positive_factors", current);
                      }}
                    />
                    <span className="text-sm font-medium">{factor.label}</span>
                  </label>
                  {isSelected && (
                    <div className="flex gap-1.5 mr-6">
                      {[
                        { value: "weak", label: "ضعيف", style: "border-muted-foreground/30 text-muted-foreground" },
                        { value: "medium", label: "متوسط", style: "border-primary/50 text-primary" },
                        { value: "strong", label: "قوي", style: "border-primary text-primary font-bold" },
                      ].map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => updateField("positive_factors", { ...formData.positive_factors, [factor.id]: level.value })}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${formData.positive_factors[factor.id] === level.value ? "bg-primary text-primary-foreground border-primary" : level.style + " bg-background hover:bg-accent/50"}`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <Input value={formData.positive_factors_other} onChange={(e: any) => updateField("positive_factors_other", e.target.value)} placeholder="أخرى (حدد)..." className="text-sm" />
          </div>
        </FieldGroup>
        <FieldGroup label="⚠️ عوامل سلبية">
          <div className="space-y-2">
            {[
              { id: "noise", label: "قرب ضوضاء" },
              { id: "legal_issues", label: "إشكاليات قانونية" },
              { id: "harmful_neighbor", label: "مجاور ضار" },
            ].map((factor) => {
              const isSelected = factor.id in formData.negative_factors;
              return (
                <div key={factor.id} className="rounded-lg border border-border bg-background p-2.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const current = { ...formData.negative_factors };
                        if (checked) { current[factor.id] = "medium"; } else { delete current[factor.id]; }
                        updateField("negative_factors", current);
                      }}
                    />
                    <span className="text-sm font-medium">{factor.label}</span>
                  </label>
                  {isSelected && (
                    <div className="flex gap-1.5 mr-6">
                      {[
                        { value: "weak", label: "ضعيف", style: "border-muted-foreground/30 text-muted-foreground" },
                        { value: "medium", label: "متوسط", style: "border-destructive/50 text-destructive" },
                        { value: "strong", label: "قوي", style: "border-destructive text-destructive font-bold" },
                      ].map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => updateField("negative_factors", { ...formData.negative_factors, [factor.id]: level.value })}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${formData.negative_factors[factor.id] === level.value ? "bg-destructive text-destructive-foreground border-destructive" : level.style + " bg-background hover:bg-accent/50"}`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <Input value={formData.negative_factors_other} onChange={(e: any) => updateField("negative_factors_other", e.target.value)} placeholder="أخرى (حدد)..." className="text-sm" />
          </div>
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
          context={{ positive_factors: Object.entries(formData.positive_factors).map(([k,v]) => `${k}:${v}`).join(', '), positive_factors_other: formData.positive_factors_other, negative_factors: Object.entries(formData.negative_factors).map(([k,v]) => `${k}:${v}`).join(', '), negative_factors_other: formData.negative_factors_other, environmental_factors: formData.environmental_factors, regulatory_factors: formData.regulatory_factors }}
        />
      </CardContent>
    </Card>
  );
}

function SectionDocumentation({ photos, onCapture, onRemove, onDescriptionChange, requiredPhotoDone, requiredPhotoTotal }: any) {
  const groups = [
    { key: "exterior", title: "📸 صور خارجية", icon: "🏢" },
    { key: "interior", title: "🏠 صور داخلية", icon: "🛋️" },
    { key: "plan", title: "📐 مخططات ووثائق", icon: "📋" },
    { key: "problems", title: "⚠️ مشاكل وعيوب", icon: "🔍" },
    { key: "other", title: "📎 صور إضافية", icon: "📷" },
  ];

  const totalPhotos = photos.length;

  return (
    <div className="space-y-4">
      <SectionHeader num={11} title="التوثيق المصور" icon={Camera} subtitle={`${totalPhotos} صورة — ${requiredPhotoDone}/${requiredPhotoTotal} إجباري`} />
      {requiredPhotoDone < requiredPhotoTotal && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          أكمل جميع الصور المطلوبة ({requiredPhotoTotal - requiredPhotoDone} متبقية)
        </div>
      )}
      {/* Summary badges */}
      <div className="flex flex-wrap gap-2">
        {groups.map(g => {
          const count = photos.filter((p: PhotoItem) => PHOTO_CATEGORIES.find(c => c.key === p.category)?.group === g.key).length;
          return count > 0 ? <Badge key={g.key} variant="secondary" className="text-xs">{g.icon} {count}</Badge> : null;
        })}
      </div>
      {groups.map(g => {
        const cats = PHOTO_CATEGORIES.filter(c => c.group === g.key);
        return (
          <Card key={g.key}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{g.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {cats.map((cat) => (
                <PhotoCategoryRow key={cat.key} cat={cat} photos={photos} onCapture={onCapture} onRemove={onRemove} onDescriptionChange={onDescriptionChange} />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PhotoCategoryRow({ cat, photos, onCapture, onRemove, onDescriptionChange }: any) {
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
        <div className="grid grid-cols-3 gap-2 mb-2">
          {catPhotos.map((p: PhotoItem, i: number) => (
            <div key={i} className="relative rounded-lg overflow-hidden border border-border bg-muted group">
              <div className="aspect-square">
                <img src={p.preview} alt={p.description || ""} className="w-full h-full object-cover" />
              </div>
              {/* Overlay controls */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-start justify-end p-1 gap-1">
                <button onClick={() => onRemove(p)} className="bg-destructive text-destructive-foreground p-1.5 rounded-md shadow">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {/* Description */}
              <div className="p-1.5">
                <Input
                  value={p.description || ""}
                  onChange={(e: any) => onDescriptionChange(p, e.target.value)}
                  placeholder="وصف..."
                  className="text-[10px] h-6 px-1.5 border-none bg-transparent focus-visible:ring-1"
                />
              </div>
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

function SectionNotesRecommendations({ formData, updateField }: any) {
  const [techSummary, setTechSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateTechSummary = () => {
    setSummaryLoading(true);
    setTechSummary(null);

    // Build structured summary from all form data
    setTimeout(() => {
      const lines: string[] = [];

      lines.push("══════ ملخص المعاينة الفنية ══════");
      lines.push(`📅 تاريخ المعاينة: ${formData.inspection_date || "—"}`);
      lines.push(`👤 المعاين: ${formData.inspector_name || "—"}`);
      lines.push(`📍 الموقع: ${[formData.city, formData.district, formData.street].filter(Boolean).join("، ") || "—"}`);
      lines.push(`🏠 نوع الأصل: ${formData.asset_type || "—"}`);
      lines.push(`📄 رقم الصك: ${formData.deed_number || "—"}`);
      lines.push("");

      // Areas
      const landArea = formData.land_area ? `${formData.land_area} م²` : "—";
      const buildingArea = formData.total_building_area ? `${formData.total_building_area} م²` : "—";
      lines.push("▬▬ المساحات ▬▬");
      lines.push(`مساحة الأرض: ${landArea} | مساحة البناء: ${buildingArea}`);
      if (formData.land_area && formData.total_building_area && parseFloat(formData.land_area) > 0) {
        const ratio = ((parseFloat(formData.total_building_area) / parseFloat(formData.land_area)) * 100).toFixed(1);
        lines.push(`نسبة البناء: ${ratio}%`);
      }
      if (formData.area_matches_license) lines.push(`تطابق المساحة مع الرخصة: ${formData.area_matches_license === "yes" ? "✅ نعم" : "❌ لا"}`);
      lines.push("");

      // Condition
      const conditionLabels: Record<string, string> = { excellent: "ممتازة", good: "جيدة", fair: "متوسطة", poor: "سيئة" };
      lines.push("▬▬ حالة الأصل ▬▬");
      lines.push(`الحالة العامة: ${conditionLabels[formData.overall_condition] || formData.overall_condition || "—"}`);
      if (formData.asset_age) lines.push(`عمر المبنى: ${formData.asset_age} سنة`);
      if (formData.finishing_level) lines.push(`مستوى التشطيب: ${formData.finishing_level}`);
      if (formData.maintenance_rating) lines.push(`مستوى الصيانة: ${formData.maintenance_rating}`);
      lines.push("");

      // Value factors
      const impactLabels: Record<string, string> = { weak: "ضعيف", medium: "متوسط", strong: "قوي" };
      const posLabels: Record<string, string> = { view: "إطلالة مميزة", prime_location: "موقع مميز", luxury_finish: "تشطيب راقي", modern: "حديث البناء" };
      const negLabels: Record<string, string> = { noise: "قرب ضوضاء", legal_issues: "إشكاليات قانونية", harmful_neighbor: "مجاور ضار" };

      const posEntries = Object.entries(formData.positive_factors || {});
      const negEntries = Object.entries(formData.negative_factors || {});

      if (posEntries.length > 0 || negEntries.length > 0) {
        lines.push("▬▬ العوامل المؤثرة على القيمة ▬▬");
        if (posEntries.length > 0) {
          lines.push("إيجابية:");
          posEntries.forEach(([k, v]) => lines.push(`  • ${posLabels[k] || k} — تأثير ${impactLabels[v as string] || v}`));
        }
        if (negEntries.length > 0) {
          lines.push("سلبية:");
          negEntries.forEach(([k, v]) => lines.push(`  • ${negLabels[k] || k} — تأثير ${impactLabels[v as string] || v}`));
        }
        if (formData.positive_factors_other) lines.push(`  • أخرى: ${formData.positive_factors_other}`);
        if (formData.negative_factors_other) lines.push(`  • أخرى: ${formData.negative_factors_other}`);
        lines.push("");
      }

      // Risks
      if (formData.has_risks === "yes") {
        lines.push("▬▬ المخاطر ▬▬");
        lines.push(`⚠️ ${formData.risk_details || "توجد مخاطر مسجلة"}`);
        lines.push("");
      }

      // Inspector notes & verdict
      if (formData.inspector_observations) {
        lines.push("▬▬ ملاحظات المعاين ▬▬");
        lines.push(formData.inspector_observations);
        lines.push("");
      }
      if (formData.inspector_recommendations) {
        lines.push("▬▬ التوصيات ▬▬");
        lines.push(formData.inspector_recommendations);
        lines.push("");
      }

      const verdictLabels: Record<string, string> = { complete: "✅ ملف مكتمل وجاهز للتقييم", needs_revisit: "🔄 يحتاج زيارة إضافية", has_issues: "⚠️ توجد إشكاليات" };
      if (formData.inspector_verdict) {
        lines.push("▬▬ التوصية النهائية ▬▬");
        lines.push(verdictLabels[formData.inspector_verdict] || formData.inspector_verdict);
        if (formData.inspector_verdict_notes) lines.push(formData.inspector_verdict_notes);
      }

      lines.push("");
      lines.push(`═══ نهاية الملخص — ${new Date().toLocaleDateString("ar-SA")} ═══`);

      setTechSummary(lines.join("\n"));
      setSummaryLoading(false);
    }, 800);
  };

  const handleCopySummary = () => {
    if (techSummary) {
      navigator.clipboard.writeText(techSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("✅ تم نسخ الملخص — يمكنك لصقه في التقرير");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={11} title="الملاحظات والتوصيات" icon={ClipboardCheck} subtitle="ملاحظات المعاين وتوصياته للمقيّم" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="📝 ملاحظات المعاين">
          <Textarea
            value={formData.inspector_observations}
            onChange={(e: any) => updateField("inspector_observations", e.target.value)}
            placeholder="ملاحظات عامة حول العقار، حالته، ومحيطه..."
            rows={4}
          />
        </FieldGroup>
        <FieldGroup label="💡 توصيات للمقيّم">
          <Textarea
            value={formData.inspector_recommendations}
            onChange={(e: any) => updateField("inspector_recommendations", e.target.value)}
            placeholder="توصيات مهنية بناءً على المعاينة (مثل: يُنصح بإجراء فحص إنشائي، التحقق من رخصة البناء...)..."
            rows={4}
          />
        </FieldGroup>
        <FieldGroup label="📎 ملاحظات إضافية">
          <Textarea
            value={formData.additional_notes}
            onChange={(e: any) => updateField("additional_notes", e.target.value)}
            placeholder="أي معلومات إضافية لم تُغطَّ في الأقسام السابقة..."
            rows={3}
          />
        </FieldGroup>

        <Separator />

        {/* Confidential section */}
        <div className="rounded-lg border-2 border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            <span className="text-sm font-bold">🔒 ملاحظات سرية — للمقيّم فقط</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            هذه الملاحظات لا تُضاف للتقرير النهائي ولا تُعرض للعميل. مخصصة فقط للمقيّم المسؤول.
          </p>
          <Textarea
            value={formData.confidential_notes}
            onChange={(e: any) => updateField("confidential_notes", e.target.value)}
            placeholder="ملاحظات سرية: شكوك حول صحة المستندات، مخاوف من تضخم القيمة، ملاحظات حول سلوك المالك، معلومات حساسة..."
            rows={4}
            className="border-destructive/20 bg-background"
          />
        </div>

        <Separator />

        <FieldGroup label="📋 توصية المعاين النهائية" required>
          <RadioGroup value={formData.inspector_verdict} onValueChange={(v: string) => updateField("inspector_verdict", v)} className="space-y-2">
            {[
              { value: "complete", label: "✅ ملف مكتمل", desc: "جميع البيانات والصور مكتملة وجاهزة للتقييم", style: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "needs_revisit", label: "🔄 يحتاج زيارة إضافية", desc: "بعض العناصر تحتاج معاينة تكميلية", style: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "has_issues", label: "⚠️ توجد إشكاليات", desc: "إشكاليات تمنع أو تؤثر على إتمام التقييم", style: "border-destructive bg-destructive/5" },
            ].map((opt) => (
              <label key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${formData.inspector_verdict === opt.value ? opt.style + " font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="mt-0.5" />
                <div>
                  <div className="text-sm">{opt.label}</div>
                  <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                </div>
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        {(formData.inspector_verdict === "needs_revisit" || formData.inspector_verdict === "has_issues") && (
          <FieldGroup label={formData.inspector_verdict === "needs_revisit" ? "🔄 سبب الزيارة الإضافية" : "⚠️ تفاصيل الإشكاليات"} required>
            <Textarea
              value={formData.inspector_verdict_notes}
              onChange={(e: any) => updateField("inspector_verdict_notes", e.target.value)}
              placeholder={formData.inspector_verdict === "needs_revisit" ? "ما العناصر التي تحتاج معاينة إضافية؟..." : "ما الإشكاليات المكتشفة وتأثيرها؟..."}
              rows={3}
              className={formData.inspector_verdict === "has_issues" ? "border-destructive/30" : "border-yellow-300"}
            />
          </FieldGroup>
        )}

        <AiSuggestionBox
          sectionKey="notes_recommendations"
          promptHint="اقتراح ملاحظات وتوصيات بناءً على بيانات المعاينة"
          context={{
            inspector_observations: formData.inspector_observations,
            inspector_recommendations: formData.inspector_recommendations,
            inspector_verdict: formData.inspector_verdict,
            overall_condition: formData.overall_condition,
            has_risks: formData.has_risks,
          }}
        />
      </CardContent>
    </Card>
  );
}

function SectionRisks({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={12} title="المخاطر والملاحظات" icon={ShieldAlert} subtitle="أي مخاطر تؤثر على التقييم" />
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
        <SectionHeader num={13} title="التحقق النهائي" icon={FileCheck} subtitle="مراجعة اكتمال جميع البيانات" />
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
        <SectionHeader num={14} title="اعتماد المعاينة" icon={UserCheck} subtitle="تأكيد واعتماد المعاينة" />
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
