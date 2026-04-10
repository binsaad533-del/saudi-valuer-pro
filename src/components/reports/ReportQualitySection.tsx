import { Shield, CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

interface QualityData {
  score: number;
  strengths: string[];
  weaknesses: string[];
  standardsCompliance: string;
}

interface ReportQualitySectionProps {
  quality?: QualityData;
}

function getGrade(score: number) {
  if (score >= 90) return { label: "ممتاز", color: "text-green-700", bg: "bg-green-500", barBg: "bg-green-100" };
  if (score >= 80) return { label: "جيد جداً", color: "text-blue-700", bg: "bg-blue-500", barBg: "bg-blue-100" };
  if (score >= 70) return { label: "مقبول", color: "text-amber-700", bg: "bg-amber-500", barBg: "bg-amber-100" };
  return { label: "مرفوض", color: "text-red-700", bg: "bg-red-500", barBg: "bg-red-100" };
}

const DEFAULT_QUALITY: QualityData = {
  score: 88,
  strengths: [
    "التزام كامل بمعايير التقييم الدولية IVS 2025",
    "تحليل سوقي شامل مدعوم ببيانات حديثة",
    "منهجية تقييم واضحة ومبررة",
  ],
  weaknesses: [
    "يُنصح بتعزيز قسم التحليل بمقارنات إضافية",
  ],
  standardsCompliance: "يتوافق هذا التقرير مع معايير التقييم الدولية (IVS 2025) ومعايير الهيئة السعودية للمقيمين المعتمدين (تقييم).",
};

export default function ReportQualitySection({ quality }: ReportQualitySectionProps) {
  const q = quality || DEFAULT_QUALITY;
  const grade = getGrade(q.score);

  return (
    <div className="mx-6 mt-6">
      <h2 className="text-lg font-bold border-b pb-2 mb-4 flex items-center gap-2">
        <Shield className="w-5 h-5 text-primary" />
        تقييم جودة التقرير
      </h2>

      <div className="border rounded-lg overflow-hidden">
        {/* Score header */}
        <div className="p-4 bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-full ${grade.barBg} flex items-center justify-center`}>
              <span className={`text-xl font-bold ${grade.color}`}>{q.score}%</span>
            </div>
            <div>
              <p className={`font-bold text-base ${grade.color}`}>{grade.label}</p>
              <p className="text-xs text-muted-foreground">مؤشر جودة التقرير</p>
            </div>
          </div>
          {/* Mini bar */}
          <div className="w-32">
            <div className={`h-2 rounded-full ${grade.barBg}`}>
              <div className={`h-full rounded-full ${grade.bg}`} style={{ width: `${q.score}%` }} />
            </div>
          </div>
        </div>

        <div className="p-4 grid grid-cols-2 gap-4 text-sm">
          {/* Strengths */}
          <div>
            <p className="font-semibold text-green-700 flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4" />
              نقاط القوة
            </p>
            <ul className="space-y-1.5">
              {q.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <span className="text-green-500 mt-0.5">●</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div>
            <p className="font-semibold text-amber-700 flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-4 h-4" />
              ملاحظات التحسين
            </p>
            <ul className="space-y-1.5">
              {q.weaknesses.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed">
                  <span className="text-amber-500 mt-0.5">●</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Compliance footer */}
        <div className="px-4 pb-4">
          <div className="bg-primary/5 rounded-md p-3 flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs leading-relaxed">{q.standardsCompliance}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
