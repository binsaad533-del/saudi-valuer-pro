import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Clock, FileText, CreditCard, Eye, Shield, AlertCircle } from "lucide-react";
import { isDesktopValuationMode } from "@/lib/valuation-mode";

interface StatusGuidanceCardProps {
  status: string;
  valuationMode?: string;
}

const STATUS_GUIDANCE: Record<string, { icon: any; title: string; description: string; nextStep: string; color: string }> = {
  submitted: {
    icon: CheckCircle,
    title: "تم استلام طلبك بنجاح",
    description: "يقوم فريقنا حالياً بمراجعة طلبك وإعداد نطاق العمل وعرض السعر.",
    nextStep: "ستصلك إشعار فور جاهزية عرض السعر ونطاق العمل للمراجعة والاعتماد.",
    color: "text-primary",
  },
  scope_generated: {
    icon: FileText,
    title: "نطاق العمل وعرض السعر جاهزان",
    description: "تم إعداد نطاق العمل وعرض السعر — يرجى مراجعتهما والموافقة للمتابعة.",
    nextStep: "راجع نطاق العمل أدناه واضغط 'موافقة' لاعتماده، أو تواصل معنا عبر المحادثة لأي استفسار.",
    color: "text-warning",
  },
  scope_approved: {
    icon: CreditCard,
    title: "بانتظار الدفعة الأولى",
    description: "تمت الموافقة على نطاق العمل — يرجى سداد الدفعة الأولى (50%) لبدء التقييم.",
    nextStep: "قم بتحويل المبلغ وأرفق إيصال الدفع، أو ادفع إلكترونياً لتفعيل المهمة فوراً.",
    color: "text-warning",
  },
  first_payment_confirmed: {
    icon: CheckCircle,
    title: "تم تأكيد الدفع — بدأ العمل",
    description: "تم استلام الدفعة الأولى وبدأ فريق التقييم بالعمل على ملفك.",
    nextStep: "سيتم التواصل معك في حال الحاجة لأي بيانات أو مستندات إضافية.",
    color: "text-success",
  },
  data_collection_open: {
    icon: FileText,
    title: "مرحلة جمع البيانات",
    description: "نقوم بجمع وتحليل البيانات اللازمة للتقييم.",
    nextStep: "قد يتم طلب مستندات إضافية منك — تابع المحادثة للرد السريع.",
    color: "text-primary",
  },
  data_collection_complete: {
    icon: CheckCircle,
    title: "اكتمل جمع البيانات",
    description: "تم جمع كافة البيانات المطلوبة وجارٍ الانتقال للمرحلة التالية.",
    nextStep: "سيتم جدولة المعاينة الميدانية أو بدء التحليل مباشرة حسب نوع التقييم.",
    color: "text-success",
  },
  inspection_pending: {
    icon: Eye,
    title: "بانتظار المعاينة الميدانية",
    description: "تم تعيين معاين معتمد وسيتم التنسيق معك لموعد الزيارة.",
    nextStep: "سيتواصل المعاين معك لتحديد موعد المعاينة — تأكد من توفر المفاتيح أو إمكانية الوصول.",
    color: "text-warning",
  },
  inspection_completed: {
    icon: CheckCircle,
    title: "اكتملت المعاينة",
    description: "أنهى المعاين زيارته الميدانية وجارٍ تحليل البيانات المجمعة.",
    nextStep: "سيتم تحليل بيانات المعاينة وإعداد التقييم — لا يتطلب منك أي إجراء حالياً.",
    color: "text-success",
  },
  data_validated: {
    icon: Shield,
    title: "تم التحقق من البيانات",
    description: "اجتازت البيانات فحوصات الجودة والامتثال.",
    nextStep: "جارٍ تشغيل محرك التقييم — ستصلك المسودة قريباً.",
    color: "text-success",
  },
  analysis_complete: {
    icon: Clock,
    title: "اكتمل التحليل",
    description: "أكمل محرك التقييم تحليله وجارٍ المراجعة المهنية.",
    nextStep: "يراجع المقيّم المعتمد النتائج ويطبق الحكم المهني قبل إصدار المسودة.",
    color: "text-primary",
  },
  professional_review: {
    icon: Shield,
    title: "المراجعة المهنية",
    description: "يقوم المقيّم المعتمد بمراجعة التقرير وتطبيق الحكم المهني.",
    nextStep: "سيتم إصدار مسودة التقرير لمراجعتك فور اكتمال المراجعة المهنية.",
    color: "text-primary",
  },
  draft_report_ready: {
    icon: FileText,
    title: "مسودة التقرير جاهزة",
    description: "تم إعداد مسودة التقرير وهي جاهزة لمراجعتك.",
    nextStep: "راجع المسودة أدناه وأضف ملاحظاتك أو وافق عليها للمتابعة.",
    color: "text-warning",
  },
  client_review: {
    icon: AlertCircle,
    title: "بانتظار مراجعتك",
    description: "المسودة مفتوحة لملاحظاتك — يرجى مراجعتها والرد.",
    nextStep: "أضف ملاحظاتك على الأقسام المطلوبة أو وافق على المسودة إذا كانت مقبولة.",
    color: "text-warning",
  },
  draft_approved: {
    icon: CreditCard,
    title: "تم اعتماد المسودة — بانتظار الدفعة النهائية",
    description: "تمت الموافقة على المسودة — يرجى سداد المبلغ المتبقي لإصدار التقرير النهائي.",
    nextStep: "قم بتحويل الدفعة النهائية وأرفق الإيصال لاستلام التقرير الرسمي.",
    color: "text-warning",
  },
  final_payment_confirmed: {
    icon: CheckCircle,
    title: "تم تأكيد الدفع النهائي",
    description: "جارٍ إصدار التقرير النهائي الرسمي.",
    nextStep: "ستصلك نسخة التقرير النهائي خلال وقت قصير.",
    color: "text-success",
  },
  issued: {
    icon: Shield,
    title: "التقرير صادر رسمياً",
    description: "تم إصدار التقرير النهائي وتوقيعه إلكترونياً.",
    nextStep: "يمكنك تحميل التقرير والتحقق من صحته عبر رمز QR.",
    color: "text-success",
  },
  archived: {
    icon: Shield,
    title: "تم أرشفة الملف",
    description: "اكتمل التقييم وتم أرشفة الملف بنجاح.",
    nextStep: "يمكنك الرجوع لهذا الملف في أي وقت من قسم الأرشيف.",
    color: "text-muted-foreground",
  },
  cancelled: {
    icon: AlertCircle,
    title: "تم إلغاء الطلب",
    description: "هذا الطلب ملغي.",
    nextStep: "يمكنك تقديم طلب تقييم جديد في أي وقت.",
    color: "text-destructive",
  },
};

