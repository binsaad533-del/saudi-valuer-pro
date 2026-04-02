import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { REPORT_TEMPLATES, type TemplateType } from "@/lib/report-templates";

interface Props {
  selected: TemplateType | null;
  onSelect: (type: TemplateType) => void;
}

export default function ReportTemplateSelector({ selected, onSelect }: Props) {
  const templates = Object.values(REPORT_TEMPLATES);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">اختر قالب التقرير</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {templates.map((t) => {
          const isSelected = selected === t.type;
          const requiredCount = t.sections.filter(s => s.required).length;

          return (
            <Card
              key={t.type}
              className={`cursor-pointer transition-all hover:shadow-md border-2 ${
                isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/50 hover:border-primary/30"
              }`}
              onClick={() => onSelect(t.type)}
            >
              <CardContent className="p-4 text-center space-y-2 relative">
                {isSelected && (
                  <CheckCircle2 className="absolute top-2 left-2 h-4 w-4 text-primary" />
                )}
                <span className="text-3xl">{t.icon}</span>
                <p className="font-semibold text-sm text-foreground">{t.nameAr}</p>
                <p className="text-[10px] text-muted-foreground">{t.nameEn}</p>
                <div className="flex flex-wrap justify-center gap-1 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    {requiredCount} قسم
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {t.minComparables}+ مقارنات
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
