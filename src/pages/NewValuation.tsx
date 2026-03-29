import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  Send,
  Loader2,
  Sparkles,
  MapPin,
  Building2,
  Cog,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Step definitions (4 steps — discipline determined by AI) ──
const STEPS = [
  { id: 1, label: "العميل والمستندات" },
  { id: 2, label: "تفاصيل الأصل" },
  { id: 3, label: "عرض التقييم" },
  { id: 4, label: "المراجعة" },
] as const;

// ── Valuation purposes ──
const PURPOSES = [
  "بيع / شراء", "تمويل عقاري", "إعادة تقييم", "نزع ملكية للمنفعة العامة",
  "تصفية / تسوية", "تقارير مالية (IFRS)", "ضمان بنكي", "استثمار",
  "تأمين", "أغراض ضريبية", "نقل ملكية", "أخرى",
];

// ── Value bases ──
const VALUE_BASES = [
  "القيمة السوقية (Market Value)",
  "قيمة الاستثمار (Investment Value)",
  "القيمة العادلة (Fair Value)",
  "القيمة التصفوية (Liquidation Value)",
  "قيمة الاستخدام الحالي (Existing Use Value)",
];

// ── Document list (universal — AI will identify relevance) ──
const ALL_DOCS = [
  "صك الملكية", "رخصة البناء", "مخطط الموقع", "صور العقار",
  "عقود الإيجار (إن وجدت)", "فاتورة الشراء", "شهادة الصيانة",
  "صور المعدات", "كتالوج المصنع", "تقرير فني سابق", "مستندات إضافية",
];

// ── Asset fields — comprehensive (AI will classify which apply) ──
const ASSET_FIELDS = [
  // Location / General
  { key: "assetDescription", label: "وصف الأصل", placeholder: "صف الأصل المراد تقييمه (عقار، آلة، مزيج...)", required: true, section: "general" },
  { key: "city", label: "المدينة", placeholder: "اختر المدينة", required: true, section: "location" },
  { key: "district", label: "الحي / الموقع", placeholder: "اسم الحي أو موقع الأصل", required: true, section: "location" },
  { key: "address", label: "العنوان التفصيلي", placeholder: "العنوان الكامل", required: false, section: "location" },
  { key: "coordinates", label: "الإحداثيات", placeholder: "خط الطول، خط العرض", required: false, section: "location" },
  // Property-related
  { key: "deedNumber", label: "رقم الصك / وثيقة الملكية", placeholder: "رقم صك الملكية أو وثيقة الأصل", required: false, section: "property" },
  { key: "area", label: "المساحة (م²)", placeholder: "المساحة بالمتر المربع", required: false, section: "property" },
  { key: "plotNumber", label: "رقم القطعة", placeholder: "رقم القطعة", required: false, section: "property" },
  { key: "planNumber", label: "رقم المخطط", placeholder: "رقم المخطط", required: false, section: "property" },
  { key: "classification", label: "التصنيف / الاستخدام", placeholder: "سكني، تجاري، صناعي، مختلط", required: false, section: "property" },
  // Machinery-related
  { key: "machineName", label: "اسم المعدة / الآلة", placeholder: "أدخل اسم المعدة (إن وجد)", required: false, section: "machinery" },
  { key: "manufacturer", label: "الشركة المصنعة", placeholder: "الشركة المصنعة", required: false, section: "machinery" },
  { key: "model", label: "الموديل", placeholder: "رقم الموديل", required: false, section: "machinery" },
  { key: "yearMade", label: "سنة الصنع", placeholder: "سنة التصنيع", required: false, section: "machinery" },
  { key: "serialNumber", label: "الرقم التسلسلي", placeholder: "الرقم التسلسلي", required: false, section: "machinery" },
  { key: "assetCondition", label: "حالة الأصل", placeholder: "جديد، جيد، متوسط، يحتاج صيانة", required: false, section: "general" },
];

