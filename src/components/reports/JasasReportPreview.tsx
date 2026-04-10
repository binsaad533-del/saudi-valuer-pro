import { useRef, useCallback, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { QRCodeSVG } from "qrcode.react";
import logo from "@/assets/logo.png";

/* ══════════════════════════════════════════════
   Sample Data
   ══════════════════════════════════════════════ */
const SAMPLE = {
  reportNumber: "JV-2026-0412",
  reportId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  valuationDate: "2026-04-01",
  issueDate: "2026-04-10",
  recipient: { name: "محمد العبدالله", email: "m.abdullah@company.sa" },
  objective:
    "تحديد القيمة السوقية العادلة للآلات والمعدات المملوكة للعميل وفقاً لمعايير التقييم الدولية IVS 2025 ومتطلبات الهيئة السعودية للمقيمين المعتمدين.",
  scope:
    "يشمل نطاق العمل جميع الآلات والمعدات الثابتة والمتحركة الموجودة في موقع العميل، بما في ذلك خطوط الإنتاج والمعدات المساندة. تم إجراء معاينة ميدانية شاملة للموقع بتاريخ 2026-03-25.",
  assetDefinition:
    "تشمل الأصول المقيّمة جميع الآلات والمعدات الصناعية المملوكة للعميل والمتواجدة في المصنع الرئيسي بالمنطقة الصناعية الثانية بالرياض. تم تصنيف الأصول إلى خمس فئات رئيسية حسب طبيعة الاستخدام والعمر الإنتاجي.",
  documents: [
    "صك ملكية المصنع — صادر بتاريخ 2020-06-15",
    "فواتير شراء المعدات الأصلية",
    "عقود الصيانة السارية",
    "تقارير الفحص الفني السابقة",
    "شهادات المطابقة والجودة",
  ],
  inspectionNotes:
    "تمت المعاينة الميدانية بتاريخ 2026-03-25 بحضور ممثل العميل. تم التحقق من وجود جميع الأصول المدرجة وفحص حالتها التشغيلية العامة. لوحظ أن المعدات في حالة جيدة مع صيانة دورية منتظمة.",
  inspectionPhotos: [
    { caption: "خط الإنتاج الرئيسي — المنظر العام" },
    { caption: "المولدات الكهربائية — الوحدة 1" },
    { caption: "الرافعات الصناعية — منطقة التخزين" },
    { caption: "أنظمة التبريد المركزية" },
    { caption: "لوحة التحكم الرئيسية" },
    { caption: "المعدات المساندة — ورشة الصيانة" },
  ],
  analysis:
    "تم تحليل الأصول بناءً على عمرها الإنتاجي المتبقي، حالتها الفعلية، ومعدلات الإهلاك المطبقة. أظهر التحليل أن متوسط العمر الإنتاجي المتبقي للأصول يبلغ 12 عاماً، مع معدل إهلاك مرجّح قدره 35%. تم الأخذ بعين الاعتبار تكاليف الاستبدال الحالية وأسعار السوق المحلي والدولي للمعدات المماثلة.",
  methodology:
    "تم اعتماد أسلوب التكلفة (Cost Approach) كمنهج رئيسي لتحديد تكلفة الاستبدال الجديدة مع خصم الإهلاك التراكمي. كما تم الاستئناس بأسلوب السوق (Market Approach) من خلال مقارنة أسعار معدات مماثلة في السوق للتحقق من معقولية النتائج. لم يتم تطبيق أسلوب الدخل لعدم توفر بيانات تدفقات نقدية منفصلة للأصول.",
  assumptions: [
    "جميع الآلات في حالة تشغيلية وقت المعاينة",
    "لا توجد التزامات مالية أو رهونات على الأصول المقيّمة",
    "المعلومات المقدمة من العميل دقيقة وكاملة",
  ],
  limitations: [
    "لم يتم إجراء فحص فني تفصيلي للأجزاء الداخلية للآلات",
    "التقييم لا يشمل الأصول غير الملموسة أو المخزون",
  ],
  disclosures: [
    "لا توجد علاقة مالية أو شخصية بين المقيّم والعميل تؤثر على استقلالية التقييم",
    "تم إعداد هذا التقرير وفقاً لمعايير التقييم الدولية IVS 2025 ومتطلبات الهيئة السعودية للمقيمين المعتمدين (تقييم)",
    "المقيّم يمتلك الخبرة والتأهيل الكافي لإجراء هذا النوع من التقييمات",
    "هذا التقرير معدّ حصرياً للجهة المستلمة ولا يجوز تداوله أو الاعتماد عليه من قبل أطراف أخرى دون موافقة خطية مسبقة",
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
};

const VERIFY_BASE = "https://jsaas-valuation.com/verify";
const TOTAL_PAGES = 10;

/* ══════════════════════════════════════════════
   TOC
   ══════════════════════════════════════════════ */
const TOC = [
  { id: "exec-summary", num: 1, title: "الملخص التنفيذي" },
  { id: "scope", num: 2, title: "نطاق العمل" },
  { id: "asset-def", num: 3, title: "تعريف الأصل" },
  { id: "documents", num: 4, title: "المستندات" },
  { id: "inspection", num: 5, title: "المعاينة" },
  { id: "analysis", num: 6, title: "التحليل" },
  { id: "methodology", num: 7, title: "المنهجية" },
  { id: "assumptions", num: 8, title: "الافتراضات والقيود" },
  { id: "final-value", num: 9, title: "النتيجة النهائية" },
  { id: "disclosures", num: 10, title: "الإفصاحات" },
];

/* ══════════════════════════════════════════════
   Watermark Overlay — rendered on every page
   ══════════════════════════════════════════════ */
function WatermarkOverlay() {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const text = `CONFIDENTIAL — ${SAMPLE.recipient.name} — ${now}`;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10" aria-hidden="true">
      {/* Diagonal repeating watermark */}
      <div className="absolute inset-0 flex flex-col justify-around">
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="flex justify-around -rotate-[25deg] origin-center">
            {Array.from({ length: 2 }).map((_, col) => (
              <span
                key={col}
                className="text-[11px] whitespace-nowrap select-none"
                style={{ color: "hsl(var(--muted-foreground) / 0.08)" }}
              >
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

function PageHeader() {
  return (
    <div className="flex items-center justify-between pb-3 mb-4 border-b border-border/40">
      <img src={logo} alt="جساس" className="w-7 h-7 object-contain" />
      <span className="text-[10px] text-muted-foreground font-medium">{SAMPLE.reportNumber}</span>
    </div>
  );
}

function PageFooter({ pageNum }: { pageNum: number }) {
  return (
    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-3 mt-4 border-t border-border/40">
      <span>شركة جساس للتقييم — Jassas Valuation Co.</span>
      <span>{pageNum} / {TOTAL_PAGES}</span>
    </div>
  );
}

function PageShell({ children, pageNum, noHeader }: { children: React.ReactNode; pageNum: number; noHeader?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-sm shadow-sm overflow-hidden relative" style={{ aspectRatio: "210/297" }}>
      <WatermarkOverlay />
      <div className="h-full flex flex-col justify-between p-10 relative z-20">
        {!noHeader && <PageHeader />}
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

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </div>
  );
}

function Paragraph({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground leading-[1.85]">{text}</p>;
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-muted-foreground flex gap-2">
          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function VerificationQR({ size = 64 }: { size?: number }) {
  const url = `${VERIFY_BASE}/${SAMPLE.reportId}`;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <QRCodeSVG value={url} size={size} level="M" />
      <p className="text-[8px] text-muted-foreground text-center leading-tight max-w-[120px]" dir="ltr">
        {url}
      </p>
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
   Pages
   ══════════════════════════════════════════════ */

/* ── Cover ── */
function CoverPage() {
  return (
    <PageShell pageNum={1} noHeader>
      <div className="flex flex-col h-full justify-between">
        <div className="flex items-start justify-between">
          <img src={logo} alt="جساس" className="w-14 h-14 object-contain" />
          <div className="text-left" dir="ltr">
            <p className="text-[10px] text-muted-foreground font-medium">Jassas Valuation Co.</p>
          </div>
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
          </div>
          {/* QR on cover */}
          <div className="mt-2">
            <VerificationQR size={56} />
          </div>
        </div>
        <div className="space-y-3 text-center">
          <div className="inline-block border border-border rounded px-4 py-1.5">
            <span className="text-xs text-muted-foreground">نسخة: </span>
            <span className="text-xs font-semibold text-foreground">عميل</span>
          </div>
          <p className="text-[11px] text-destructive/80 font-medium">سري — للاستخدام الحصري للمستلم</p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── TOC ── */
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
              <span className="text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                انتقال
              </span>
            </button>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/* ── Executive Summary ── */
function ExecSummaryPage() {
  return (
    <PageShell pageNum={3}>
      <div className="space-y-5">
        <SectionTitle id="exec-summary" num={1} title="الملخص التنفيذي" />
        <SubSection title="الهدف"><Paragraph text={SAMPLE.objective} /></SubSection>
        <SubSection title="النطاق"><Paragraph text={SAMPLE.scope} /></SubSection>
        <SubSection title="المنهج"><Paragraph text={SAMPLE.methodology} /></SubSection>
        <SubSection title="القيمة التقديرية">
          <div className="bg-primary/5 border border-primary/10 rounded px-4 py-3 text-center">
            <p className="text-2xl font-bold text-primary">{SAMPLE.estimatedValue} {SAMPLE.currency}</p>
          </div>
        </SubSection>
      </div>
    </PageShell>
  );
}

/* ── Scope ── */
function ScopePage() {
  return (
    <PageShell pageNum={4}>
      <div className="space-y-5">
        <SectionTitle id="scope" num={2} title="نطاق العمل" />
        <Paragraph text={SAMPLE.scope} />
        <SectionTitle id="asset-def" num={3} title="تعريف الأصل" />
        <Paragraph text={SAMPLE.assetDefinition} />
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
        <Paragraph text="تم الاعتماد على المستندات التالية المقدمة من العميل في إعداد هذا التقرير:" />
        <NumberedList items={SAMPLE.documents} />
      </div>
    </PageShell>
  );
}

/* ── Inspection ── */
function InspectionPage() {
  return (
    <PageShell pageNum={6}>
      <div className="space-y-5">
        <SectionTitle id="inspection" num={5} title="المعاينة" />
        <Paragraph text={SAMPLE.inspectionNotes} />
        <div className="grid grid-cols-3 gap-3 mt-4">
          {SAMPLE.inspectionPhotos.map((photo, i) => (
            <div key={i} className="space-y-1.5">
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
    <PageShell pageNum={7}>
      <div className="space-y-5">
        <SectionTitle id="analysis" num={6} title="التحليل" />
        <Paragraph text={SAMPLE.analysis} />
        <SectionTitle id="methodology" num={7} title="المنهجية" />
        <Paragraph text={SAMPLE.methodology} />
        <table className="w-full text-sm mt-2">
          <thead>
            <tr className="border-b border-border">
              <th className="text-right py-2 font-semibold text-foreground">الأسلوب</th>
              <th className="text-center py-2 font-semibold text-foreground">الحالة</th>
              <th className="text-right py-2 font-semibold text-foreground">الملاحظة</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب التكلفة</td>
              <td className="py-2 text-center text-primary font-medium">رئيسي</td>
              <td className="py-2">تكلفة الاستبدال مخصوماً منها الإهلاك</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب السوق</td>
              <td className="py-2 text-center">مساند</td>
              <td className="py-2">مقارنة أسعار معدات مماثلة</td>
            </tr>
            <tr className="border-b border-border/50">
              <td className="py-2">أسلوب الدخل</td>
              <td className="py-2 text-center text-muted-foreground/60">غير مطبق</td>
              <td className="py-2">عدم توفر بيانات تدفقات نقدية منفصلة</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}

/* ── Assumptions ── */
function AssumptionsPage() {
  return (
    <PageShell pageNum={8}>
      <div className="space-y-5">
        <SectionTitle id="assumptions" num={8} title="الافتراضات والقيود" />
        <SubSection title="الافتراضات"><NumberedList items={SAMPLE.assumptions} /></SubSection>
        <SubSection title="القيود"><NumberedList items={SAMPLE.limitations} /></SubSection>
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
    <PageShell pageNum={9}>
      <div className="space-y-5">
        <SectionTitle id="final-value" num={9} title="النتيجة النهائية" />
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
        <div className="bg-primary/5 border border-primary/10 rounded px-6 py-5 text-center space-y-2 mt-4">
          <p className="text-xs text-muted-foreground">القيمة السوقية العادلة</p>
          <p className="text-3xl font-bold text-primary tracking-tight">
            {SAMPLE.estimatedValue} <span className="text-lg">SAR</span>
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">{SAMPLE.estimatedValueText}</p>
        </div>
      </div>
    </PageShell>
  );
}

/* ── Disclosures + QR ── */
function DisclosuresPage() {
  return (
    <PageShell pageNum={10}>
      <div className="space-y-5">
        <SectionTitle id="disclosures" num={10} title="الإفصاحات" />
        <NumberedList items={SAMPLE.disclosures} />

        <div className="border border-border rounded px-5 py-4 mt-4 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            تمثل هذه القيمة رأي المقيّم المعتمد بناءً على المعلومات المتاحة وقت التقييم، وفقاً لمعايير التقييم الدولية IVS 2025 ومتطلبات الهيئة السعودية للمقيمين المعتمدين (تقييم).
          </p>
        </div>

        {/* Verification QR + Security badges */}
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

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div ref={containerRef} className="max-w-2xl mx-auto space-y-8 py-8" dir="rtl">
      <CoverPage />
      <TOCPage onNavigate={scrollToSection} />
      <ExecSummaryPage />
      <ScopePage />
      <DocumentsPage />
      <InspectionPage />
      <AnalysisPage />
      <AssumptionsPage />
      <AssetTablePage />
      <DisclosuresPage />
    </div>
  );
}
