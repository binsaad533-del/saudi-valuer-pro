/**
 * صفحة الاعتماد والتوقيع النهائية
 * تُضاف تلقائياً في نهاية كل تقرير — لا يمكن تعديلها أو حذفها
 */
import { QRCodeSVG } from "qrcode.react";
import { Separator } from "@/components/ui/separator";
import { JSAAS_IDENTITY } from "@/lib/company-identity";
import { format } from "date-fns";

interface Props {
  reportNumber?: string;
}

export default function ReportAccreditationSection({ reportNumber }: Props) {
  const id = JSAAS_IDENTITY;
  const today = format(new Date(), "yyyy/MM/dd");
  const qrValue = reportNumber
    ? `https://jsaas-valuation.com/verify/${reportNumber}`
    : id.qrLinks.license;

  return (
    <div className="space-y-6" dir="rtl">
      {/* ── Title ── */}
      <div className="border-b-2 border-primary pb-2">
        <h2 className="text-base font-bold text-foreground">الاعتماد والتوقيع</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Accreditation & Signature
        </p>
      </div>

      {/* ── Compliance Statement ── */}
      <div className="border border-border rounded-lg p-4">
        <p className="text-sm leading-7 text-foreground">
          نشهد بأن هذا التقرير أُعد وفقاً للمعايير الدولية للتقييم (IVS)
          وبما يتوافق مع أنظمة الهيئة السعودية للمقيمين المعتمدين (TAQEEM)،
          وأن جميع التحليلات والنتائج الواردة تم إعدادها بمهنية واستقلالية.
        </p>
      </div>

      {/* ── Valuer Info ── */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        {/* Name & Title */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">مقدم التقرير</p>
          <p className="text-sm font-bold text-foreground">{id.valuerName}</p>
          <p className="text-xs text-muted-foreground">{id.valuerTitle}</p>
        </div>

        <Separator />

        {/* License */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-0.5">رقم الترخيص</p>
          <p className="text-sm text-foreground">
            <span className="font-semibold" dir="ltr">{id.licenseNumber}</span>
            {" "}({id.licenseBranch})
          </p>
        </div>

        <Separator />

        {/* Memberships */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">العضويات</p>
          <div className="space-y-1.5">
            {id.memberships.map((m) => (
              <div key={m.number} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{m.label}</span>
                <span className="font-semibold text-foreground" dir="ltr">{m.number}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Company Data ── */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <p className="text-[10px] text-muted-foreground mb-0.5">بيانات الشركة</p>
        <p className="text-sm font-bold text-foreground">{id.companyName}</p>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">السجل التجاري</span>
            <p className="font-semibold text-foreground" dir="ltr">{id.crNumber}</p>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">الرقم الضريبي</span>
            <p className="font-semibold text-foreground" dir="ltr">{id.taxNumber}</p>
          </div>
        </div>

        <div>
          <span className="text-muted-foreground text-xs">العنوان</span>
          <p className="text-sm text-foreground">{id.address}</p>
        </div>
      </div>

      {/* ── Signature + Date + QR row ── */}
      <div className="grid grid-cols-3 gap-4">
        {/* Signature area */}
        <div className="col-span-1 border border-border rounded-lg p-4 flex flex-col items-center justify-between">
          <p className="text-[10px] text-muted-foreground mb-2">التوقيع</p>
          <div className="w-full h-16 border-b border-dashed border-border" />
        </div>

        {/* Date */}
        <div className="col-span-1 border border-border rounded-lg p-4 flex flex-col items-center justify-center">
          <p className="text-[10px] text-muted-foreground mb-1">التاريخ</p>
          <p className="text-sm font-semibold text-foreground" dir="ltr">{today}</p>
        </div>

        {/* QR linked to report */}
        <div className="col-span-1 border border-border rounded-lg p-4 flex flex-col items-center justify-center gap-2">
          <QRCodeSVG value={qrValue} size={72} level="M" />
          <span className="text-[10px] text-muted-foreground text-center">رمز التحقق</span>
        </div>
      </div>

      {/* ── Legal footer ── */}
      <div className="border border-border rounded-lg px-4 py-3 bg-muted/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
          هذا القسم يُولَّد تلقائياً ولا يمكن تعديله أو حذفه — البيانات مأخوذة من سجلات الشركة الرسمية
        </p>
      </div>
    </div>
  );
}
