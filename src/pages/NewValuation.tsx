import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "@/components/layout/TopBar";
import { Progress } from "@/components/ui/progress";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  CheckCircle2,
  Cog,
  Layers,
  AlertTriangle,
  AlertCircle,
  Eye,
  Send,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Step definitions ──
const STEPS = [
  { id: 1, label: "نوع التقييم" },
  { id: 2, label: "العميل والمستندات" },
  { id: 3, label: "تفاصيل الأصل" },
  { id: 4, label: "عرض التقييم" },
  { id: 5, label: "المراجعة" },
] as const;

// ── Valuation disciplines ──
const DISCIPLINES = [
  { id: "real_estate", label: "تقييم عقاري", icon: Building2, desc: "تقييم الأراضي والمباني والعقارات بجميع أنواعها" },
  { id: "machinery", label: "تقييم آلات ومعدات", icon: Cog, desc: "تقييم المعدات الصناعية والآلات والأصول المنقولة" },
  { id: "mixed", label: "تقييم مختلط", icon: Layers, desc: "تقييم عقاري وآلات ومعدات معاً في ملف واحد" },
];

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

// ── Document lists by discipline ──
const DOCS_REAL_ESTATE = ["صك الملكية", "رخصة البناء", "مخطط الموقع", "صور العقار", "عقود الإيجار (إن وجدت)", "مستندات إضافية"];
const DOCS_MACHINERY = ["فاتورة الشراء", "شهادة الصيانة", "صور المعدات", "كتالوج المصنع", "تقرير فني سابق", "مستندات إضافية"];

// ── Real estate fields ──
const RE_FIELDS = [
  { key: "city", label: "المدينة", placeholder: "اختر المدينة", required: true },
  { key: "district", label: "الحي", placeholder: "اسم الحي", required: true },
  { key: "deedNumber", label: "رقم الصك", placeholder: "رقم صك الملكية", required: true },
  { key: "area", label: "المساحة (م²)", placeholder: "المساحة بالمتر المربع", required: true },
  { key: "plotNumber", label: "رقم القطعة", placeholder: "رقم القطعة", required: false },
  { key: "planNumber", label: "رقم المخطط", placeholder: "رقم المخطط", required: false },
  { key: "coordinates", label: "الإحداثيات", placeholder: "خط الطول، خط العرض", required: false },
  { key: "classification", label: "التصنيف حسب النظام", placeholder: "سكني، تجاري، مختلط", required: true },
];

// ── Machinery fields ──
const MA_FIELDS = [
  { key: "machineName", label: "اسم المعدة / الآلة", placeholder: "أدخل اسم المعدة", required: true },
  { key: "manufacturer", label: "الشركة المصنعة", placeholder: "الشركة المصنعة", required: true },
  { key: "model", label: "الموديل", placeholder: "رقم الموديل", required: true },
  { key: "yearMade", label: "سنة الصنع", placeholder: "سنة التصنيع", required: true },
  { key: "serialNumber", label: "الرقم التسلسلي", placeholder: "الرقم التسلسلي", required: false },
  { key: "condition", label: "الحالة", placeholder: "جديد، مستعمل، متوقف", required: true },
  { key: "location", label: "الموقع", placeholder: "موقع المعدة", required: true },
  { key: "operatingHours", label: "ساعات التشغيل", placeholder: "عدد ساعات التشغيل", required: false },
];

// ── Client fields ──
const CLIENT_FIELDS = [
  { key: "clientName", label: "اسم العميل / الجهة", placeholder: "أدخل اسم العميل", required: true },
  { key: "idNumber", label: "رقم الهوية / السجل التجاري", placeholder: "أدخل رقم التعريف", required: true },
  { key: "phone", label: "رقم الجوال", placeholder: "05XXXXXXXX", required: true },
  { key: "email", label: "البريد الإلكتروني", placeholder: "email@example.com", required: false },
  { key: "address", label: "العنوان", placeholder: "عنوان العميل", required: false },
  { key: "intendedUser", label: "المستخدم المقصود", placeholder: "الجهة المستفيدة من التقرير", required: true },
];

