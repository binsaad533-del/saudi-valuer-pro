import { useMemo } from "react";
import {
  calculateConfidence,
  LEVEL_LABELS,
  type ConfidenceLevel,
  type ConfidenceResult,
  type ValuationContext,
} from "@/lib/confidence-scoring";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, TrendingUp, Database, Scale } from "lucide-react";

const LEVEL_STYLES: Record<ConfidenceLevel, string> = {
  high: "bg-green-500/10 text-green-600 border-green-200",
  good: "bg-blue-500/10 text-blue-600 border-blue-200",
  moderate: "bg-amber-500/10 text-amber-600 border-amber-200",
  low: "bg-red-500/10 text-red-600 border-red-200",
};

const PROGRESS_COLORS: Record<ConfidenceLevel, string> = {
  high: "[&>div]:bg-green-500",
  good: "[&>div]:bg-blue-500",
  moderate: "[&>div]:bg-amber-500",
  low: "[&>div]:bg-red-500",
};

const COMPONENT_ICONS = {
  dataQuality: Database,
  methodStrength: Scale,
  compliance: ShieldCheck,
  consistency: TrendingUp,
} as const;

interface Props {
  context: ValuationContext;
  compact?: boolean;
}

export default function ConfidenceScoreCard({ context, compact }: Props) {
  const result: ConfidenceResult = useMemo(
    () => calculateConfidence(context),
    [context]
  );

  const { overall, level, components } = result;
  const entries = Object.entries(components) as [keyof typeof components, typeof components.dataQuality][];

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="relative w-14 h-14">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              className="stroke-muted"
              strokeWidth="3"
            />
            <circle
              cx="18" cy="18" r="15.9"
              fill="none"
              className={
                level === "high" ? "stroke-green-500"
                : level === "good" ? "stroke-blue-500"
                : level === "moderate" ? "stroke-amber-500"
                : "stroke-red-500"
              }
              strokeWidth="3"
              strokeDasharray={`${overall} ${100 - overall}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">
            {overall}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">مؤشر الثقة</p>
          <Badge className={`text-xs ${LEVEL_STYLES[level]}`}>
            {LEVEL_LABELS[level].ar}
          </Badge>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            مؤشر ثقة التقييم
          </span>
          <Badge className={LEVEL_STYLES[level]}>{LEVEL_LABELS[level].ar}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overall donut */}
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                className="stroke-muted"
                strokeWidth="2.5"
              />
              <circle
                cx="18" cy="18" r="15.9"
                fill="none"
                className={
                  level === "high" ? "stroke-green-500"
                  : level === "good" ? "stroke-blue-500"
                  : level === "moderate" ? "stroke-amber-500"
                  : "stroke-red-500"
                }
                strokeWidth="2.5"
                strokeDasharray={`${overall} ${100 - overall}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-foreground">
              {overall}%
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {level === "high" && "التقييم يعتمد على بيانات قوية ومنهجية متينة."}
            {level === "good" && "التقييم جيد مع بعض النقاط القابلة للتحسين."}
            {level === "moderate" && "يُنصح بمراجعة البيانات والمنهجية لتحسين الدقة."}
            {level === "low" && "يحتاج التقييم مراجعة شاملة قبل الاعتماد."}
          </p>
        </div>

        {/* Component breakdown */}
        <div className="space-y-3">
          {entries.map(([key, comp]) => {
            const Icon = COMPONENT_ICONS[key];
            const compLevel: ConfidenceLevel =
              comp.score >= 90 ? "high"
              : comp.score >= 75 ? "good"
              : comp.score >= 60 ? "moderate"
              : "low";

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    {comp.label_ar}
                    <span className="text-xs text-muted-foreground">({Math.round(comp.weight * 100)}%)</span>
                  </span>
                  <span className="font-semibold text-foreground">{comp.score}%</span>
                </div>
                <Progress
                  value={comp.score}
                  className={`h-2 ${PROGRESS_COLORS[compLevel]}`}
                />
                {comp.details.length > 0 && (
                  <p className="text-xs text-muted-foreground pr-5">
                    {comp.details[0]}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
