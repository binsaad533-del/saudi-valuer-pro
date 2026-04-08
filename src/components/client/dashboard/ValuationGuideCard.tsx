import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck, FileCheck, Search, BarChart3 } from "lucide-react";

export function ValuationGuideCard() {
  const steps = [
    {
      step: 1,
      icon: <FileCheck className="w-5 h-5 text-primary" />,
      title: "جهّز المستندات الأساسية",
      desc: "صك الملكية أو عقد الإيجار، رخصة البناء، الكروكي، فواتير الشراء للمعدات والآلات. كلما كانت المستندات أكثر اكتمالاً، كان التقييم أدق وأسرع.",
    },
    {
      step: 2,
      icon: <Search className="w-5 h-5 text-primary" />,
      title: "حدّد غرض التقييم بدقة",
      desc: "هل التقييم لغرض البيع/الشراء، التمويل البنكي، التأمين، التصفية، الاندماج والاستحواذ، أو لأغراض محاسبية؟ تحديد الغرض يؤثر على أساس القيمة والمنهجية المستخدمة.",
    },
    {
      step: 3,
      icon: <BarChart3 className="w-5 h-5 text-primary" />,
      title: "نحن نتولى الباقي",
      desc: "يقوم فريقنا بتحديد منهجية التقييم الأنسب (سوقية، دخل، تكلفة) وفقاً لمعايير IVS الدولية ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم)، مع معاينة ميدانية شاملة.",
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <ClipboardCheck className="w-4 h-4 text-primary" />
          </div>
          كيف تطلب تقييم بالطريقة الصحيحة؟
        </CardTitle>
        <p className="text-xs text-muted-foreground">اتبع هذه الخطوات لضمان تقييم دقيق وسريع</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid gap-3">
          {steps.map((item) => (
            <div key={item.step} className="flex gap-3 items-start bg-muted/40 rounded-xl p-3.5 border border-border/50">
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {item.step}
                </div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {item.icon}
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground">💡 نصيحة:</span>{" "}
            إرفاق جميع المستندات والصور من البداية يقلل مدة التقييم بنسبة تصل إلى 40% ويضمن دقة أعلى في النتائج.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
