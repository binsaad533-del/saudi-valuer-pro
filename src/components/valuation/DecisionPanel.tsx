import { useMemo } from "react";
import { calculateConfidence, type ValuationContext } from "@/lib/confidence-scoring";
import { detectRisks, type RiskContext } from "@/lib/risk-detection";
import { evaluateDecision, type DecisionStatus } from "@/lib/decision-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  XCircle,
  Gavel,
} from "lucide-react";

const STATUS_CONFIG: Record<
  DecisionStatus,
  { icon: typeof CheckCircle2; badge: string; accent: string }
> = {
  approved: {
    icon: CheckCircle2,
    badge: "bg-green-500/10 text-green-600 border-green-200",
    accent: "border-l-green-500",
  },
  review: {
    icon: AlertTriangle,
    badge: "bg-amber-500/10 text-amber-600 border-amber-200",
    accent: "border-l-amber-500",
  },
  high_risk: {
    icon: ShieldAlert,
    badge: "bg-red-500/10 text-red-600 border-red-200",
    accent: "border-l-red-500",
  },
  rejected: {
    icon: XCircle,
    badge: "bg-red-500/10 text-red-700 border-red-300",
    accent: "border-l-red-600",
  },
};

interface Props {
  context: RiskContext;
  compliancePassed: boolean;
}

export default function DecisionPanel({ context, compliancePassed }: Props) {
  const { decision, confidence, risks } = useMemo(() => {
    const conf = calculateConfidence(context as ValuationContext);
    const rsk = detectRisks(context);
    const dec = evaluateDecision(compliancePassed, conf, rsk);
    return { decision: dec, confidence: conf, risks: rsk };
  }, [context, compliancePassed]);

  const cfg = STATUS_CONFIG[decision.status];
  const Icon = cfg.icon;

  return (
    <Card className={`border-l-4 ${cfg.accent}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gavel className="w-4 h-4 text-primary" />
            توصية القرار
          </span>
          <Badge className={cfg.badge}>
            <Icon className="w-3.5 h-3.5 ml-1" />
            {decision.title_ar}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {decision.explanation_ar}
        </p>

        {/* Quick stats */}
        <div className="flex gap-4 text-xs">
          <span className="text-foreground">
            الثقة: <strong>{confidence.overall}%</strong>
          </span>
          <span className="text-foreground">
            المخاطر:{" "}
            <strong>
              {risks.totalHigh > 0 && <span className="text-red-600">{risks.totalHigh} عالية</span>}
              {risks.totalHigh > 0 && risks.totalMedium > 0 && " · "}
              {risks.totalMedium > 0 && (
                <span className="text-amber-600">{risks.totalMedium} متوسطة</span>
              )}
              {risks.totalHigh === 0 && risks.totalMedium === 0 && (
                <span className="text-green-600">لا توجد</span>
              )}
            </strong>
          </span>
        </div>

        {/* Top issues */}
        {decision.topIssues.length > 0 && (
          <ul className="space-y-1">
            {decision.topIssues.map((issue, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
