/**
 * إخلاء المسؤولية المهني — يُضاف تلقائياً قبل صفحة التوقيع
 */
import { JSAAS_IDENTITY } from "@/lib/company-identity";

export default function ReportDisclaimerSection() {
  return (
    <div className="space-y-5" dir="rtl">
      <div className="border-b-2 border-primary pb-2">
        <h2 className="text-base font-bold text-foreground">إخلاء مسؤولية مهني</h2>
        <p className="text-[10px] text-muted-foreground mt-0.5">Professional Disclaimer</p>
      </div>

      <div className="border border-border rounded-lg p-5 space-y-4">
        <p className="text-sm leading-7 text-foreground">
          تم إعداد هذا التقرير بالاعتماد على بيانات مقدمة من العميل
          ومن مصادر يُعتقد بموثوقيتها، وبما يتوافق مع المعايير الدولية للتقييم (IVS)
          والأنظمة الصادرة عن الهيئة السعودية للمقيمين المعتمدين (TAQEEM).
        </p>

        <p className="text-sm leading-7 text-foreground">
          تم استخدام أدوات تحليل متقدمة وتقنيات رقمية مؤتمتة
          لدعم معالجة البيانات واستخلاص المؤشرات، دون الإخلال
          بالحكم المهني للمقيم المعتمد.
        </p>

        <p className="text-sm leading-7 text-foreground">
          تمثل النتائج رأياً مهنياً مبنياً على المعلومات المتاحة
          بتاريخ التقييم، وقد تتأثر بأي تغييرات لاحقة.
        </p>

        <p className="text-sm leading-7 text-foreground">
          لا تتحمل {JSAAS_IDENTITY.companyName} أي مسؤولية عن استخدام التقرير
          خارج الغرض المحدد له.
        </p>
      </div>
    </div>
  );
}
