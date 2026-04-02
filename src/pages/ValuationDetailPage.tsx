import { useParams, Link } from "react-router-dom";
import { SAR, SARIcon } from "@/components/ui/saudi-riyal";
import { formatNumber } from "@/lib/utils";
import {
  ArrowRight, MapPin, User, Building2, DollarSign,
  Clock, AlertTriangle, Camera, StickyNote,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const MOCK = {
  id: "VA-2026-0042",
  status: "inspection_done" as const,
  statusLabel: "تمت المعاينة",
  createdAt: "2026-03-15",
  dueDate: "2026-04-05",
  client: {
    name: "شركة الرياض للتطوير العقاري",
    type: "شركة",
    phone: "0112345678",
    email: "info@riyadhdev.sa",
    idNumber: "1010XXXXXX",
  },
  property: {
    type: "فيلا سكنية",
    category: "سكني",
    address: "حي النرجس، شارع الأمير محمد بن سلمان",
    city: "الرياض",
    district: "النرجس",
    landArea: 625,
    buildingArea: 480,
    floors: 2,
    yearBuilt: 2021,
    lat: 24.8103,
    lng: 46.6346,
  },
  valuation: {
    purpose: "تمويل بنكي",
    basis: "القيمة السوقية",
    approach: "المقارنة السوقية + التكلفة",
    estimatedValue: 2_850_000,
    currency: "ريال",
    pricePerSqm: 4_560,
  },
  timeline: [
    { date: "2026-03-15", event: "استلام الطلب", done: true },
    { date: "2026-03-16", event: "تعيين المقيّم", done: true },
    { date: "2026-03-18", event: "جدولة المعاينة", done: true },
    { date: "2026-03-20", event: "تنفيذ المعاينة", done: true },
    { date: "2026-03-22", event: "تحليل البيانات", done: false },
    { date: "2026-03-25", event: "إعداد التقرير", done: false },
    { date: "2026-04-01", event: "المراجعة والاعتماد", done: false },
    { date: "2026-04-05", event: "التسليم", done: false },
  ],
  inspection: {
    inspector: "محمد العتيبي",
    date: "2026-03-20",
    duration: "45 دقيقة",
    gpsVerified: true,
    photosCount: 24,
    condition: "جيدة",
    conditionScore: 78,
    notes:
      "العقار بحالة جيدة عموماً. يوجد تشقق بسيط في الجدار الخارجي الشمالي. التشطيبات داخلية ممتازة. الحديقة الخلفية تحتاج صيانة بسيطة. المسبح يعمل بكفاءة.",
    risks: ["تشقق في الجدار الخارجي", "قرب من خطوط الضغط العالي"],
  },
  valuer: "أحمد بن سعد المالكي",
  reviewer: "د. عبدالرحمن الشهري",
};

const STATUS_COLOR: Record<string, string> = {
  inspection_done: "bg-blue-500/10 text-blue-600 border-blue-200",
  draft: "bg-muted text-muted-foreground",
  approved: "bg-green-500/10 text-green-600 border-green-200",
};

export default function ValuationDetailPage() {
  const { id } = useParams();
  const d = MOCK;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/valuations">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{d.id}</h1>
              <Badge className={STATUS_COLOR[d.status]}>{d.statusLabel}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              تاريخ الطلب: {d.createdAt} · الاستحقاق: {d.dueDate}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Right column – main info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Client */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> بيانات العميل
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Info label="الاسم" value={d.client.name} />
              <Info label="النوع" value={d.client.type} />
              <Info label="الهاتف" value={d.client.phone} />
              <Info label="البريد" value={d.client.email} />
              <Info label="رقم الهوية / السجل" value={d.client.idNumber} />
            </CardContent>
          </Card>

          {/* Property */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" /> بيانات العقار
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <Info label="نوع العقار" value={d.property.type} />
              <Info label="التصنيف" value={d.property.category} />
              <Info label="المدينة" value={d.property.city} />
              <Info label="الحي" value={d.property.district} />
              <Info label="العنوان" value={d.property.address} full />
              <Info label="مساحة الأرض" value={`${formatNumber(d.property.landArea)} م²`} />
              <Info label="مساحة البناء" value={`${formatNumber(d.property.buildingArea)} م²`} />
              <Info label="عدد الأدوار" value={String(d.property.floors)} />
              <Info label="سنة البناء" value={String(d.property.yearBuilt)} />
              <div className="col-span-2 flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="font-mono text-xs">{d.property.lat}, {d.property.lng}</span>
              </div>
            </CardContent>
          </Card>

          {/* Valuation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <SARIcon className="w-4 h-4 text-primary" /> بيانات التقييم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Info label="الغرض" value={d.valuation.purpose} />
                <Info label="أساس القيمة" value={d.valuation.basis} />
                <Info label="المنهجية" value={d.valuation.approach} full />
              </div>
              <Separator />
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">القيمة التقديرية</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatNumber(d.valuation.estimatedValue)} <span className="text-sm font-normal">{d.valuation.currency}</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">سعر المتر</p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatNumber(d.valuation.pricePerSqm)} <span className="text-sm font-normal">{d.valuation.currency}/م²</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Inspection notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-primary" /> ملاحظات المعاين
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Info label="المعاين" value={d.inspection.inspector} />
                <Info label="تاريخ المعاينة" value={d.inspection.date} />
                <Info label="المدة" value={d.inspection.duration} />
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-muted-foreground" />
                  <span>{d.inspection.photosCount} صورة</span>
                  {d.inspection.gpsVerified && (
                    <Badge variant="outline" className="text-xs mr-2">GPS ✓</Badge>
                  )}
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-1">حالة العقار</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{d.inspection.condition}</Badge>
                  <span className="text-xs text-muted-foreground">({d.inspection.conditionScore}/100)</span>
                </div>
              </div>
              <p className="leading-relaxed text-foreground/90">{d.inspection.notes}</p>
              {d.inspection.risks.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> مخاطر مُسجّلة
                  </p>
                  <ul className="space-y-1">
                    {d.inspection.risks.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Left column – timeline & team */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> الجدول الزمني
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative border-r-2 border-border pr-6 space-y-5">
                {d.timeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -right-[31px] top-0.5 w-4 h-4 rounded-full border-2 ${
                        t.done
                          ? "bg-primary border-primary"
                          : "bg-card border-border"
                      }`}
                    />
                    <p className={`text-sm font-medium ${t.done ? "text-foreground" : "text-muted-foreground"}`}>
                      {t.event}
                    </p>
                    <p className="text-xs text-muted-foreground">{t.date}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> فريق العمل
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Info label="المقيّم" value={d.valuer} />
              <Info label="المراجع" value={d.reviewer} />
              <Info label="المعاين" value={d.inspection.inspector} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium text-foreground">{value}</p>
    </div>
  );
}
