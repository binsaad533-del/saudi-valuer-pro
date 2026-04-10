import { Report } from "@/types/report";
import BidiText from "@/components/ui/bidi-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusLabel, getStatusColor } from "@/utils/reportWorkflow";
import { QRCodeSVG } from "qrcode.react";
import { Separator } from "@/components/ui/separator";
import jsaasLogo from "@/assets/jsaas-logo.png";
import OfficialStamp from "./OfficialStamp";
import { formatDate, formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";
import { AlertTriangle } from "lucide-react";
import ReportQualitySection from "./ReportQualitySection";


interface ReportPreviewProfessionalProps {
  report: Report;
  valuationMode?: "field" | "desktop";
}

export default function ReportPreviewProfessional({ report, valuationMode = "field" }: ReportPreviewProfessionalProps) {
  const isDraft = report.status === "draft" || report.status === "review";
  const isDesktop = valuationMode === "desktop";

  return (
    <div className="relative bg-white text-black print:shadow-none" dir="rtl">
      {isDraft && (
        <>
          {/* Watermark overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-10">
            <span className="text-[120px] font-bold text-destructive rotate-[-30deg] select-none">مسودة</span>
          </div>
          {/* Mandatory draft disclaimer banner (IVS 106 / معيار 30) */}
          <div className="relative z-20 bg-amber-50 border-b-2 border-amber-400 px-8 py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-900 space-y-1">
                <p className="font-bold">مسودة مبدئية للاستخدام الداخلي فقط — DRAFT FOR INTERNAL USE ONLY</p>
                <p className="text-xs">هذا الرأي مؤقت، مخصص لأغراض المراجعة الداخلية للعميل، ولا يجوز نشره أو الاعتماد عليه قانونياً.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <div className="border-b-4 border-primary p-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={jsaasLogo} alt="جساس للتقييم" className="w-16 h-16 object-contain bg-white rounded-md p-1" />
          <div>
            <h1 className="text-2xl font-bold text-primary">تقرير تقييم</h1>
            <p className="text-sm text-muted-foreground mt-1">Valuation Report</p>
          </div>
        </div>
        <div className="text-left space-y-1">
          <p className="text-sm font-semibold">{report.reportNumber}</p>
          <p className="text-xs text-muted-foreground">{formatDate(report.createdAt)}</p>
          <Badge className={getStatusColor(report.status)}>{getStatusLabel(report.status)}</Badge>
        </div>
      </div>

      {/* Client Info */}
      <Card className="m-6 border">
        <CardContent className="p-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">العميل:</span>
            <p className="font-semibold">{report.clientName}</p>
          </div>
          <div>
            <span className="text-muted-foreground">نوع الأصل:</span>
            <p className="font-semibold">
              {report.assetType === "real_estate" ? "عقار" : report.assetType === "equipment" ? "معدات" : "مركبة"}
            </p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">وصف الأصل:</span>
            <p>{report.assetDescription}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">الموقع:</span>
            <p>{report.assetLocation}</p>
          </div>
        </CardContent>
      </Card>

      {/* Methodology & Market */}
      <div className="mx-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold border-b pb-2 mb-2">منهجية التقييم</h2>
          <p className="text-sm">
            {report.methodology === "market_comparison" && "أسلوب المقارنة بالسوق"}
            {report.methodology === "income" && "أسلوب الدخل"}
            {report.methodology === "cost" && "أسلوب التكلفة"}
            {report.methodology === "combined" && "أسلوب مشترك (مقارنة + دخل)"}
          </p>
        </div>
        <div>
          <h2 className="text-lg font-bold border-b pb-2 mb-2">تحليل السوق</h2>
          <BidiText className="text-sm">{report.marketAnalysis}</BidiText>
        </div>
      </div>

      {/* Comparables */}
      <div className="mx-6 mt-6">
        <h2 className="text-lg font-bold border-b pb-2 mb-3">المقارنات السوقية</h2>
        <table className="w-full text-sm border">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-right border">#</th>
              <th className="p-2 text-right border">الوصف</th>
              <th className="p-2 text-right border">القيمة (<SAR size={10} />)</th>
              <th className="p-2 text-right border">المصدر</th>
              <th className="p-2 text-right border">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {report.comparables.map((c, i) => (
              <tr key={i} className="border-b">
                <td className="p-2 border">{i + 1}</td>
                <td className="p-2 border">{c.description}</td>
                <td className="p-2 border">{formatNumber(c.value)}</td>
                <td className="p-2 border">{c.source}</td>
                <td className="p-2 border">{formatDate(c.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Final Value */}
      <div className="mx-6 mt-6 p-6 bg-primary/5 border-2 border-primary rounded-lg text-center">
        <p className="text-sm text-muted-foreground mb-1">القيمة التقديرية النهائية</p>
        <p className="text-3xl font-bold text-primary">
          {formatNumber(report.estimatedValue)} <SAR />
        </p>
      </div>

      {report.notes && (
        <div className="mx-6 mt-4">
          <h2 className="text-lg font-bold border-b pb-2 mb-2">ملاحظات</h2>
          <p className="text-sm">{report.notes}</p>
        </div>
      )}

      {/* Desktop Valuation Disclosure */}
      {isDesktop && (
        <div className="mx-6 mt-6 p-4 border-2 border-amber-400 bg-amber-50 rounded-lg">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <h2 className="text-lg font-bold text-amber-800">بيان الإفصاح — تقييم مكتبي</h2>
          </div>
          <div className="text-sm text-amber-900 space-y-2">
            <p className="font-medium">Desktop Valuation Disclosure</p>
            <p>لم يتم إجراء أي معاينة مادية أو شخصية للأصل المُقيَّم. تم إعداد هذا التقييم بالاعتماد على المستندات والبيانات المتاحة والأدلة البديلة المجمعة دون زيارة ميدانية.</p>
            <p className="font-medium mt-3">القيود الناتجة عن غياب المعاينة:</p>
            <ul className="list-disc list-inside space-y-1 text-amber-800">
              <li>لم يتم التحقق البصري من الحالة الفعلية للأصل أو مطابقته للمخططات</li>
              <li>قد تكون هناك عوامل مؤثرة على القيمة لم تُكتشف في غياب المعاينة الميدانية</li>
              <li>يعتمد التقييم على دقة وصحة المعلومات المقدمة من العميل والمصادر المتاحة</li>
            </ul>
            <p className="mt-3 text-xs text-amber-700">
              هذا التقييم متوافق مع معايير التقييم الدولية (IVS 2025) — المادتان 20.4 و108.3، ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم) — البندان 154 و161.
            </p>
          </div>
        </div>
      )}

      <Separator className="mx-6 my-6" />

      {/* Signature Block */}
      <div className="mx-6 mb-8 space-y-4">
        {/* Evaluator info */}
        <div className="space-y-1">
          <p className="font-bold text-lg">{report.evaluatorName}</p>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>{report.evaluatorCredentials.saudiAuthority}</p>
            <p>{report.evaluatorCredentials.rics}</p>
            <p>{report.evaluatorCredentials.asa}</p>
          </div>
          <p className="text-xs mt-2">
            التاريخ: {formatDate(report.issuedAt || report.createdAt)}
          </p>
        </div>

        {/* Signature + Stamp + QR row */}
        <div className="flex items-center justify-between">
          {isDraft ? (
            <div className="w-[300px] h-[80px] border-2 border-dashed border-muted-foreground/30 rounded-lg flex items-center justify-center">
              <span className="text-sm text-muted-foreground">في انتظار التوقيع والاعتماد</span>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <img src="/signature.png" alt="التوقيع" className="w-[140px] h-[70px] object-contain" />
              <div style={{ opacity: 0.85 }}>
                <OfficialStamp />
              </div>
            </div>
          )}

          {report.verificationToken && (
            <div className="flex flex-col items-center gap-1">
              <QRCodeSVG
                value={`${window.location.origin}/verify/${report.verificationToken}`}
                size={100}
                level="H"
              />
              <span className="text-[10px] text-muted-foreground">رمز التحقق</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