// ── Client fields ──
const CLIENT_FIELDS = [
  { key: "clientName", label: "اسم العميل / الجهة", placeholder: "أدخل اسم العميل", required: true },
  { key: "idNumber", label: "رقم الهوية / السجل التجاري", placeholder: "أدخل رقم التعريف", required: true },
  { key: "phone", label: "رقم الجوال", placeholder: "05XXXXXXXX", required: true },
  { key: "email", label: "البريد الإلكتروني", placeholder: "email@example.com", required: false },
  { key: "clientAddress", label: "العنوان", placeholder: "عنوان العميل", required: false },
  { key: "intendedUser", label: "المستخدم المقصود", placeholder: "الجهة المستفيدة من التقرير", required: true },
];

// ── Types ──
interface FormData {
  clientFields: Record<string, string>;
  uploadedDocs: string[];
  assetFields: Record<string, string>;
  purpose: string;
  valueBasis: string;
  valuationDate: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ActivityEntry {
  step: number;
  action: string;
  timestamp: Date;
}

// ── AI-detected discipline label ──
function detectDisciplineFromFields(fields: Record<string, string>): { id: string; label: string } {
  const hasRE = !!(fields.deedNumber?.trim() || fields.area?.trim() || fields.plotNumber?.trim() || fields.planNumber?.trim());
  const hasMA = !!(fields.machineName?.trim() || fields.manufacturer?.trim() || fields.model?.trim() || fields.serialNumber?.trim());
  if (hasRE && hasMA) return { id: "mixed", label: "تقييم مختلط (عقاري + آلات)" };
  if (hasMA) return { id: "machinery", label: "تقييم آلات ومعدات" };
  if (hasRE) return { id: "real_estate", label: "تقييم عقاري" };
  // Default from description
  const desc = (fields.assetDescription || "").toLowerCase();
  if (desc.includes("آل") || desc.includes("معد") || desc.includes("machine")) return { id: "machinery", label: "تقييم آلات ومعدات" };
  return { id: "real_estate", label: "تقييم عقاري" };
}

export default function NewValuation() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  const [formData, setFormData] = useState<FormData>({
    clientFields: {},
    uploadedDocs: [],
    assetFields: {},
    purpose: "",
    valueBasis: VALUE_BASES[0],
    valuationDate: "",
  });

  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const logActivity = useCallback((step: number, action: string) => {
    setActivityLog(prev => [...prev, { step, action, timestamp: new Date() }]);
  }, []);

  // ── AI-detected discipline ──
  const detectedDiscipline = useMemo(() => detectDisciplineFromFields(formData.assetFields), [formData.assetFields]);

  // ── Per-step validation ──
  const validateStep = useCallback((step: number): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1: {
        const requiredClient = CLIENT_FIELDS.filter(f => f.required);
        requiredClient.forEach(f => {
          if (!formData.clientFields[f.key]?.trim()) errors.push(`حقل "${f.label}" مطلوب`);
        });
        if (formData.uploadedDocs.length === 0) warnings.push("لم يتم رفع أي مستندات بعد");
        const optionalClient = CLIENT_FIELDS.filter(f => !f.required);
        optionalClient.forEach(f => {
          if (!formData.clientFields[f.key]?.trim()) warnings.push(`حقل "${f.label}" غير مكتمل`);
        });
        break;
      }

      case 2: {
        const requiredAsset = ASSET_FIELDS.filter(f => f.required);
        requiredAsset.forEach(f => {
          if (!formData.assetFields[f.key]?.trim()) errors.push(`حقل "${f.label}" مطلوب`);
        });
        // Warn if neither RE nor MA fields are filled
        const hasAnyDetail = ASSET_FIELDS.filter(f => f.section === "property" || f.section === "machinery")
          .some(f => formData.assetFields[f.key]?.trim());
        if (!hasAnyDetail) warnings.push("يُنصح بإدخال تفاصيل إضافية (عقارية أو آلات) لتحسين دقة التصنيف");
        break;
      }

      case 3:
        if (!formData.purpose) errors.push("يجب تحديد غرض التقييم");
        if (!formData.valuationDate) errors.push("يجب تحديد تاريخ التقييم");
        if (!completedSteps.has(1)) errors.push("يجب إكمال بيانات العميل والمستندات أولاً");
        if (!completedSteps.has(2)) errors.push("يجب إكمال تفاصيل الأصل أولاً");
        break;

      case 4:
        for (let s = 1; s <= 3; s++) {
          const sv = validateStep(s);
          if (sv.errors.length > 0) errors.push(`الخطوة ${s} تحتوي على بيانات ناقصة`);
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }, [formData, completedSteps]);

