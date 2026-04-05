import { useMemo } from "react";
import {
  detectRisks,
  CATEGORY_LABELS,
  SEVERITY_LABELS,
  type RiskContext,
  type RiskSeverity,
  type OverallRiskLevel,
} from "@/lib/risk-detection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  AlertTriangle,
  Info,
  Database,
  Scale,
  TrendingDown,
  ShieldCheck,
  Settings,
} from "lucide-react";

const SEVERITY_STYLES: Record<RiskSeverity, string> = {
  high: "bg-red-500/10 text-red-600 border-red-200",
  medium: "bg-amber-500/10 text-amber-600 border-amber-200",
  low: "bg-blue-500/10 text-blue-500 border-blue-200",
};

const LEVEL_STYLES: Record<OverallRiskLevel, { bg: string; icon: typeof ShieldAlert }> = {
  high: { bg: "bg-red-500/10 text-red-600 border-red-200", icon: ShieldAlert },
  medium: { bg: "bg-amber-500/10 text-amber-600 border-amber-200", icon: AlertTriangle },
  low: { bg: "bg-green-500/10 text-green-600 border-green-200", icon: ShieldCheck },
};

const LEVEL_LABELS: Record<OverallRiskLevel, string> = {
  high: "مخاطر عالية",
  medium: "مخاطر متوسطة",
  low: "مخاطر منخفضة",
};

const CAT_ICONS: Record<string, typeof Database> = {
  data: Database,
  method: Scale,
  market: TrendingDown,
  compliance: ShieldCheck,
  operational: Settings,
};

interface Props {
  context: RiskContext;
}

export default function RiskDetectionPanel({ context }: Props) {
  const report = useMemo(() => detectRisks(context), [context]);

  const { overallLevel, risks, totalHigh, totalMedium, totalLow } = report;
  const LevelIcon = LEVEL_STYLES[overallLevel].icon;

  if (risks.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            مخاطر التقييم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            لا توجد مخاطر مكتشفة — التقييم يبدو سليماً
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <LevelIcon className="w-4 h-4" />
            مخاطر التقييم
          </span>
          <Badge className={LEVEL_STYLES[overallLevel].bg}>
            {LEVEL_LABELS[overallLevel]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary counts */}
        <div className="flex gap-3 text-xs">
          {totalHigh > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              {totalHigh} عالية
            </span>
          )}
          {totalMedium > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              {totalMedium} متوسطة
            </span>
          )}
          {totalLow > 0 && (
            <span className="flex items-center gap-1 text-blue-500">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              {totalLow} منخفضة
            </span>
          )}
        </div>

        {/* Risk list */}
        <ul className="space-y-3">
          {risks.map((risk) => {
            const CatIcon = CAT_ICONS[risk.category] ?? Info;
            return (
              <li key={risk.id} className="space-y-1">
                <div className="flex items-start gap-2">
                  <CatIcon className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">
                        {risk.title_ar}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 ${SEVERITY_STYLES[risk.severity]}`}
                      >
                        {SEVERITY_LABELS[risk.severity].ar}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {risk.description_ar}
                    </p>
                    <p className="text-xs text-primary mt-0.5">
                      ← {risk.action_ar}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
