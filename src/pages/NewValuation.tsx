import { useState } from "react";
import TopBar from "@/components/layout/TopBar";
import {
  Building2,
  Home,
  Landmark,
  MapPin,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Upload,
  FileText,
  CheckCircle2,
  Cog,
  Layers,
} from "lucide-react";

const valuationDisciplines = [
  { id: "real_estate", label: "تقييم عقاري", icon: Building2, desc: "تقييم الأراضي والمباني والعقارات بجميع أنواعها" },
  { id: "machinery", label: "تقييم آلات ومعدات", icon: Cog, desc: "تقييم المعدات الصناعية والآلات والأصول المنقولة" },
  { id: "mixed", label: "تقييم مختلط", icon: Layers, desc: "تقييم عقاري وآلات ومعدات معاً في ملف واحد" },
];


const valuationPurposes = [
  "بيع / شراء",
  "تمويل عقاري",
  "إعادة تقييم",
  "نزع ملكية للمنفعة العامة",
  "تصفية / تسوية",
  "تقارير مالية (IFRS)",
  "ضمان بنكي",
  "استثمار",
  "تأمين",
  "أغراض ضريبية",
  "نقل ملكية",
  "أخرى",
];

const steps = [
  { id: 1, label: "نوع التقييم" },
  { id: 2, label: "العميل والمستندات" },
  { id: 3, label: "تفاصيل الأصل" },
  { id: 4, label: "غرض التقييم" },
  { id: 5, label: "المراجعة" },
];