export default function StatusGuidanceCard({ status, valuationMode }: StatusGuidanceCardProps) {
  const isDesktop = isDesktopValuationMode(valuationMode);
  const desktopOverrides = {
    data_collection_complete: {
      icon: CheckCircle,
      title: "اكتمل تجهيز الملف المكتبي",
      description: "تم استلام البيانات المطلوبة لهذا الطلب المكتبي وجارٍ الانتقال للتحليل دون معاينة ميدانية.",
      nextStep: "سيبدأ التحليل والمراجعة المهنية مباشرة وفق المستندات والصور المرفوعة.",
      color: "text-success",
    },
    inspection_pending: {
      icon: Eye,
      title: "الطلب في مسار مكتبي",
      description: "هذا الطلب لا يتطلب معاينة ميدانية، ويجري التعامل معه كمراجعة مكتبية وفق البيانات المرفوعة.",
      nextStep: "لا يلزمك أي تنسيق معاينة — سننتقل مباشرة للتحليل ثم المسودة عند اكتمال المراجعة.",
      color: "text-primary",
    },
    inspection_completed: {
      icon: CheckCircle,
      title: "التحليل المكتبي جارٍ",
      description: "تم تجاوز أي خطوة ميدانية لهذا الطلب المكتبي، والعمل الآن على التحليل وإعداد التقييم.",
      nextStep: "سنوافيك بالمسودة أو أي طلب بيانات إضافية عند الحاجة فقط.",
      color: "text-success",
    },
  };

  const guidance = (isDesktop && desktopOverrides[status as keyof typeof desktopOverrides]) || STATUS_GUIDANCE[status];
  if (!guidance) return null;

  const Icon = guidance.icon;

  return (
    <Card className="shadow-sm border-primary/10">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/5 ${guidance.color}`}>
            <Icon className="w-4.5 h-4.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="text-sm font-bold text-foreground">{guidance.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{guidance.description}</p>
            <div className="flex items-start gap-1.5 pt-1">
              <span className="text-[10px] font-semibold text-primary shrink-0 mt-px">الخطوة التالية:</span>
              <p className="text-[11px] text-foreground/80 leading-relaxed">{guidance.nextStep}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
