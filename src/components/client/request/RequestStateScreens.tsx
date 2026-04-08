/**
 * State screen overlays for SimpleClientRequest
 * Extraction failed, done, processing, analyzing states
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Loader2, CheckCircle, AlertTriangle,
  RotateCcw, Shield, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ExtractionFailedProps {
  reason: string;
  onRetry: () => void;
  onModifyFiles: () => void;
}

export function ExtractionFailedScreen({ reason, onRetry, onModifyFiles }: ExtractionFailedProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">تعذر استخراج الأصول</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {reason || "لم يتمكن النظام من استخراج الأصول من الملفات المرفوعة."}
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-4 text-right space-y-2">
            <p className="text-xs font-semibold text-foreground">نصائح لتحسين النتائج:</p>
            <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>ارفع صور واضحة وعالية الجودة للمعدات أو العقارات</li>
              <li>أضف ملف Excel يحتوي على قائمة الأصول مع التفاصيل</li>
              <li>تأكد من أن ملفات PDF ليست مشفرة أو ممسوحة ضوئياً بجودة منخفضة</li>
              <li>استخدم صور مباشرة وليس لقطات شاشة</li>
            </ul>
          </div>
          <div className="space-y-2 pt-1">
            <Button onClick={onRetry} className="w-full gap-2">
              <RotateCcw className="w-4 h-4" />
              إعادة التحليل
            </Button>
            <Button onClick={onModifyFiles} variant="outline" className="w-full gap-2">
              <Upload className="w-4 h-4" />
              تعديل الملفات
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DoneScreenProps {
  requestId: string | null;
}

export function DoneScreen({ requestId }: DoneScreenProps) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">تم إرسال طلبك بنجاح</h2>
          <p className="text-sm text-muted-foreground">
            تم استلام طلبك بنجاح، يتم الآن مراجعة الطلب وإعداد عرض السعر.
            سيتم إشعارك فور جاهزية العرض.
          </p>
          <div className="bg-muted/50 rounded-xl p-4 text-right space-y-3">
            {[
              { icon: "✓", label: "تم الإرسال", active: true },
              { icon: "⏳", label: "مراجعة الطلب وإعداد التسعير", active: true, pulse: true },
              { icon: "⏳", label: "إصدار عرض السعر", active: false },
              { icon: "🔒", label: "بدء التقييم", active: false },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.active
                    ? i === 0 ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    : "bg-muted text-muted-foreground"
                } ${step.pulse ? "animate-pulse" : ""}`}>{step.icon}</span>
                <span className={`text-sm ${step.active ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-2">
            <Button onClick={() => navigate("/client/dashboard")} className="w-full">العودة للوحة التحكم</Button>
            {requestId && (
              <Button onClick={() => navigate(`/client/request/${requestId}`)} variant="outline" className="w-full">
                تتبع الطلب
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ProgressScreenProps {
  progress: number;
  label: string;
  title: string;
  subtitle: string;
  icon: "spinner" | "sparkles";
}

export function ProgressScreen({ progress, label, title, subtitle, icon }: ProgressScreenProps) {
  const Icon = icon === "sparkles" ? Sparkles : Loader2;
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Icon className={`w-8 h-8 text-primary ${icon === "sparkles" ? "animate-pulse" : "animate-spin"}`} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground mb-1">{title}</h3>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        <div>
          <Progress value={progress} className="h-2 mb-2" />
          <p className="text-xs text-muted-foreground">{progress}%</p>
        </div>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5" />
          <span>{subtitle}</span>
        </div>
      </div>
    </div>
  );
}
