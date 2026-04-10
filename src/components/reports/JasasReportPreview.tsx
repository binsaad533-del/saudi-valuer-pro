import { Separator } from "@/components/ui/separator";
import logo from "@/assets/logo.png";

/* ── Sample data for preview ── */
const SAMPLE = {
  reportNumber: "JV-2026-0412",
  valuationDate: "2026-04-01",
  issueDate: "2026-04-10",
  objective: "تحديد القيمة السوقية العادلة للآلات والمعدات المملوكة للعميل وفقاً لمعايير التقييم الدولية IVS 2025 ومتطلبات الهيئة السعودية للمقيمين المعتمدين.",
  scope: "يشمل نطاق العمل جميع الآلات والمعدات الثابتة والمتحركة الموجودة في موقع العميل، بما في ذلك خطوط الإنتاج والمعدات المساندة.",
  methodology: "تم اعتماد أسلوب التكلفة (Cost Approach) كمنهج رئيسي مع الاستئناس بأسلوب السوق (Market Approach) للتحقق من معقولية النتائج.",
  estimatedValue: "12,750,000",
  estimatedValueText: "اثنا عشر مليوناً وسبعمائة وخمسون ألف ريال سعودي",
  currency: "SAR",
  assumptions: [
    "جميع الآلات في حالة تشغيلية وقت المعاينة",
    "لا توجد التزامات مالية أو رهونات على الأصول المقيّمة",
    "المعلومات المقدمة من العميل دقيقة وكاملة",
  ],
  limitations: [
    "لم يتم إجراء فحص فني تفصيلي للأجزاء الداخلية للآلات",
    "التقييم لا يشمل الأصول غير الملموسة أو المخزون",
  ],
  assets: [
    { type: "خطوط إنتاج", qty: 3, value: "7,200,000" },
    { type: "مولدات كهربائية", qty: 5, value: "1,850,000" },
    { type: "رافعات صناعية", qty: 8, value: "1,400,000" },
    { type: "أنظمة تبريد", qty: 4, value: "980,000" },
    { type: "معدات مساندة", qty: 12, value: "1,320,000" },
  ],
};

/* ── Shared page shell ── */
function PageShell({ children, pageNum }: { children: React.ReactNode; pageNum: number }) {
  return (
    <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden" style={{ aspectRatio: "210/297" }}>
      <div className="h-full flex flex-col justify-between p-10">
        <div className="flex-1">{children}</div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-4 border-t border-border/50">
          <span>شركة جساس للتقييم — Jassas Valuation Co.</span>
          <span>{pageNum}</span>
        </div>
      </div>
    </div>
  );
}

