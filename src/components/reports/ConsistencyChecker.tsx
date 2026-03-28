import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, CheckCircle2, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { checkBilingualConsistency } from "@/lib/report-api";
import type { ReportData } from "@/lib/report-types";

interface Props {
  data: ReportData;
  result: { consistent: boolean; issues: Array<{ type: string; description_ar: string; description_en: string }> } | null;
  onCheck: (result: { consistent: boolean; issues: any[] }) => void;
}

export default function ConsistencyChecker({ data, result, onCheck }: Props) {
  const [isChecking, setIsChecking] = useState(false);
  const { toast } = useToast();

  const handleCheck = async () => {
    setIsChecking(true);
    try {
      const res = await checkBilingualConsistency({
        arabic_conclusion: `${data.reconciliation_ar}\n${data.final_value_text_ar}\n${data.final_value} ${data.currency}`,
        english_conclusion: `${data.reconciliation_en}\n${data.final_value_text_en}\n${data.final_value} ${data.currency}`,
      });
      onCheck(res);
      if (res.consistent) {
        toast({ title: "✅ التقرير متسق", description: "النسختان العربية والإنجليزية متطابقتان في المعنى والقيمة" });
      } else {
        toast({ title: "⚠️ تم اكتشاف عدم تطابق", description: `${res.issues.length} مشكلة تحتاج مراجعة`, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            فحص تطابق النسختين العربية والإنجليزية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            يقوم النظام بمقارنة النسخة العربية والإنجليزية من التقرير للتأكد من تطابق:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 mr-4 list-disc">
            <li>القيمة النهائية (رقماً وكتابةً)</li>
            <li>نتيجة التسوية والمطابقة</li>
            <li>المعنى العام للخلاصة</li>
            <li>المصطلحات المهنية المستخدمة</li>
          </ul>

          <Button onClick={handleCheck} disabled={isChecking} className="gap-2">
            {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            {isChecking ? "جاري الفحص..." : "فحص التطابق"}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className={result.consistent ? "border-green-300" : "border-destructive"}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {result.consistent ? (
                <><CheckCircle2 className="w-5 h-5 text-green-600" /> النتيجة: متسق</>
              ) : (
                <><AlertTriangle className="w-5 h-5 text-destructive" /> النتيجة: غير متسق</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.consistent ? (
              <div className="space-y-3">
                <p className="text-sm text-green-700">
                  النسختان العربية والإنجليزية متطابقتان. يمكن إصدار التقرير.
                </p>
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-4 py-2 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>جاهز للإصدار النهائي</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-destructive font-medium">
                  تم اكتشاف {result.issues.length} مشكلة. يجب حلها قبل الإصدار النهائي.
                </p>
                <div className="space-y-2">
                  {result.issues.map((issue, i) => (
                    <div key={i} className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="destructive" className="text-xs">{issue.type}</Badge>
                      </div>
                      <p className="text-sm text-foreground">{issue.description_ar}</p>
                      <p className="text-sm text-muted-foreground mt-1" dir="ltr">{issue.description_en}</p>
                    </div>
                  ))}
                </div>
                <Separator />
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 px-4 py-2 rounded-lg">
                  <Lock className="w-4 h-4" />
                  <span>الإصدار النهائي مقفل حتى حل جميع المشاكل</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
