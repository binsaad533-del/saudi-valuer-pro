/**
 * قسم الاعتماد والتراخيص والبيانات النظامية
 * يُضاف تلقائياً في نهاية كل تقرير — لا يمكن تعديله أو حذفه
 */
import { QRCodeSVG } from "qrcode.react";
import { Separator } from "@/components/ui/separator";
import { JSAAS_IDENTITY } from "@/lib/company-identity";

export default function ReportAccreditationSection() {
  const id = JSAAS_IDENTITY;

  return (
    <div className="space-y-6 text-black" dir="rtl">
      {/* Section Title */}
      <div className="border-b-2 border-primary pb-2">
        <h2 className="text-base font-bold text-foreground">الاعتماد والتراخيص والبيانات النظامية</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Accreditation, Licenses & Regulatory Information</p>
      </div>

      {/* Company & Valuer */}
      <div className="grid grid-cols-1 gap-4">
        {/* Company */}
        <div className="border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-bold text-foreground">{id.companyName}</p>
          <Separator />

          <div className="space-y-2.5">
            {/* Valuer */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">المقيم</p>
              <p className="text-sm font-semibold text-foreground">{id.valuerName}</p>
              <p className="text-xs text-muted-foreground">{id.valuerTitle}</p>
            </div>

            {/* License */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">ترخيص مزاولة المهنة</p>
              <p className="text-sm text-foreground">
                رقم <span className="font-semibold" dir="ltr">{id.licenseNumber}</span> ({id.licenseBranch})
              </p>
            </div>

            {/* Memberships */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">العضويات</p>
              <div className="space-y-1">
                {id.memberships.map((m) => (
                  <div key={m.number} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{m.label}</span>
                    <span className="font-semibold text-foreground" dir="ltr">{m.number}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Registration Data */}
        <div className="grid grid-cols-2 gap-4">
          <div className="border border-border rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground mb-1">السجل التجاري</p>
            <p className="text-sm font-bold text-foreground" dir="ltr">{id.crNumber}</p>
          </div>
          <div className="border border-border rounded-lg p-4">
            <p className="text-[10px] text-muted-foreground mb-1">الرقم الضريبي</p>
            <p className="text-sm font-bold text-foreground" dir="ltr">{id.taxNumber}</p>
          </div>
        </div>

        {/* Address */}
        <div className="border border-border rounded-lg p-4">
          <p className="text-[10px] text-muted-foreground mb-1">العنوان</p>
          <p className="text-sm text-foreground">{id.address}</p>
        </div>
      </div>

      {/* QR Codes */}
      <div>
        <p className="text-xs font-semibold text-foreground mb-3">رموز التحقق الإلكتروني</p>
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center gap-2 border border-border rounded-lg p-3">
            <QRCodeSVG value={id.qrLinks.cr} size={64} level="M" />
            <span className="text-[10px] text-muted-foreground text-center">السجل التجاري</span>
          </div>
          <div className="flex flex-col items-center gap-2 border border-border rounded-lg p-3">
            <QRCodeSVG value={id.qrLinks.license} size={64} level="M" />
            <span className="text-[10px] text-muted-foreground text-center">الترخيص المهني</span>
          </div>
          <div className="flex flex-col items-center gap-2 border border-border rounded-lg p-3">
            <QRCodeSVG value={id.qrLinks.vat} size={64} level="M" />
            <span className="text-[10px] text-muted-foreground text-center">شهادة ضريبة القيمة المضافة</span>
          </div>
        </div>
      </div>

      {/* Legal notice */}
      <div className="border border-border rounded-lg px-4 py-3 bg-muted/20">
        <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
          هذه البيانات مستخرجة من جهات رسمية ويمكن التحقق منها عبر رموز QR المرفقة
        </p>
      </div>

      {/* Auto-generated notice */}
      <div className="border border-border rounded px-4 py-2">
        <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
          هذا القسم يُولَّد تلقائياً ولا يمكن تعديله أو حذفه — البيانات مأخوذة من سجلات الشركة الرسمية
        </p>
      </div>
    </div>
  );
}