/* ── Page 1: Cover ── */
function CoverPage() {
  return (
    <PageShell pageNum={1}>
      <div className="flex flex-col h-full justify-between">
        {/* Top: Logo + Confidential */}
        <div className="flex items-start justify-between">
          <img src={logo} alt="جساس" className="w-14 h-14 object-contain" />
          <div className="text-left" dir="ltr">
            <p className="text-[10px] text-muted-foreground font-medium">Jassas Valuation Co.</p>
          </div>
        </div>

        {/* Center: Title block */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">تقرير تقييم</h1>
            <h2 className="text-xl font-semibold text-primary">الآلات والمعدات</h2>
          </div>

          <Separator className="w-24 mx-auto" />

          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2">
              <span className="text-foreground font-medium">{SAMPLE.reportNumber}</span>
              <span>رقم التقرير</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-foreground font-medium">{SAMPLE.valuationDate}</span>
              <span>تاريخ التقييم</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-foreground font-medium">{SAMPLE.issueDate}</span>
              <span>تاريخ الإصدار</span>
            </div>
          </div>
        </div>

        {/* Bottom: Copy + Confidential */}
        <div className="space-y-3 text-center">
          <div className="inline-block border border-border rounded px-4 py-1.5">
            <span className="text-xs text-muted-foreground">نسخة: </span>
            <span className="text-xs font-semibold text-foreground">عميل</span>
          </div>
          <p className="text-[11px] text-destructive/80 font-medium">
            سري — للاستخدام الحصري للمستلم
          </p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Page 2: Executive Summary ── */
function ExecutiveSummaryPage() {
  return (
    <PageShell pageNum={2}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">الملخص التنفيذي</h2>
          <Separator />
        </div>

        {/* Objective */}
        <Section title="الهدف">
          <p className="text-sm text-muted-foreground leading-relaxed">{SAMPLE.objective}</p>
        </Section>

        {/* Scope */}
        <Section title="النطاق">
          <p className="text-sm text-muted-foreground leading-relaxed">{SAMPLE.scope}</p>
        </Section>

        {/* Methodology */}
        <Section title="المنهج">
          <p className="text-sm text-muted-foreground leading-relaxed">{SAMPLE.methodology}</p>
        </Section>

        {/* Estimated Value */}
        <Section title="القيمة التقديرية">
          <div className="bg-primary/5 border border-primary/10 rounded px-4 py-3 text-center">
            <p className="text-2xl font-bold text-primary">{SAMPLE.estimatedValue} {SAMPLE.currency}</p>
          </div>
        </Section>

        {/* Assumptions */}
        <Section title="الافتراضات">
          <ul className="space-y-1.5">
            {SAMPLE.assumptions.map((a, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{a}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Limitations */}
        <Section title="القيود">
          <ul className="space-y-1.5">
            {SAMPLE.limitations.map((l, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                <span className="leading-relaxed">{l}</span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </PageShell>
  );
}

/* ── Page 3: Asset Table ── */
function AssetTablePage() {
  const total = SAMPLE.assets.reduce(
    (sum, a) => sum + Number(a.value.replace(/,/g, "")),
    0
  ).toLocaleString("en-US");

  return (
    <PageShell pageNum={3}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">جدول الأصول المقيّمة</h2>
          <Separator />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-2.5 font-semibold text-foreground">نوع الأصل</th>
              <th className="text-center py-2.5 font-semibold text-foreground w-20">الكمية</th>
              <th className="text-left py-2.5 font-semibold text-foreground w-36" dir="ltr">القيمة (SAR)</th>
            </tr>
          </thead>
          <tbody>
            {SAMPLE.assets.map((asset, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-2.5 text-muted-foreground">{asset.type}</td>
                <td className="py-2.5 text-center text-muted-foreground">{asset.qty}</td>
                <td className="py-2.5 text-left text-muted-foreground" dir="ltr">{asset.value}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/20">
              <td className="py-3 font-bold text-foreground">الإجمالي</td>
              <td className="py-3 text-center font-bold text-foreground">
                {SAMPLE.assets.reduce((s, a) => s + a.qty, 0)}
              </td>
              <td className="py-3 text-left font-bold text-primary" dir="ltr">{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </PageShell>
  );
}

/* ── Page 4: Final Value ── */
function FinalValuePage() {
  return (
    <PageShell pageNum={4}>
      <div className="flex flex-col h-full items-center justify-center text-center gap-8">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-foreground">النتيجة النهائية للتقييم</h2>
          <Separator className="w-20 mx-auto" />
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">القيمة السوقية العادلة</p>
          <p className="text-4xl font-bold text-primary tracking-tight">
            {SAMPLE.estimatedValue} <span className="text-2xl">SAR</span>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
            {SAMPLE.estimatedValueText}
          </p>
        </div>

        <div className="border border-border rounded px-6 py-4 max-w-sm space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">
            تمثل هذه القيمة رأي المقيّم المعتمد بناءً على المعلومات المتاحة وقت التقييم، وفقاً لمعايير التقييم الدولية IVS 2025.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Helpers ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

/* ── Main Export ── */
export default function JasasReportPreview() {
  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8" dir="rtl">
      <CoverPage />
      <ExecutiveSummaryPage />
      <AssetTablePage />
      <FinalValuePage />
    </div>
  );
}