// ── Types ──
interface FormData {
  discipline: string;
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

// ── Activity log entry ──
interface ActivityEntry {
  step: number;
  action: string;
  timestamp: Date;
}

export default function NewValuation() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  const [formData, setFormData] = useState<FormData>({
    discipline: "",
    clientFields: {},
    uploadedDocs: [],
    assetFields: {},
    purpose: "",
    valueBasis: VALUE_BASES[0],
    valuationDate: "",
  });

  // Track which steps have been completed at least once
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const logActivity = useCallback((step: number, action: string) => {
    setActivityLog(prev => [...prev, { step, action, timestamp: new Date() }]);
  }, []);

  // ── Per-step validation ──
  const validateStep = useCallback((step: number): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1:
        if (!formData.discipline) errors.push("يجب اختيار نوع التقييم");
        break;

      case 2: {
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

      case 3: {
        const fields = (formData.discipline === "machinery") ? MA_FIELDS : RE_FIELDS;
        const requiredAsset = fields.filter(f => f.required);
        requiredAsset.forEach(f => {
          if (!formData.assetFields[f.key]?.trim()) errors.push(`حقل "${f.label}" مطلوب`);
        });
        const optionalAsset = fields.filter(f => !f.required);
        optionalAsset.forEach(f => {
          if (!formData.assetFields[f.key]?.trim()) warnings.push(`حقل "${f.label}" غير مكتمل`);
        });
        break;
      }

      case 4:
        if (!formData.purpose) errors.push("يجب تحديد غرض التقييم");
        if (!formData.valuationDate) errors.push("يجب تحديد تاريخ التقييم");
        // Step 4 requires steps 1-3 completed
        if (!completedSteps.has(1)) errors.push("يجب إكمال خطوة نوع التقييم أولاً");
        if (!completedSteps.has(2)) errors.push("يجب إكمال بيانات العميل والمستندات أولاً");
        if (!completedSteps.has(3)) errors.push("يجب إكمال تفاصيل الأصل أولاً");
        break;

      case 5:
        // Validate all previous steps
        for (let s = 1; s <= 4; s++) {
          const sv = validateStep(s);
          if (sv.errors.length > 0) errors.push(`الخطوة ${s} تحتوي على بيانات ناقصة`);
        }
        break;
    }

    return { valid: errors.length === 0, errors, warnings };
  }, [formData, completedSteps]);

  // ── Overall progress percentage ──
  const progressPercent = useMemo(() => {
    let total = 0;
    // Step 1: discipline selected = 20%
    if (formData.discipline) total += 20;
    // Step 2: client fields + docs = 20%
    const clientReq = CLIENT_FIELDS.filter(f => f.required);
    const clientFilled = clientReq.filter(f => formData.clientFields[f.key]?.trim()).length;
    total += Math.round((clientFilled / Math.max(clientReq.length, 1)) * 15);
    if (formData.uploadedDocs.length > 0) total += 5;
    // Step 3: asset fields = 20%
    const assetFields = (formData.discipline === "machinery") ? MA_FIELDS : RE_FIELDS;
    const assetReq = assetFields.filter(f => f.required);
    const assetFilled = assetReq.filter(f => formData.assetFields[f.key]?.trim()).length;
    total += Math.round((assetFilled / Math.max(assetReq.length, 1)) * 20);
    // Step 4: purpose + date = 20%
    if (formData.purpose) total += 10;
    if (formData.valuationDate) total += 10;
    // Step 5 = 20% (only on submit)
    return Math.min(total, 100);
  }, [formData]);

  // ── Can navigate to step? ──
  const canGoToStep = useCallback((targetStep: number): boolean => {
    if (targetStep === 1) return true;
    // Must complete all previous steps (no errors)
    for (let s = 1; s < targetStep; s++) {
      const v = validateStep(s);
      if (v.errors.length > 0) return false;
    }
    return true;
  }, [validateStep]);

  // ── Navigate to next step ──
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
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  }, [currentStep, validateStep, logActivity]);

  // ── Navigate to previous step ──
  const goPrev = useCallback(() => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  // ── Handle submit ──
  const handleSubmit = useCallback(async () => {
    const validation = validateStep(5);
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

      // Create valuation request
      const { data: request, error: reqErr } = await supabase
        .from("valuation_requests")
        .insert({
          client_user_id: user.id,
          discipline: formData.discipline as any,
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

      logActivity(5, "تم إرسال الطلب");
      toast.success("تم إرسال طلب التقييم بنجاح");
      navigate("/client");
    } catch (err: any) {
      toast.error(err?.message || "حدث خطأ أثناء إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }, [formData, validateStep, logActivity, navigate]);

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

  const currentValidation = validateStep(currentStep);
  const docs = formData.discipline === "machinery" ? DOCS_MACHINERY : DOCS_REAL_ESTATE;
  const assetFieldsDef = formData.discipline === "machinery" ? MA_FIELDS : RE_FIELDS;

  // Collect all issues for review step
  const allStepValidations = useMemo(() => {
    return STEPS.map(s => ({ step: s, validation: validateStep(s.id) }));
  }, [validateStep]);

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

        {/* Current Stage Label */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>المرحلة الحالية:</span>
          <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
            مسودة — الخطوة {currentStep} من {STEPS.length}
          </span>
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-lg border border-border shadow-card p-6 animate-fade-in">

          {/* ─── Step 1: Discipline ─── */}
          {currentStep === 1 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">اختر نوع التقييم</h3>
              <p className="text-sm text-muted-foreground mb-5">حدد تخصص التقييم المطلوب</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {DISCIPLINES.map((d) => {
                  const Icon = d.icon;
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setFormData(prev => ({ ...prev, discipline: d.id }));
                        logActivity(1, `اختيار نوع التقييم: ${d.label}`);
                      }}
                      className={`flex items-start gap-3 p-5 rounded-lg border-2 transition-all text-right
                        ${formData.discipline === d.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0
                        ${formData.discipline === d.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-foreground">{d.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{d.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Step 2: Client + Documents ─── */}
          {currentStep === 2 && (
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
                <p className="text-sm text-muted-foreground mb-5">قم برفع المستندات المطلوبة لإتمام عملية التقييم</p>
                <div className="space-y-3">
                  {docs.map((doc) => {
                    const uploaded = formData.uploadedDocs.includes(doc);
                    return (
                      <div key={doc} className={`flex items-center justify-between p-4 rounded-lg border transition-colors
                        ${uploaded ? "border-success/40 bg-success/5" : "border-dashed border-border hover:border-primary/40"}`}>
                        <div className="flex items-center gap-3">
                          {uploaded ? (
                            <CheckCircle2 className="w-5 h-5 text-success" />
                          ) : (
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className="text-sm text-foreground">{doc}</span>
                        </div>
                        <button
                          onClick={() => {
                            toggleDoc(doc);
                            logActivity(2, uploaded ? `إلغاء رفع: ${doc}` : `رفع مستند: ${doc}`);
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors
                            ${uploaded
                              ? "bg-success/10 text-success hover:bg-destructive/10 hover:text-destructive"
                              : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                            }`}
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

          {/* ─── Step 3: Asset Details ─── */}
          {currentStep === 3 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">تفاصيل الأصل</h3>
              <p className="text-sm text-muted-foreground mb-5">أدخل البيانات الأساسية للأصل المراد تقييمه</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assetFieldsDef.map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      {field.label}
                      {field.required && <span className="text-destructive mr-1">*</span>}
                    </label>
                    <input
                      type="text"
                      value={formData.assetFields[field.key] || ""}
                      onChange={(e) => updateAssetField(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className={`w-full px-4 py-2.5 rounded-lg border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring
                        ${field.required && !formData.assetFields[field.key]?.trim() ? "border-destructive/50" : "border-input"}`}
                    />
                  </div>
                ))}
              </div>
              {formData.discipline === "mixed" && (
                <div className="mt-6 p-4 rounded-lg bg-accent/50 border border-accent text-sm text-accent-foreground">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">تقييم مختلط</span>
                  </div>
                  <p>يرجى إدخال بيانات الأصل العقاري أعلاه. سيتم طلب بيانات الآلات والمعدات بعد تعيين المقيّم.</p>
                </div>
              )}
            </div>
          )}

          {/* ─── Step 4: Valuation Presentation (عرض التقييم) ─── */}
          {currentStep === 4 && (
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
                    <div className="flex justify-between"><span className="text-muted-foreground">نوع التقييم</span><span className="font-medium text-foreground">{DISCIPLINES.find(d => d.id === formData.discipline)?.label || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">العميل</span><span className="font-medium text-foreground">{formData.clientFields.clientName || "-"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">المستندات المرفوعة</span><span className="font-medium text-foreground">{formData.uploadedDocs.length} من {docs.length}</span></div>
                  </div>
                </div>

                {/* Asset preview */}
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <h4 className="text-sm font-semibold text-foreground mb-3">ملخص بيانات الأصل</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {assetFieldsDef.filter(f => formData.assetFields[f.key]?.trim()).map(f => (
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
                      <label className="block text-sm font-medium text-foreground mb-2">
                        غرض التقييم <span className="text-destructive">*</span>
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PURPOSES.map((p) => (
                          <button
                            key={p}
                            onClick={() => setFormData(prev => ({ ...prev, purpose: p }))}
                            className={`px-3 py-2.5 rounded-lg border text-sm transition-all
                              ${formData.purpose === p
                                ? "border-primary bg-primary/5 text-primary font-medium"
                                : "border-border text-muted-foreground hover:border-primary/30"
                              }`}
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
                      <label className="block text-sm font-medium text-foreground mb-1.5">
                        تاريخ التقييم <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.valuationDate}
                        onChange={(e) => setFormData(prev => ({ ...prev, valuationDate: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
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

                {/* Expected output */}
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="text-sm font-semibold text-primary mb-2">المخرج المتوقع</h4>
                  <p className="text-sm text-primary/80">
                    تقرير تقييم شامل وفق المعايير الدولية (IVS) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 5: Final Review ─── */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-1">المراجعة النهائية</h3>
                <p className="text-sm text-muted-foreground mb-5">راجع جميع البيانات قبل إرسال طلب التقييم</p>
              </div>

              {/* Summary cards */}
              <div className="space-y-3">
                {[
                  { label: "نوع التقييم", value: DISCIPLINES.find(d => d.id === formData.discipline)?.label || "-" },
                  { label: "العميل", value: formData.clientFields.clientName || "-" },
                  { label: "رقم الهوية", value: formData.clientFields.idNumber || "-" },
                  { label: "المستندات المرفوعة", value: `${formData.uploadedDocs.length} مستند` },
                  { label: "غرض التقييم", value: formData.purpose || "-" },
                  { label: "أساس القيمة", value: formData.valueBasis },
                  { label: "تاريخ التقييم", value: formData.valuationDate || "-" },
                  { label: "تصنيف الأصل", value: "سيتم تحديده تلقائياً بالذكاء الاصطناعي" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Warnings / Errors */}
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

              {allStepValidations.some(sv => sv.validation.errors.length > 0 && sv.step.id < 5) && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
                  <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>بيانات ناقصة (يجب إكمالها)</span>
                  </div>
                  {allStepValidations.filter(sv => sv.step.id < 5).flatMap(sv =>
                    sv.validation.errors.map((e, i) => (
                      <p key={`${sv.step.id}-e-${i}`} className="text-xs text-destructive/80 mr-6">• {e}</p>
                    ))
                  )}
                </div>
              )}

              {/* Post-submission info */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                سيتم إنشاء رقم مرجعي فريد للملف وإشعار فريق التقييم لبدء العمل على الطلب. بعد الإرسال لن تتمكن من تعديل البيانات.
              </div>

              {/* Activity log */}
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
          <button
            onClick={goPrev}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>

          {currentStep === STEPS.length ? (
            <button
              onClick={handleSubmit}
              disabled={submitting || !validateStep(5).valid}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-accent text-accent-foreground hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  إرسال الطلب
                </>
              )}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all"
            >
              التالي
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
