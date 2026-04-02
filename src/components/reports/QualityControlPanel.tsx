import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, AlertTriangle, Clock, Shield,
  Users, Award, Loader2,
} from "lucide-react";
import {
  runAutomatedQC, getQCLevelLabel, getQCStatusBadge,
  type QCReport, type QCLevel, type QCCheckResultItem,
} from "@/lib/quality-control-engine";

interface Props {
  assignment: any;
  comparables: any[];
  inspection: any;
  photos: any[];
}

const LEVEL_ICONS: Record<QCLevel, React.ReactNode> = {
  automated: <Shield className="h-4 w-4" />,
  peer_review: <Users className="h-4 w-4" />,
  senior_review: <Award className="h-4 w-4" />,
  final_approval: <CheckCircle2 className="h-4 w-4" />,
};

export default function QualityControlPanel({ assignment, comparables, inspection, photos }: Props) {
  const [report, setReport] = useState<QCReport | null>(null);
  const [running, setRunning] = useState(false);

  const runQC = () => {
    setRunning(true);
    setTimeout(() => {
      const result = runAutomatedQC({ assignment, comparables, inspection, photos });
      setReport(result);
      setRunning(false);
    }, 1500);
  };

  if (!report) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-8 text-center space-y-4">
          <Shield className="h-12 w-12 mx-auto text-primary/40" />
          <div>
            <h3 className="font-semibold text-foreground">نظام ضبط الجودة</h3>
            <p className="text-sm text-muted-foreground mt-1">
              فحص شامل متعدد المستويات يضمن جودة التقرير والامتثال للمعايير
            </p>
          </div>
          <Button onClick={runQC} disabled={running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {running ? "جاري الفحص..." : "بدء فحص الجودة"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusBadge = getQCStatusBadge(report.overallStatus);
  const levels: QCLevel[] = ["automated", "peer_review", "senior_review", "final_approval"];

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                report.overallScore >= 80 ? "bg-green-100 text-green-600" :
                report.overallScore >= 50 ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              }`}>
                <span className="text-lg font-bold">{report.overallScore}</span>
              </div>
              <div>
                <p className="font-semibold text-foreground">تقييم الجودة الشامل</p>
                <Badge className={`text-xs ${statusBadge.color}`}>{statusBadge.label}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={runQC} disabled={running} className="gap-1">
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
              إعادة الفحص
            </Button>
          </div>
          <Progress value={report.overallScore} className="h-2" />

          {report.blockers.length > 0 && (
            <div className="mt-3 p-2 rounded bg-destructive/10 border border-destructive/20">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                <XCircle className="h-3 w-3" /> {report.blockers.length} مانع للإصدار
              </p>
            </div>
          )}
          {report.warnings.length > 0 && (
            <div className="mt-2 p-2 rounded bg-warning/10 border border-warning/20">
              <p className="text-xs font-semibold text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {report.warnings.length} تحذيرات
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Levels */}
      <Tabs defaultValue="automated" dir="rtl">
        <TabsList className="w-full">
          {levels.map(level => {
            const lr = report.levelResults[level];
            return (
              <TabsTrigger key={level} value={level} className="text-xs gap-1">
                {LEVEL_ICONS[level]}
                {getQCLevelLabel(level)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {levels.map(level => {
          const lr = report.levelResults[level];
          return (
            <TabsContent key={level} value={level}>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">{LEVEL_ICONS[level]} {getQCLevelLabel(level)}</span>
                    <Badge className={`text-xs ${getQCStatusBadge(lr.status).color}`}>
                      {lr.score}% — {getQCStatusBadge(lr.status).label}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {lr.checks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                      <Clock className="h-4 w-4" /> لم يتم التنفيذ بعد
                    </p>
                  ) : (
                    lr.checks.map((item) => (
                      <CheckRow key={item.checkId} item={item} />
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function CheckRow({ item }: { item: QCCheckResultItem }) {
  return (
    <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
      item.result.passed ? "bg-green-50/50 border-green-200/50" :
      item.isMandatory ? "bg-red-50/50 border-red-200/50" :
      "bg-yellow-50/50 border-yellow-200/50"
    }`}>
      <div className="flex items-center gap-2">
        {item.result.passed ? (
          <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        ) : item.isMandatory ? (
          <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
        )}
        <div>
          <p className="text-xs font-medium text-foreground">{item.labelAr}</p>
          <p className="text-[10px] text-muted-foreground">{item.result.messageAr}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {item.isMandatory && (
          <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">إلزامي</Badge>
        )}
        <span className={`text-xs font-bold ${item.result.passed ? "text-green-600" : "text-red-600"}`}>
          {item.result.score}%
        </span>
      </div>
    </div>
  );
}
