import { useRef, useCallback, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { QRCodeSVG } from "qrcode.react";
import { Lock, FileText, ShieldCheck, Clock } from "lucide-react";
import jasasLogo from "@/assets/jasas-logo.png";

/* ══════════════════════════════════════════════
   Sample Data — Executive Style
   ══════════════════════════════════════════════ */
const SAMPLE = {
  reportNumber: "JV-2026-0412",
  reportId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  valuationDate: "2026-04-01",
  issueDate: "2026-04-10",
  recipient: { name: "محمد العبدالله", email: "m.abdullah@company.sa" },
  assumptions: [
    "جميع الآلات في حالة تشغيلية وقت المعاينة",
    "لا توجد التزامات مالية أو رهونات على الأصول",
    "المعلومات المقدمة من العميل دقيقة وكاملة",
  ],
  limitations: [
    "لم يتم فحص الأجزاء الداخلية للآلات",
    "التقييم لا يشمل الأصول غير الملموسة أو المخزون",
  ],
  disclosures: [
    "لا توجد علاقة مالية أو شخصية تؤثر على استقلالية التقييم",
    "التقرير معدّ وفقاً لـ IVS 2025 ومتطلبات تقييم",
    "المقيّم مؤهل لإجراء هذا النوع من التقييمات",
    "التقرير حصري للمستلم ولا يجوز تداوله دون موافقة خطية",
  ],
  documents: [
    "صك ملكية المصنع — 2020-06-15",
    "فواتير شراء المعدات الأصلية",
    "عقود الصيانة السارية",
    "تقارير الفحص الفني السابقة",
    "شهادات المطابقة والجودة",
  ],
  inspectionPhotos: [
    { caption: "خط الإنتاج الرئيسي" },
    { caption: "المولدات الكهربائية" },
    { caption: "الرافعات الصناعية" },
    { caption: "أنظمة التبريد المركزية" },
    { caption: "لوحة التحكم الرئيسية" },
    { caption: "معدات ورشة الصيانة" },
  ],
  assets: [
    { type: "خطوط إنتاج", qty: 3, value: "7,200,000" },
    { type: "مولدات كهربائية", qty: 5, value: "1,850,000" },
    { type: "رافعات صناعية", qty: 8, value: "1,400,000" },
    { type: "أنظمة تبريد", qty: 4, value: "980,000" },
    { type: "معدات مساندة", qty: 12, value: "1,320,000" },
  ],
  estimatedValue: "12,750,000",
  estimatedValueText: "اثنا عشر مليوناً وسبعمائة وخمسون ألف ريال سعودي",
  currency: "SAR",
  attachmentIntelligence: {
    financialMetrics: [
      { label: "إجمالي تكلفة الاستبدال (RCN)", value: "18,200,000 SAR", source: "فواتير الشراء" },
      { label: "إجمالي الإهلاك المتراكم", value: "5,450,000 SAR", source: "سجلات الصيانة" },
      { label: "متوسط العمر الإنتاجي المتبقي", value: "12 عاماً", source: "تقارير الفحص الفني" },
      { label: "تكلفة الصيانة السنوية", value: "420,000 SAR", source: "عقود الصيانة" },
    ],
    keyIndicators: [
      { indicator: "نسبة الإهلاك الإجمالي", value: "30%", status: "normal" as const },
      { indicator: "معدل التشغيل الفعلي", value: "87%", status: "good" as const },
      { indicator: "نسبة المعدات بضمان ساري", value: "40%", status: "warning" as const },
      { indicator: "اكتمال سجلات الصيانة", value: "92%", status: "good" as const },
    ],
    risks: [
      "3 معدات تجاوزت 70% من عمرها الإنتاجي — تتطلب مراقبة قريبة",
      "عدم توفر فواتير أصلية لـ 2 من الرافعات — اعتمد على تقدير السوق",
      "عقد صيانة المولدات ينتهي خلال 60 يوماً — قد يؤثر على القيمة التشغيلية",
    ],
    used: [
      "صك ملكية المصنع — التحقق من الملكية والموقع",
      "فواتير شراء المعدات — تحديد تكلفة الاستبدال الأصلية",
      "عقود الصيانة — تقدير الحالة التشغيلية والإهلاك",
      "تقارير الفحص الفني — تأكيد العمر الإنتاجي المتبقي",
    ],
    ignored: [
      "شهادات المطابقة — معلومات تنظيمية لا تؤثر على القيمة مباشرة",
    ],
    missing: [
      "جدول الإنتاج الشهري — لتقدير معدل الاستخدام الفعلي بدقة",
      "تقارير الأعطال للسنة الأخيرة — لتحسين تقدير الإهلاك الوظيفي",
    ],
    valueImpact: "ساهمت المرفقات في تحديد 85% من مكونات القيمة النهائية. تم استخدام فواتير الشراء كأساس لتكلفة الاستبدال، وعقود الصيانة لتقدير نسبة الإهلاك. المرفقات المفقودة قد تؤثر على دقة التقدير بنسبة ±5%.",
  },
};

const VERIFY_BASE = "https://jsaas-valuation.com/verify";
const TOTAL_PAGES = 13;

/* ── Company & Valuer Identity (read-only) ── */
const COMPANY_IDENTITY = {
  companyName: "جساس للتقييم",
  valuerName: "أحمد سعد أحمد المالكي",
  licenseNumber: "4306",
  memberships: ["4210000041", "1210001217"],
  crNumber: "7016803038",
} as const;

const TOC = [
  { id: "exec-summary", num: 1, title: "الملخص التنفيذي" },
  { id: "scope", num: 2, title: "نطاق العمل" },
  { id: "asset-def", num: 3, title: "تعريف الأصل" },
  { id: "documents", num: 4, title: "المستندات" },
  { id: "attachment-intel", num: 5, title: "تحليل المرفقات" },
  { id: "inspection", num: 6, title: "المعاينة" },
  { id: "analysis", num: 7, title: "التحليل" },
  { id: "methodology", num: 8, title: "المنهجية" },
  { id: "assumptions", num: 9, title: "الافتراضات والقيود" },
  { id: "final-value", num: 10, title: "النتيجة النهائية" },
  { id: "disclosures", num: 11, title: "الإفصاحات" },
  { id: "accreditation", num: 12, title: "الاعتماد والتوقيع" },
];

/* ══════════════════════════════════════════════
   Watermark
   ══════════════════════════════════════════════ */
function WatermarkOverlay({ mode }: { mode: "draft" | "final" }) {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  if (mode === "final") return null; // No watermark on final version

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
      {/* Large diagonal DRAFT watermark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[72px] font-black tracking-[0.3em] -rotate-[35deg] select-none whitespace-nowrap"
          style={{ color: "hsl(var(--destructive) / 0.08)" }}
        >
          مسودة
        </span>
      </div>
      {/* Subtle user + date repeating pattern */}
      <div className="absolute inset-0 flex flex-col justify-around">
        {Array.from({ length: 4 }).map((_, row) => (
          <div key={row} className="flex justify-around -rotate-[25deg] origin-center">
            {Array.from({ length: 2 }).map((_, col) => (
              <span key={col} className="text-[9px] whitespace-nowrap select-none" style={{ color: "hsl(var(--muted-foreground) / 0.06)" }}>
                {`مسودة — ${SAMPLE.recipient.name} — ${now}`}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidentialWatermark() {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const text = `CONFIDENTIAL — ${SAMPLE.recipient.name} — ${now}`;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
      <div className="absolute inset-0 flex flex-col justify-around">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="flex justify-around -rotate-[25deg] origin-center">
            {Array.from({ length: 2 }).map((_, col) => (
              <span key={col} className="text-[11px] whitespace-nowrap select-none" style={{ color: "hsl(var(--muted-foreground) / 0.08)" }}>
                {text}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Shared Components
   ══════════════════════════════════════════════ */

function PageHeader({ versionNum, mode }: { versionNum: number; mode: "draft" | "final" }) {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/40">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground font-medium">{SAMPLE.reportNumber}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{
          background: mode === "draft" ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--primary) / 0.1)",
          color: mode === "draft" ? "hsl(var(--destructive))" : "hsl(var(--primary))",
        }}>
          {mode === "draft" ? `مسودة v${versionNum}` : `نهائي v${versionNum}`}
        </span>
      </div>
      <img src={jasasLogo} alt="جساس للتقييم" className="h-8 w-auto object-contain" />
    </div>
  );
}

function PageFooter({ pageNum }: { pageNum: number }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 mt-4 border-t border-border/40">
      <span>{COMPANY_IDENTITY.companyName} | {COMPANY_IDENTITY.crNumber}</span>
      <span>Page {pageNum} / {TOTAL_PAGES}</span>
    </div>
  );
}

function PageShell({ children, pageNum, noHeader, mode = "draft", versionNum = 1 }: {
  children: React.ReactNode; pageNum: number; noHeader?: boolean; mode?: "draft" | "final"; versionNum?: number;
}) {
  return (
    <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden relative" style={{ aspectRatio: "210/297" }}>
      {mode === "draft" ? <WatermarkOverlay mode="draft" /> : <ConfidentialWatermark />}
      <div className="h-full flex flex-col justify-between p-10 relative z-20">
        {!noHeader && <PageHeader versionNum={versionNum} mode={mode} />}
        <div className="flex-1 overflow-hidden">{children}</div>
        <PageFooter pageNum={pageNum} />
      </div>
    </div>
  );
}

function SectionTitle({ id, num, title }: { id: string; num: number; title: string }) {
  return (
    <div id={id} className="scroll-mt-8">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-bold text-primary">{num}.</span>
        <h2 className="text-base font-bold text-foreground">{title}</h2>
      </div>
      <Separator />
    </div>
  );
}

/** Executive bullet — concise single-line point */
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 text-sm text-muted-foreground">
      <span className="text-primary/60 shrink-0 mt-0.5">-</span>
      <span className="leading-relaxed">{children}</span>
    </div>
  );
}

/** Key-value metric row */
function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

/** Prominent value box */
function ValueBox({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="bg-primary/5 border-2 border-primary/15 rounded-lg px-6 py-5 text-center space-y-1.5">
      <p className="text-[11px] text-muted-foreground font-medium tracking-wide uppercase">{label}</p>
      <p className="text-3xl font-bold text-primary tracking-tight">{value} <span className="text-lg">SAR</span></p>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
    </div>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 text-sm text-muted-foreground">
          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
          <span className="leading-relaxed">{item}</span>
        </div>
      ))}
    </div>
  );
}

function VerificationQR({ size = 64 }: { size?: number }) {
  const url = `${VERIFY_BASE}/${SAMPLE.reportId}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <QRCodeSVG value={url} size={size} level="M" />
      <p className="text-[8px] text-muted-foreground text-center leading-tight max-w-[120px]" dir="ltr">{url}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-foreground font-medium">{value}</span>
      <span>{label}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════
   Pages — Executive Style
   ══════════════════════════════════════════════ */

function CoverPage({ mode, versionNum }: { mode: "draft" | "final"; versionNum: number }) {
  return (
    <PageShell pageNum={1} noHeader mode={mode} versionNum={versionNum}>
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-center justify-end">
          <img src={jasasLogo} alt="جساس للتقييم" className="h-16 w-auto object-contain" />
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">تقرير تقييم</h1>
            <h2 className="text-xl font-semibold text-primary">الآلات والمعدات</h2>
          </div>
          <Separator className="w-24 mx-auto" />
          <div className="space-y-3 text-sm text-muted-foreground">
            <Row label="رقم التقرير" value={SAMPLE.reportNumber} />
            <Row label="تاريخ التقييم" value={SAMPLE.valuationDate} />
            <Row label="تاريخ الإصدار" value={SAMPLE.issueDate} />
            <Row label="رقم الإصدار" value={`v${versionNum}`} />
          </div>
          <div className="mt-2"><VerificationQR size={56} /></div>
        </div>
        <div className="space-y-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="inline-block border border-border rounded px-4 py-1.5">
              <span className="text-xs text-muted-foreground">نسخة: </span>
              <span className="text-xs font-semibold text-foreground">عميل</span>
            </div>
            <div className="inline-block rounded px-3 py-1.5" style={{
              background: mode === "draft" ? "hsl(var(--destructive) / 0.1)" : "hsl(var(--primary) / 0.1)",
              color: mode === "draft" ? "hsl(var(--destructive))" : "hsl(var(--primary))",
            }}>
              <span className="text-xs font-bold">{mode === "draft" ? "مسودة" : "نهائي"}</span>
            </div>
          </div>
          <p className="text-[11px] text-destructive/80 font-medium">سري — للاستخدام الحصري للمستلم</p>
          {mode === "draft" && (
            <p className="text-[10px] text-muted-foreground/60">هذه المسودة لا تعتبر تقريراً رسمياً ولا تحمل أي صفة قانونية</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}

function TOCPage({ onNavigate }: { onNavigate: (id: string) => void }) {
  return (
    <PageShell pageNum={2}>
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">فهرس المحتويات</h2>
          <Separator />
        </div>
        <div className="space-y-0">
          {TOC.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center justify-between py-2.5 border-b border-dashed border-border/50 last:border-0 text-sm hover:bg-muted/30 transition-colors rounded px-2 -mx-2 group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-primary font-bold w-5 text-center">{item.num}</span>
                <span className="text-foreground group-hover:text-primary transition-colors">{item.title}</span>
              </div>
              <span className="text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity">انتقال</span>
            </button>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/* ── Executive Summary — Half page max, numbers-first ── */
function ExecSummaryPage() {
  return (
    <PageShell pageNum={3}>
      <div className="space-y-4">
        <SectionTitle id="exec-summary" num={1} title="الملخص التنفيذي" />

        <ValueBox
          label="القيمة السوقية العادلة"
          value={SAMPLE.estimatedValue}
          subtext={SAMPLE.estimatedValueText}
        />

        <div className="space-y-1 mt-2">
          <MetricRow label="عدد الأصول" value={`${SAMPLE.assets.reduce((s, a) => s + a.qty, 0)} وحدة`} />
          <MetricRow label="عدد الفئات" value={`${SAMPLE.assets.length} فئات`} />
          <MetricRow label="المنهج الرئيسي" value="أسلوب التكلفة" />
          <MetricRow label="المنهج المساند" value="أسلوب السوق" />
          <MetricRow label="تاريخ المعاينة" value="2026-03-25" />
          <MetricRow label="المعيار" value="IVS 2025" />
        </div>

        <div className="space-y-1 pt-2">
          <p className="text-xs font-semibold text-foreground">الافتراضات الجوهرية:</p>
          {SAMPLE.assumptions.map((a, i) => <Bullet key={i}>{a}</Bullet>)}
        </div>
      </div>
    </PageShell>
  );
}

/* ── Scope + Asset Definition — Bullets only ── */
function ScopePage() {
  return (
    <PageShell pageNum={4}>
      <div className="space-y-5">
        <SectionTitle id="scope" num={2} title="نطاق العمل" />
        <div className="space-y-1">
          <Bullet>جميع الآلات والمعدات الثابتة والمتحركة في موقع العميل</Bullet>
          <Bullet>خطوط الإنتاج والمعدات المساندة</Bullet>
          <Bullet>معاينة ميدانية شاملة بتاريخ 2026-03-25</Bullet>
          <Bullet>تحديد القيمة السوقية العادلة وفقاً لـ IVS 2025</Bullet>
        </div>

        <SectionTitle id="asset-def" num={3} title="تعريف الأصل" />
        <div className="space-y-1">
          <Bullet>الموقع: المنطقة الصناعية الثانية — الرياض</Bullet>
          <Bullet>المالك: العميل المحدد في نطاق العمل</Bullet>
          <Bullet>التصنيف: 5 فئات حسب طبيعة الاستخدام والعمر الإنتاجي</Bullet>
          <Bullet>الشمول: جميع المعدات الصناعية المملوكة في المصنع الرئيسي</Bullet>
          <Bullet>الاستثناء: الأصول غير الملموسة والمخزون</Bullet>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Documents ── */
function DocumentsPage() {
  return (
    <PageShell pageNum={5}>
      <div className="space-y-5">
        <SectionTitle id="documents" num={4} title="المستندات" />
        <p className="text-xs text-muted-foreground">المستندات المعتمدة في التقييم:</p>
        <NumberedList items={SAMPLE.documents} />
      </div>
    </PageShell>
  );
}

/* ── Attachment Intelligence — 2 pages ── */
function AttachmentIntelPage1() {
  const ai = SAMPLE.attachmentIntelligence;
  const statusColor = (s: string) =>
    s === "good" ? "text-emerald-600" : s === "warning" ? "text-amber-600" : "text-foreground";

  return (
    <PageShell pageNum={6}>
      <div className="space-y-4">
        <SectionTitle id="attachment-intel" num={5} title="تحليل المرفقات" />

        <p className="text-xs font-semibold text-foreground">المؤشرات المالية المستخلصة:</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-2 font-semibold text-foreground">المؤشر</th>
              <th className="text-center py-2 font-semibold text-foreground w-32">القيمة</th>
              <th className="text-right py-2 font-semibold text-foreground">المصدر</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {ai.financialMetrics.map((m, i) => (
              <tr key={i} className="border-b border-border/50">
                <td className="py-1.5">{m.label}</td>
                <td className="py-1.5 text-center font-medium text-foreground">{m.value}</td>
                <td className="py-1.5 text-xs">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-xs font-semibold text-foreground pt-2">المؤشرات التشغيلية:</p>
        <div className="space-y-1">
          {ai.keyIndicators.map((ind, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
              <span className="text-sm text-muted-foreground">{ind.indicator}</span>
              <span className={`text-sm font-semibold ${statusColor(ind.status)}`}>{ind.value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-foreground pt-2">المخاطر المحددة:</p>
        <div className="space-y-1">
          {ai.risks.map((r, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-destructive shrink-0 mt-0.5">⚠</span>
              <span className="leading-relaxed">{r}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

function AttachmentIntelPage2() {
  const ai = SAMPLE.attachmentIntelligence;
  return (
    <PageShell pageNum={7}>
      <div className="space-y-5">
        <div>
          <p className="text-xs font-semibold text-foreground mb-1">المرفقات المُستخدمة في التقييم:</p>
          <div className="space-y-1">
            {ai.used.map((u, i) => (
              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-emerald-600 shrink-0">✓</span>
                <span className="leading-relaxed">{u}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-1">المرفقات المُتجاهلة:</p>
          <div className="space-y-1">
            {ai.ignored.map((ig, i) => (
              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-muted-foreground/50 shrink-0">—</span>
                <span className="leading-relaxed">{ig}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-foreground mb-1">المرفقات المفقودة:</p>
          <div className="space-y-1">
            {ai.missing.map((m, i) => (
              <div key={i} className="flex gap-2 text-sm text-muted-foreground">
                <span className="text-destructive shrink-0">✗</span>
                <span className="leading-relaxed">{m}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 mt-2">
          <p className="text-xs font-semibold text-foreground mb-1">الأثر على النتيجة النهائية:</p>
          <p className="text-sm text-muted-foreground leading-relaxed">{ai.valueImpact}</p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Inspection — Grid + brief notes ── */
function InspectionPage() {
  return (
    <PageShell pageNum={8}>
      <div className="space-y-4">
        <SectionTitle id="inspection" num={6} title="المعاينة" />

        <div className="space-y-1">
          <MetricRow label="تاريخ المعاينة" value="2026-03-25" />
          <MetricRow label="الحضور" value="ممثل العميل + المقيّم" />
          <MetricRow label="حالة الأصول" value="جيدة — صيانة دورية منتظمة" />
          <MetricRow label="التحقق" value="جميع الأصول المدرجة موجودة ومتطابقة" />
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          {SAMPLE.inspectionPhotos.map((photo, i) => (
            <div key={i} className="space-y-1">
              <div className="aspect-[4/3] bg-muted/40 border border-border/50 rounded flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground/50">صورة {i + 1}</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug text-center">{photo.caption}</p>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/* ── Analysis + Methodology ── */
function AnalysisPage() {
  return (
    <PageShell pageNum={9}>
      <div className="space-y-5">
        <SectionTitle id="analysis" num={7} title="التحليل" />

        <div className="space-y-1">
          <MetricRow label="متوسط العمر الإنتاجي المتبقي" value="12 عاماً" />
          <MetricRow label="معدل الإهلاك المرجّح" value="35%" />
          <MetricRow label="أساس التكلفة" value="تكلفة الاستبدال الحالية" />
          <MetricRow label="مصادر السوق" value="سوق محلي + دولي" />
        </div>

        <SectionTitle id="methodology" num={8} title="المنهجية" />

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-2 font-semibold text-foreground">الأسلوب</th>
              <th className="text-center py-2 font-semibold text-foreground">الحالة</th>
              <th className="text-right py-2 font-semibold text-foreground">المبرر</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب التكلفة</td>
              <td className="py-2 text-center text-primary font-medium">رئيسي</td>
              <td className="py-2 text-sm">RCN مع خصم الإهلاك التراكمي</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب السوق</td>
              <td className="py-2 text-center">مساند</td>
              <td className="py-2 text-sm">مقارنة أسعار معدات مماثلة</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب الدخل</td>
              <td className="py-2 text-center text-muted-foreground/60">غير مطبق</td>
              <td className="py-2 text-sm">عدم توفر تدفقات نقدية منفصلة</td>
            </tr>
          </tbody>
        </table>

        <div className="bg-muted/30 border border-border/40 rounded p-3">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">التبرير:</span>{" "}
            أسلوب التكلفة هو الأنسب للآلات والمعدات الصناعية المتخصصة. تم الاستئناس بأسلوب السوق للتحقق من معقولية النتائج.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Assumptions ── */
function AssumptionsPage() {
  return (
    <PageShell pageNum={10}>
      <div className="space-y-5">
        <SectionTitle id="assumptions" num={9} title="الافتراضات والقيود" />

        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground mb-1">الافتراضات:</p>
          {SAMPLE.assumptions.map((a, i) => <Bullet key={i}>{a}</Bullet>)}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-foreground mb-1">القيود:</p>
          {SAMPLE.limitations.map((l, i) => <Bullet key={i}>{l}</Bullet>)}
        </div>
      </div>
    </PageShell>
  );
}

/* ── Asset Table + Final Value ── */
function AssetTablePage() {
  const total = SAMPLE.assets
    .reduce((sum, a) => sum + Number(a.value.replace(/,/g, "")), 0)
    .toLocaleString("en-US");

  return (
    <PageShell pageNum={11}>
      <div className="space-y-5">
        <SectionTitle id="final-value" num={10} title="النتيجة النهائية" />

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
                <td className="py-2 text-muted-foreground">{asset.type}</td>
                <td className="py-2 text-center text-muted-foreground">{asset.qty}</td>
                <td className="py-2 text-left text-muted-foreground" dir="ltr">{asset.value}</td>
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

        <ValueBox
          label="القيمة السوقية العادلة"
          value={SAMPLE.estimatedValue}
          subtext={SAMPLE.estimatedValueText}
        />
      </div>
    </PageShell>
  );
}

/* ── Disclosures + QR ── */
function DisclosuresPage() {
  return (
    <PageShell pageNum={12}>
      <div className="space-y-5">
        <SectionTitle id="disclosures" num={11} title="الإفصاحات" />
        <NumberedList items={SAMPLE.disclosures} />

        <div className="border border-border rounded px-4 py-3 mt-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            تمثل هذه القيمة رأي المقيّم المعتمد بناءً على المعلومات المتاحة وقت التقييم، وفقاً لـ IVS 2025 ومتطلبات تقييم.
          </p>
        </div>

        <div className="flex items-end justify-between mt-6 pt-4 border-t border-border/40">
          <VerificationQR size={72} />
          <div className="text-left space-y-1" dir="ltr">
            <p className="text-[9px] text-muted-foreground">Print: Disabled</p>
            <p className="text-[9px] text-muted-foreground">Edit: Disabled</p>
            <p className="text-[9px] text-muted-foreground">Copy: Disabled</p>
            <p className="text-[9px] text-muted-foreground">Link expires: 10 min</p>
            <p className="text-[9px] text-muted-foreground">Download: Single-use</p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* ══════════════════════════════════════════════
   Main Export
   ══════════════════════════════════════════════ */
export default function JasasReportPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"draft" | "final">("draft");
  const [versionNum] = useState(3); // Sample: version 3
  const [isLocked] = useState(false);

  const versions = [
    { num: 1, date: "2026-03-28", mode: "draft" as const, locked: true },
    { num: 2, date: "2026-04-05", mode: "draft" as const, locked: true },
    { num: 3, date: "2026-04-10", mode: mode, locked: isLocked },
  ];

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6" dir="rtl">
      {/* ── Version Control Toolbar ── */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">التحكم في نسخ التقرير</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("draft")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === "draft"
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              مسودة
            </button>
            <button
              onClick={() => setMode("final")}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                mode === "final"
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              نهائي
            </button>
          </div>
        </div>

        {/* Version history */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {versions.map((v) => (
            <div
              key={v.num}
              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs shrink-0 ${
                v.num === versionNum
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/50 bg-muted/20"
              }`}
            >
              {v.locked && <Lock className="h-3 w-3 text-muted-foreground/60" />}
              <span className="font-medium text-foreground">v{v.num}</span>
              <span className="text-muted-foreground">{v.date}</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                v.mode === "final"
                  ? "bg-primary/10 text-primary"
                  : "bg-destructive/10 text-destructive"
              }`}>
                {v.mode === "final" ? "نهائي" : "مسودة"}
              </span>
            </div>
          ))}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>آخر تعديل: {SAMPLE.issueDate}</span>
          </div>
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            <span>{mode === "final" ? "مقفل — لا يمكن التعديل" : "قابل للتعديل"}</span>
          </div>
          {mode === "final" && (
            <div className="flex items-center gap-1 text-primary">
              <Lock className="h-3 w-3" />
              <span className="font-medium">محمي من التعديل</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Report Pages ── */}
      <div ref={containerRef} className="space-y-8">
        <CoverPage mode={mode} versionNum={versionNum} />
        <TOCPage onNavigate={scrollToSection} />
        <ExecSummaryPage />
        <ScopePage />
        <DocumentsPage />
        <AttachmentIntelPage1 />
        <AttachmentIntelPage2 />
        <InspectionPage />
        <AnalysisPage />
        <AssumptionsPage />
        <AssetTablePage />
        <DisclosuresPage />
      </div>
    </div>
  );
}
