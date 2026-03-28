import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  MapPin, Camera, ClipboardCheck, StickyNote,
  Send, ChevronRight, ChevronLeft, Loader2,
  CheckCircle, AlertTriangle, Navigation, ImagePlus,
  Trash2, Eye,
} from "lucide-react";

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
  { key: "location", label: "تأكيد الموقع", icon: MapPin },
  { key: "exterior", label: "صور خارجية", icon: Camera },
  { key: "interior", label: "صور داخلية", icon: ImagePlus },
  { key: "checklist", label: "قائمة الفحص", icon: ClipboardCheck },
  { key: "notes", label: "الملاحظات", icon: StickyNote },
  { key: "review", label: "مراجعة وإرسال", icon: Send },
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

export default function MobileInspectionFlow() {
  const { inspectionId } = useParams<{ inspectionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [inspection, setInspection] = useState<any>(null);

  // Step data
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [notesAr, setNotesAr] = useState("");
  const [findingsAr, setFindingsAr] = useState("");

  useEffect(() => {
    if (inspectionId) loadInspection();
  }, [inspectionId]);

  const loadInspection = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inspections")
      .select("*")
      .eq("id", inspectionId)
      .single();

    if (!data) {
      toast.error("لم يتم العثور على المعاينة");
      navigate("/inspector");
      return;
    }

    setInspection(data);

    // Restore auto-saved data
    const saved = data.auto_saved_data as any;
    if (saved) {
      if (saved.step) setStep(saved.step);
      if (saved.notes_ar) setNotesAr(saved.notes_ar);
      if (saved.findings_ar) setFindingsAr(saved.findings_ar);
      if (saved.gps) setGpsCoords(saved.gps);
    }
    if (data.notes_ar) setNotesAr(data.notes_ar);
    if (data.findings_ar) setFindingsAr(data.findings_ar);
    if (data.latitude && data.longitude) {
      setGpsCoords({ lat: Number(data.latitude), lng: Number(data.longitude) });
    }

    // Load existing photos
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
      setChecklist(DEFAULT_CHECKLIST.map((c) => ({
        ...c, is_checked: false, value: undefined, notes: undefined,
      })));
    }

    setLoading(false);
  };

  // Auto-save on changes
  const autoSave = useCallback(async () => {
    if (!inspectionId) return;
    const autoData = { step, notes_ar: notesAr, findings_ar: findingsAr, gps: gpsCoords };
    await supabase.from("inspections").update({
      auto_saved_data: autoData as any,
      notes_ar: notesAr || null,
      findings_ar: findingsAr || null,
      latitude: gpsCoords?.lat ?? null,
      longitude: gpsCoords?.lng ?? null,
    }).eq("id", inspectionId);
  }, [inspectionId, step, notesAr, findingsAr, gpsCoords]);

  useEffect(() => {
    const timer = setTimeout(autoSave, 2000);
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
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
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
        latitude: gpsCoords?.lat ?? null,
        longitude: gpsCoords?.lng ?? null,
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
    // Delete existing and re-insert
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

  const canSubmit = () => {
    const requiredPhotoCats = PHOTO_CATEGORIES.filter(c => c.required).map(c => c.key);
    const hasAllPhotos = requiredPhotoCats.every(cat => photos.some(p => p.category === cat));
    const requiredChecks = checklist.filter(c => c.is_required);
    const allChecked = requiredChecks.every(c => c.is_checked);
    return !!gpsCoords && hasAllPhotos && allChecked;
  };

  const handleSubmit = async () => {
    if (!canSubmit() || !inspectionId) return;
    setSubmitting(true);
    await saveChecklist();
    await supabase.from("inspections").update({
      status: "submitted",
      completed: true,
      submitted_at: new Date().toISOString(),
      gps_verified: true,
      latitude: gpsCoords?.lat,
      longitude: gpsCoords?.lng,
      notes_ar: notesAr || null,
      findings_ar: findingsAr || null,
    }).eq("id", inspectionId);

    toast.success("تم إرسال المعاينة بنجاح");

    // Trigger AI analysis in background
    try {
      toast.info("جاري تحليل المعاينة بالذكاء الاصطناعي...");
      supabase.functions.invoke("analyze-inspection", {
        body: { inspection_id: inspectionId },
      }).then(({ error }) => {
        if (error) {
          console.error("AI analysis error:", error);
        }
      });
    } catch (err) {
      console.error("Failed to trigger AI analysis:", err);
    }

    setSubmitting(false);
    navigate("/inspector");
  };

  // Counts
  const requiredPhotoDone = PHOTO_CATEGORIES.filter(c => c.required).filter(c => photos.some(p => p.category === c.key)).length;
  const requiredPhotoTotal = PHOTO_CATEGORIES.filter(c => c.required).length;
  const checkedRequired = checklist.filter(c => c.is_required && c.is_checked).length;
  const totalRequired = checklist.filter(c => c.is_required).length;

  const overallProgress = Math.round(
    ((gpsCoords ? 1 : 0) + (requiredPhotoDone / requiredPhotoTotal) + (checkedRequired / Math.max(totalRequired, 1))) / 3 * 100
  );

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
          <span className="text-xs font-medium text-muted-foreground">
            {inspection?.assignment_id?.slice(0, 8)}
          </span>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        {/* Progress */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>التقدم الكلي</span>
            <span>{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-2" />
        </div>
        {/* Step indicators */}
        <div className="flex gap-1 mt-2">
          {STEPS.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStep(i)}
              className={`flex-1 py-1.5 rounded text-[10px] font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-accent text-accent-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-4 space-y-4">
        {step === 0 && (
          <StepLocation
            gpsCoords={gpsCoords}
            gpsLoading={gpsLoading}
            gpsError={gpsError}
            onCapture={captureGPS}
          />
        )}
        {step === 1 && (
          <StepPhotos
            title="الصور الخارجية"
            categories={PHOTO_CATEGORIES.filter(c => ["exterior_front", "exterior_back", "exterior_left", "exterior_right", "street_view", "surroundings"].includes(c.key))}
            photos={photos}
            saving={saving}
            onCapture={handlePhotoCapture}
            onRemove={removePhoto}
          />
        )}
        {step === 2 && (
          <StepPhotos
            title="الصور الداخلية"
            categories={PHOTO_CATEGORIES.filter(c => ["interior_living", "interior_kitchen", "interior_bathroom", "interior_bedroom"].includes(c.key))}
            photos={photos}
            saving={saving}
            onCapture={handlePhotoCapture}
            onRemove={removePhoto}
          />
        )}
        {step === 3 && (
          <StepChecklist checklist={checklist} onChange={setChecklist} />
        )}
        {step === 4 && (
          <StepNotes
            notesAr={notesAr}
            findingsAr={findingsAr}
            onNotesChange={setNotesAr}
            onFindingsChange={setFindingsAr}
          />
        )}
        {step === 5 && (
          <StepReview
            gpsCoords={gpsCoords}
            photoCount={photos.length}
            requiredPhotoDone={requiredPhotoDone}
            requiredPhotoTotal={requiredPhotoTotal}
            checkedRequired={checkedRequired}
            totalRequired={totalRequired}
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
          onClick={() => { setStep(s => s - 1); }}
        >
          <ChevronRight className="w-5 h-5 ml-1" /> السابق
        </Button>
        {step < STEPS.length - 1 ? (
          <Button
            className="flex-1 h-12 text-base"
            onClick={() => {
              if (step === 3) saveChecklist();
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

/* === Sub-components === */

function StepLocation({ gpsCoords, gpsLoading, gpsError, onCapture }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> تأكيد الموقع
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          يرجى تأكيد موقعك الحالي في موقع العقار المطلوب معاينته
        </p>
        {gpsCoords ? (
          <div className="bg-accent/50 rounded-lg p-4 text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
            <p className="text-sm font-medium">تم تحديد الموقع</p>
            <p className="text-xs text-muted-foreground font-mono" dir="ltr">
              {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
            </p>
          </div>
        ) : gpsError ? (
          <div className="bg-destructive/10 rounded-lg p-4 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{gpsError}</p>
          </div>
        ) : null}
        <Button
          onClick={onCapture}
          disabled={gpsLoading}
          className="w-full h-14 text-base"
          variant={gpsCoords ? "outline" : "default"}
        >
          {gpsLoading ? (
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
          ) : (
            <Navigation className="w-5 h-5 ml-2" />
          )}
          {gpsCoords ? "إعادة تحديد الموقع" : "تحديد الموقع"}
        </Button>
      </CardContent>
    </Card>
  );
}

function StepPhotos({ title, categories, photos, saving, onCapture, onRemove }: any) {
  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold flex items-center gap-2">
        <Camera className="w-5 h-5 text-primary" /> {title}
      </h2>
      {categories.map((cat: any) => {
        const catPhotos = photos.filter((p: PhotoItem) => p.category === cat.key);
        return (
          <Card key={cat.key} className={`border ${catPhotos.length > 0 ? "border-green-200 dark:border-green-800" : cat.required ? "border-yellow-200 dark:border-yellow-800" : ""}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{cat.label}</span>
                  {cat.required && <Badge variant="secondary" className="text-[9px]">مطلوب</Badge>}
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
                      <button
                        onClick={() => onRemove(p)}
                        className="absolute top-0 left-0 bg-destructive/80 text-white p-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="block">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  className="hidden"
                  onChange={(e) => onCapture(cat.key, e.target.files)}
                  disabled={saving}
                />
                <div className="flex items-center justify-center gap-2 h-11 border-2 border-dashed rounded-md text-sm text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  التقاط / رفع صورة
                </div>
              </label>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StepChecklist({ checklist, onChange }: { checklist: ChecklistItem[]; onChange: (c: ChecklistItem[]) => void }) {
  const categories = [...new Set(checklist.map(c => c.category))];
  const categoryLabels: Record<string, string> = {
    structure: "الهيكل الإنشائي",
    utilities: "المرافق والخدمات",
    exterior: "الخارجي",
    interior: "الداخلي",
    compliance: "المطابقة",
  };

  const toggle = (index: number) => {
    const next = [...checklist];
    next[index].is_checked = !next[index].is_checked;
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <h2 className="text-base font-bold flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-primary" /> قائمة الفحص
      </h2>
      {categories.map(cat => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{categoryLabels[cat] || cat}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklist.map((item, idx) => {
              if (item.category !== cat) return null;
              return (
                <label key={idx} className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={item.is_checked}
                    onCheckedChange={() => toggle(idx)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm">{item.label_ar}</span>
                    {item.is_required && (
                      <Badge variant="secondary" className="text-[9px] mr-2">مطلوب</Badge>
                    )}
                  </div>
                </label>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StepNotes({ notesAr, findingsAr, onNotesChange, onFindingsChange }: any) {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold flex items-center gap-2">
        <StickyNote className="w-5 h-5 text-primary" /> الملاحظات والنتائج
      </h2>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">ملاحظات المعاينة</label>
            <Textarea
              value={notesAr}
              onChange={e => onNotesChange(e.target.value)}
              placeholder="أدخل ملاحظاتك عن العقار..."
              rows={4}
              className="text-base"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">النتائج والمعطيات</label>
            <Textarea
              value={findingsAr}
              onChange={e => onFindingsChange(e.target.value)}
              placeholder="أدخل النتائج الرئيسية للمعاينة..."
              rows={4}
              className="text-base"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepReview({ gpsCoords, photoCount, requiredPhotoDone, requiredPhotoTotal, checkedRequired, totalRequired, canSubmit, submitting, onSubmit }: any) {
  const items = [
    { label: "الموقع (GPS)", done: !!gpsCoords, detail: gpsCoords ? `${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}` : "لم يتم التحديد" },
    { label: "الصور المطلوبة", done: requiredPhotoDone === requiredPhotoTotal, detail: `${requiredPhotoDone}/${requiredPhotoTotal}` },
    { label: "إجمالي الصور", done: photoCount > 0, detail: `${photoCount} صورة` },
    { label: "قائمة الفحص", done: checkedRequired === totalRequired, detail: `${checkedRequired}/${totalRequired}` },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold flex items-center gap-2">
        <Send className="w-5 h-5 text-primary" /> مراجعة وإرسال
      </h2>
      <Card>
        <CardContent className="p-4 space-y-3">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                {item.done ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
                <span className="text-sm">{item.label}</span>
              </div>
              <span className={`text-sm font-mono ${item.done ? "text-green-600" : "text-yellow-600"}`}>
                {item.detail}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      {!canSubmit && (
        <div className="bg-destructive/10 rounded-lg p-3 text-sm text-destructive text-center">
          يرجى إكمال جميع المتطلبات قبل الإرسال
        </div>
      )}
      <Button
        onClick={onSubmit}
        disabled={!canSubmit || submitting}
        className="w-full h-14 text-lg"
      >
        {submitting ? <Loader2 className="w-6 h-6 animate-spin ml-2" /> : <Send className="w-6 h-6 ml-2" />}
        إرسال المعاينة
      </Button>
    </div>
  );
}