export default function NewValuation() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedPurpose, setSelectedPurpose] = useState("");

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-foreground">طلب تقييم جديد</h2>
          <p className="text-sm text-muted-foreground">أكمل الخطوات التالية لإنشاء ملف تقييم جديد</p>
        </div>

        {/* Stepper */}
        <div className="bg-card rounded-lg border border-border p-5 shadow-card">
          <div className="flex items-center justify-between">
            {steps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-2 flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${currentStep === step.id
                        ? "gradient-primary text-primary-foreground"
                        : currentStep > step.id
                          ? "bg-success text-success-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                  >
                    {currentStep > step.id ? <CheckCircle2 className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`text-[10px] mt-1 whitespace-nowrap ${currentStep === step.id ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-2 ${currentStep > step.id ? "bg-success" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-card rounded-lg border border-border shadow-card p-6 animate-fade-in">
          {/* Step 1: Discipline */}
          {currentStep === 1 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">اختر نوع التقييم</h3>
              <p className="text-sm text-muted-foreground mb-5">حدد تخصص التقييم المطلوب</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {valuationDisciplines.map((d) => {
                  const Icon = d.icon;
                  return (
                    <button
                      key={d.id}
                      onClick={() => { setSelectedDiscipline(d.id); setSelectedType(""); }}
                      className={`flex items-start gap-3 p-5 rounded-lg border-2 transition-all text-right
                        ${selectedDiscipline === d.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30 hover:bg-muted/30"
                        }`}
                    >
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0
                        ${selectedDiscipline === d.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
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

          {/* Step 3: Asset Details */}
          {currentStep === 3 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">تفاصيل الأصل</h3>
              <p className="text-sm text-muted-foreground mb-5">أدخل البيانات الأساسية للأصل المراد تقييمه</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(selectedDiscipline === "real_estate" || selectedDiscipline === "mixed"
                  ? [
                      { label: "المدينة", placeholder: "اختر المدينة" },
                      { label: "الحي", placeholder: "اسم الحي" },
                      { label: "رقم الصك", placeholder: "رقم صك الملكية" },
                      { label: "المساحة (م²)", placeholder: "المساحة بالمتر المربع" },
                      { label: "رقم القطعة", placeholder: "رقم القطعة" },
                      { label: "رقم المخطط", placeholder: "رقم المخطط" },
                      { label: "الإحداثيات", placeholder: "خط الطول، خط العرض" },
                      { label: "التصنيف حسب النظام", placeholder: "سكني، تجاري، مختلط" },
                    ]
                  : [
                      { label: "اسم المعدة / الآلة", placeholder: "أدخل اسم المعدة" },
                      { label: "الشركة المصنعة", placeholder: "الشركة المصنعة" },
                      { label: "الموديل", placeholder: "رقم الموديل" },
                      { label: "سنة الصنع", placeholder: "سنة التصنيع" },
                      { label: "الرقم التسلسلي", placeholder: "الرقم التسلسلي" },
                      { label: "الحالة", placeholder: "جديد، مستعمل، متوقف" },
                      { label: "الموقع", placeholder: "موقع المعدة" },
                      { label: "ساعات التشغيل", placeholder: "عدد ساعات التشغيل" },
                    ]
                ).map((field) => (
                  <div key={field.label}>
                    <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                    <input
                      type="text"
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Purpose */}
          {currentStep === 4 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">غرض التقييم وأساس القيمة</h3>
              <p className="text-sm text-muted-foreground mb-5">حدد الغرض من التقييم وفقاً لمعايير التقييم الدولية</p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">غرض التقييم</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {valuationPurposes.map((p) => (
                      <button
                        key={p}
                        onClick={() => setSelectedPurpose(p)}
                        className={`px-3 py-2.5 rounded-lg border text-sm transition-all
                          ${selectedPurpose === p
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
                  <select className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option>القيمة السوقية (Market Value)</option>
                    <option>قيمة الاستثمار (Investment Value)</option>
                    <option>القيمة العادلة (Fair Value)</option>
                    <option>القيمة التصفوية (Liquidation Value)</option>
                    <option>قيمة الاستخدام الحالي (Existing Use Value)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">تاريخ التقييم</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Client + Documents (merged) */}
          {currentStep === 2 && (
            <div className="space-y-8">
              <div>
                <h3 className="font-semibold text-foreground mb-1">بيانات العميل</h3>
                <p className="text-sm text-muted-foreground mb-5">أدخل معلومات العميل طالب التقييم</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "اسم العميل / الجهة", placeholder: "أدخل اسم العميل" },
                    { label: "رقم الهوية / السجل التجاري", placeholder: "أدخل رقم التعريف" },
                    { label: "رقم الجوال", placeholder: "05XXXXXXXX" },
                    { label: "البريد الإلكتروني", placeholder: "email@example.com" },
                    { label: "العنوان", placeholder: "عنوان العميل" },
                    { label: "المستخدم المقصود", placeholder: "الجهة المستفيدة من التقرير" },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                      <input
                        type="text"
                        placeholder={field.placeholder}
                        className="w-full px-4 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-foreground mb-1">رفع المستندات</h3>
                <p className="text-sm text-muted-foreground mb-5">قم برفع المستندات المطلوبة لإتمام عملية التقييم</p>
                <div className="space-y-3">
                  {(selectedDiscipline === "machinery"
                    ? ["فاتورة الشراء", "شهادة الصيانة", "صور المعدات", "كتالوج المصنع", "تقرير فني سابق", "مستندات إضافية"]
                    : ["صك الملكية", "رخصة البناء", "مخطط الموقع", "صور العقار", "عقود الإيجار (إن وجدت)", "مستندات إضافية"]
                  ).map((doc) => (
                    <div key={doc} className="flex items-center justify-between p-4 rounded-lg border border-dashed border-border hover:border-primary/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{doc}</span>
                      </div>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted text-muted-foreground text-xs hover:bg-primary/10 hover:text-primary transition-colors">
                        <Upload className="w-3.5 h-3.5" />
                        رفع
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Review */}
          {currentStep === 6 && (
            <div>
              <h3 className="font-semibold text-foreground mb-1">مراجعة الطلب</h3>
              <p className="text-sm text-muted-foreground mb-5">راجع جميع البيانات قبل إرسال طلب التقييم</p>
              <div className="space-y-4">
                {[
                  { label: "نوع التقييم", value: valuationDisciplines.find(d => d.id === selectedDiscipline)?.label || "-" },
                  { label: "تصنيف الأصل", value: selectedType ? ([...propertyTypes, ...machineryTypes].find(p => p.id === selectedType)?.label || "-") : "-" },
                  { label: "غرض التقييم", value: selectedPurpose || "-" },
                  { label: "الحالة", value: "سيتم إنشاء الملف وبدء سير العمل" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-primary">
                سيتم إنشاء رقم مرجعي فريد للملف وإشعار فريق التقييم لبدء العمل على الطلب.
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
            السابق
          </button>
          <button
            onClick={() => setCurrentStep(Math.min(steps.length, currentStep + 1))}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-all
              ${currentStep === steps.length
                ? "gradient-accent text-accent-foreground"
                : "gradient-primary text-primary-foreground"
              } hover:opacity-90`}
          >
            {currentStep === steps.length ? "إرسال الطلب" : "التالي"}
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
