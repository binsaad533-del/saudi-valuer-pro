import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { getValuationModeLabel, isDesktopValuationMode } from "@/lib/valuation-mode";

interface JourneyRaqeemGuideProps {
  step: "start" | "upload" | "processing" | "scope" | "complete";
  valuationMode: string;
  fileCount: number;
  processingProgress: number;
}

const STEP_COPY = {
  start: {
    title: "سأرتّب الطلب معك من البداية",
    body: "ابدأ بالبيانات الأساسية فقط، وبعدها سأوجّهك في رفع الملفات والخطوة التالية بدون تشتيت.",
  },
  upload: {
    title: "ارفع الملفات كاملة ثم ابدأ التحليل",
    body: "لن يبدأ التحليل أثناء الرفع، وبعد اكتمال الملفات سأستخدمها لبناء نطاق العمل بشكل أوضح وأسرع.",
  },
  processing: {
    title: "أحلّل الملف الآن بعد اكتمال الرفع",
    body: "أراجع المستندات والأصول تمهيداً لتجهيز نطاق العمل والبيانات المطلوبة للمسار الصحيح.",
  },
  scope: {
    title: "راجعت الأصول وأعددت نطاق العمل",
    body: "راجع البنود الظاهرة، واعتمد الصحيح منها فقط، وإذا كان هناك غموض فسأوضحه لك هنا قبل الإرسال.",
  },
  complete: {
    title: "أصبحت أتابع طلبك خطوة بخطوة",
    body: "بعد الإرسال ستجدني داخل صفحة الطلب لشرح الحالة الحالية، ما المطلوب منك، وما الذي يجري الآن في الخلفية.",
  },
};

export default function JourneyRaqeemGuide({ step, valuationMode, fileCount, processingProgress }: JourneyRaqeemGuideProps) {
  const isDesktop = isDesktopValuationMode(valuationMode);
  const copy = STEP_COPY[step];

  return (
    <Card className="mt-4 border-primary/15 bg-primary/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <RaqeemAnimatedLogo size={36} />
          </div>
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground">ChatGPT معك في هذه المرحلة</p>
              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">
                {getValuationModeLabel(valuationMode, fileCount > 0)}
              </Badge>
              {step === "processing" && (
                <Badge variant="secondary" className="text-[10px]">
                  {processingProgress}%
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground">{copy.title}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{copy.body}</p>
            {isDesktop ? (
              <p className="text-xs text-foreground/80 leading-relaxed">
                هذا الطلب <strong>مكتبي</strong>، لذلك لا يتضمن معاينة ميدانية أو إحالة إلى معاين، وسيستند إلى المستندات والصور المرفوعة فقط.
              </p>
            ) : (
              <p className="text-xs text-foreground/80 leading-relaxed">
                هذا الطلب <strong>ميداني</strong>، وقد يتضمن لاحقاً تنسيق معاينة فعلية بحسب حالة الطلب ونطاق العمل.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}