  // ── Progress % ──
  const progressPercent = useMemo(() => {
    let total = 0;
    // Step 1: client = 25%
    const clientReq = CLIENT_FIELDS.filter(f => f.required);
    const clientFilled = clientReq.filter(f => formData.clientFields[f.key]?.trim()).length;
    total += Math.round((clientFilled / Math.max(clientReq.length, 1)) * 20);
    if (formData.uploadedDocs.length > 0) total += 5;
    // Step 2: asset = 25%
    const assetReq = ASSET_FIELDS.filter(f => f.required);
    const assetFilled = assetReq.filter(f => formData.assetFields[f.key]?.trim()).length;
    total += Math.round((assetFilled / Math.max(assetReq.length, 1)) * 25);
    // Step 3: purpose + date = 25%
    if (formData.purpose) total += 12;
    if (formData.valuationDate) total += 13;
    return Math.min(total, 100);
  }, [formData]);

  // ── Step access control ──
  const canGoToStep = useCallback((targetStep: number): boolean => {
    if (targetStep === 1) return true;
    for (let s = 1; s < targetStep; s++) {
      const v = validateStep(s);
      if (v.errors.length > 0) return false;
    }
    return true;
  }, [validateStep]);

  const goNext = useCallback(() => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }
    if (validation.warnings.length > 0) {
      validation.warnings.forEach(w => toast.warning(w));
    }
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    logActivity(currentStep, `إكمال الخطوة ${currentStep}`);
    if (currentStep < STEPS.length) setCurrentStep(currentStep + 1);
  }, [currentStep, validateStep, logActivity]);

  const goPrev = useCallback(() => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    const validation = validateStep(4);
    if (!validation.valid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("يجب تسجيل الدخول أولاً");
        setSubmitting(false);
        return;
      }

      const { error: reqErr } = await supabase
        .from("valuation_requests")
        .insert({
          client_user_id: user.id,
          discipline: detectedDiscipline.id as any,
          purpose_ar: formData.purpose,
          value_basis_ar: formData.valueBasis,
          valuation_date: formData.valuationDate || new Date().toISOString().split("T")[0],
          status: "submitted",
          client_name_ar: formData.clientFields.clientName || "",
          client_id_number: formData.clientFields.idNumber || "",
          client_phone: formData.clientFields.phone || "",
          client_email: formData.clientFields.email || "",
          intended_user_ar: formData.clientFields.intendedUser || "",
          asset_data: formData.assetFields as any,
        })
        .select("id")
        .single();

      if (reqErr) throw reqErr;

      logActivity(4, "تم إرسال الطلب");
      toast.success("تم إرسال طلب التقييم بنجاح");
      navigate("/client");
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }, [formData, detectedDiscipline, validateStep, logActivity, navigate]);

  // ── Helpers ──
  const updateClientField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, clientFields: { ...prev.clientFields, [key]: value } }));
  };
  const updateAssetField = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, assetFields: { ...prev.assetFields, [key]: value } }));
  };
  const toggleDoc = (doc: string) => {
    setFormData(prev => ({
      ...prev,
      uploadedDocs: prev.uploadedDocs.includes(doc)
        ? prev.uploadedDocs.filter(d => d !== doc)
        : [...prev.uploadedDocs, doc],
    }));
  };

  const allStepValidations = useMemo(() => {
    return STEPS.map(s => ({ step: s, validation: validateStep(s.id) }));
  }, [validateStep]);

  // Group asset fields by section
  const sectionLabels: Record<string, { label: string; icon: typeof MapPin }> = {
    general: { label: "معلومات عامة", icon: Sparkles },
    location: { label: "الموقع", icon: MapPin },
    property: { label: "بيانات عقارية", icon: Building2 },
    machinery: { label: "بيانات الآلات والمعدات", icon: Cog },
  };

  const fieldsBySection = useMemo(() => {
    const sections: Record<string, typeof ASSET_FIELDS> = {};
    ASSET_FIELDS.forEach(f => {
      if (!sections[f.section]) sections[f.section] = [];
      sections[f.section].push(f);
    });
    return sections;
  }, []);

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header + Progress */}
        <div>
          <h2 className="text-lg font-bold text-foreground">طلب تقييم جديد</h2>
          <p className="text-sm text-muted-foreground mb-3">أكمل الخطوات التالية لإنشاء ملف تقييم جديد</p>
          <div className="flex items-center gap-3">
            <Progress value={progressPercent} className="h-2 flex-1" />
            <span className="text-xs font-semibold text-primary whitespace-nowrap">{progressPercent}%</span>
          </div>
        </div>

        {/* Stepper */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-card">
          <div className="flex items-center justify-between">
            {STEPS.map((step, i) => {
              const accessible = canGoToStep(step.id);
              const isCurrent = currentStep === step.id;
              const isDone = completedSteps.has(step.id);
              return (
                <div key={step.id} className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center">
                    <button
                      onClick={() => accessible && setCurrentStep(step.id)}
                      disabled={!accessible}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                        ${isCurrent
                          ? "gradient-primary text-primary-foreground"
                          : isDone
                            ? "bg-success text-success-foreground"
                            : accessible
                              ? "bg-muted text-muted-foreground hover:bg-primary/10 cursor-pointer"
                              : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                        }`}
                    >
                      {isDone && !isCurrent ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                    </button>
                    <span className={`text-[10px] mt-1 whitespace-nowrap ${isCurrent ? "text-primary font-medium" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-px mx-2 ${isDone ? "bg-success" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Current stage + AI discipline detection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>المرحلة الحالية:</span>
            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
              مسودة — الخطوة {currentStep} من {STEPS.length}
            </span>
          </div>
          {/* Show AI-detected discipline badge */}
          {(formData.assetFields.assetDescription?.trim() || 
            ASSET_FIELDS.filter(f => f.section === "property" || f.section === "machinery").some(f => formData.assetFields[f.key]?.trim())) && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent border border-accent text-accent-foreground">
              <Sparkles className="w-3 h-3" />
              <span>نوع التقييم: <strong>{detectedDiscipline.label}</strong></span>
            </div>
          )}
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-lg border border-border shadow-card p-6 animate-fade-in">

          {/* ─── Step 1: Client + Documents ─── */}
          {currentStep === 1 && (
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold text-foreground mb-1">بيانات العميل</h3>
                <p className="text-sm text-muted-foreground mb-5">أدخل معلومات العميل طالب التقييم</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CLIENT_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        {field.label}
                        {field.required && <span className="text-destructive mr-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={formData.clientFields[field.key] || ""}
                        onChange={(e) => updateClientField(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        dir={field.key === "email" ? "ltr" : "rtl"}
                        className={`w-full px-4 py-2.5 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                          ${field.required && !formData.clientFields[field.key]?.trim() ? "border-destructive/50" : "border-input"}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-foreground mb-1">رفع المستندات</h3>
                <p className="text-sm text-muted-foreground mb-5">قم برفع المستندات المتوفرة — سيحدد الذكاء الاصطناعي المستندات المطلوبة تلقائياً</p>
                <div className="space-y-3">
                  {ALL_DOCS.map((doc) => {
                    const uploaded = formData.uploadedDocs.includes(doc);
                    return (
                      <div key={doc} className={`flex items-center justify-between p-4 rounded-lg border transition-colors
                        ${uploaded ? "border-success/40 bg-success/5" : "border-dashed border-border hover:border-primary/40"}`}>
                        <div className="flex items-center gap-3">
                          {uploaded ? <CheckCircle2 className="w-5 h-5 text-success" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                          <span className="text-sm text-foreground">{doc}</span>
                        </div>
                        <button
                          onClick={() => { toggleDoc(doc); logActivity(1, uploaded ? `إلغاء رفع: ${doc}` : `رفع مستند: ${doc}`); }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors
                            ${uploaded ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive" : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"}`}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploaded ? "تم الرفع" : "رفع"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Asset Details (unified — AI classifies) ─── */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">تفاصيل الأصل</h3>
                <p className="text-sm text-muted-foreground mb-2">أدخل البيانات المتوفرة — سيحدد الذكاء الاصطناعي نوع التقييم والتصنيف تلقائياً</p>
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-accent/50 border border-accent text-accent-foreground w-fit mb-5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>نوع التقييم المكتشف: <strong>{detectedDiscipline.label}</strong></span>
                </div>
              </div>

              {Object.entries(fieldsBySection).map(([section, fields]) => {
                const meta = sectionLabels[section];
                const Icon = meta.icon;
                return (
                  <div key={section} className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border pb-2">
                      <Icon className="w-4 h-4 text-primary" />
                      {meta.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {fields.map((field) => (
                        <div key={field.key} className={field.key === "assetDescription" ? "sm:col-span-2" : ""}>
                          <label className="block text-sm font-medium text-foreground mb-1.5">
                            {field.label}
                            {field.required && <span className="text-destructive mr-1">*</span>}
                          </label>
                          {field.key === "assetDescription" ? (
                            <textarea
                              value={formData.assetFields[field.key] || ""}
                              onChange={(e) => updateAssetField(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              rows={3}
                              className={`w-full px-4 py-2.5 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none
                                ${field.required && !formData.assetFields[field.key]?.trim() ? "border-destructive/50" : "border-input"}`}
                            />
                          ) : (
                            <input
                              type="text"
                              value={formData.assetFields[field.key] || ""}
                              onChange={(e) => updateAssetField(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className={`w-full px-4 py-2.5 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                                ${field.required && !formData.assetFields[field.key]?.trim() ? "border-destructive/50" : "border-input"}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── Step 3: Valuation Presentation (عرض التقييم) ─── */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Eye className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-foreground">عرض التقييم</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-5">معاينة نطاق العمل والمدخلات قبل الإرسال — لا يتضمن نتائج تقييم أو تسعير</p>
              </div>

              {/* Scope summary */}
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">نطاق العمل</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">نوع التقييم (مكتشف بالذكاء)</span>
                      <span className="font-medium text-foreground flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        {detectedDiscipline.label}
                      </span>
                    </div>
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل</span><span className="font-medium text-foreground">{formData.clientFields.clientName || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المستندات المرفوعة</span><span className="font-medium text-foreground">{formData.uploadedDocs.length} من {ALL_DOCS.length}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">وصف الأصل</span><span className="font-medium text-foreground text-left max-w-[60%] truncate">{formData.assetFields.assetDescription || "-"}</span></div>
                  </div>
                </div>

                {/* Asset data preview */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">ملخص بيانات الأصل</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {ASSET_FIELDS.filter(f => formData.assetFields[f.key]?.trim()).map(f => (
                      <div key={f.key} className="flex justify-between">
                        <span className="text-muted-foreground">{f.label}</span>
                        <span className="font-medium text-foreground">{formData.assetFields[f.key]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Purpose & basis */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">غرض التقييم وأساس القيمة</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">غرض التقييم <span className="text-destructive">*</span></label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PURPOSES.map((p) => (
                          <button
                            key={p}
                            onClick={() => setFormData(prev => ({ ...prev, purpose: p }))}
                            className={`px-3 py-2.5 rounded-lg border text-sm transition-all
                              ${formData.purpose === p ? "border-primary bg-primary/5 text-primary font-medium" : "border-border text-muted-foreground hover:border-primary/30"}`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">أساس القيمة</label>
                      <select
                        value={formData.valueBasis}
                        onChange={(e) => setFormData(prev => ({ ...prev, valueBasis: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        {VALUE_BASES.map(vb => <option key={vb}>{vb}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1.5">تاريخ التقييم <span className="text-destructive">*</span></label>
                      <input type="date" value={formData.valuationDate} onChange={(e) => setFormData(prev => ({ ...prev, valuationDate: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                  </div>
                </div>

                {/* Assumptions */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">الافتراضات المبدئية</h4>
                  <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                    <li>يفترض أن المعلومات المقدمة من العميل صحيحة ودقيقة</li>
                    <li>يفترض عدم وجود تلوث بيئي أو تعديات نظامية</li>
                    <li>التقييم مبني على الوضع الراهن وقت المعاينة</li>
                    <li>لا يشمل التقييم أي أصول غير مذكورة في النطاق</li>
                  </ul>
                </div>

                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="text-sm font-semibold text-primary mb-2">المخرج المتوقع</h4>
                  <p className="text-sm text-primary/80">تقرير تقييم شامل وفق المعايير الدولية (IVS) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم)</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 4: Final Review ─── */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">المراجعة النهائية</h3>
                <p className="text-sm text-muted-foreground mb-5">راجع جميع البيانات قبل إرسال طلب التقييم</p>
              </div>

              <div className="space-y-3">
                {[
                  { label: "نوع التقييم (ذكاء اصطناعي)", value: detectedDiscipline.label },
                  { label: "العميل", value: formData.clientFields.clientName || "-" },
                  { label: "رقم الهوية", value: formData.clientFields.idNumber || "-" },
                  { label: "المستندات المرفوعة", value: `${formData.uploadedDocs.length} مستند` },
                  { label: "وصف الأصل", value: formData.assetFields.assetDescription || "-" },
                  { label: "غرض التقييم", value: formData.purpose || "-" },
                  { label: "أساس القيمة", value: formData.valueBasis },
                  { label: "تاريخ التقييم", value: formData.valuationDate || "-" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              {allStepValidations.some(sv => sv.validation.warnings.length > 0) && (
                <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 space-y-2">
                  <div className="flex items-center gap-2 text-warning font-medium text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>تنبيهات (لا تمنع الإرسال)</span>
                  </div>
                  {allStepValidations.flatMap(sv =>
                    sv.validation.warnings.map((w, i) => (
                      <p key={`${sv.step.id}-w-${i}`} className="text-xs text-warning/80 mr-6">• {w}</p>
                    ))
                  )}
                </div>
              )}

              {allStepValidations.some(sv => sv.validation.errors.length > 0 && sv.step.id < 4) && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>بيانات ناقصة (يجب إكمالها)</span>
                  </div>
                  {allStepValidations.filter(sv => sv.step.id < 4).flatMap(sv =>
                    sv.validation.errors.map((e, i) => (
                      <p key={`${sv.step.id}-e-${i}`} className="text-xs text-destructive/80 mr-6">• {e}</p>
                    ))
                  )}
                </div>
              )}

              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                سيتم إنشاء رقم مرجعي فريد للملف وإشعار فريق التقييم لبدء العمل على الطلب. بعد الإرسال لن تتمكن من تعديل البيانات.
              </div>

              {activityLog.length > 0 && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">سجل النشاط</h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {activityLog.map((entry, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{entry.action}</span>
                        <span className="text-muted-foreground/60">{entry.timestamp.toLocaleTimeString("ar-SA")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={goPrev} disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>

          {currentStep === STEPS.length ? (
            <button onClick={handleSubmit} disabled={submitting || !validateStep(4).valid}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-accent text-accent-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" />جارٍ الإرسال...</>) : (<><Send className="w-4 h-4" />إرسال الطلب</>)}
            </button>
          ) : (
            <button onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all">
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
