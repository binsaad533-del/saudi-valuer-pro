/**
 * Request Guidance — tips sidebar card
 */
import { Card, CardContent } from "@/components/ui/card";
import { Shield, CheckCircle, Cog, Building2 } from "lucide-react";

export default function RequestGuidance() {
  return (
    <Card className="bg-muted/30 border-dashed" dir="rtl">
      <CardContent className="p-4 space-y-4">
        <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-primary" />
          <span>دليل المرفقات لأفضل تقييم</span>
        </p>

        <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
          {[
            "جميع صيغ الملفات مدعومة (Excel, PDF, صور, Word...)",
            "كلما زادت المرفقات، كان التقييم أدق وأقرب للسعر العادل",
            "أرفق الفواتير وبرامج الصيانة وأي وثيقة تخص الأصل",
          ].map((text, i) => (
            <li key={i} className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary shrink-0" />
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <div className="border-t border-border/50 pt-4 space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Cog className="w-4 h-4 text-primary" />
            <span>للمعدات والآلات:</span>
          </p>
          <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
            {[
              "صور من كل الجوانب + من الداخل",
              "صور العدادات ولوحة البيانات (Nameplate)",
              "فواتير الشراء وبرامج الصيانة",
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border/50 pt-4 space-y-2.5">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-primary" />
            <span>للعقارات:</span>
          </p>
          <ul className="text-[11px] text-muted-foreground space-y-2 leading-relaxed">
            {[
              "صور الواجهة الخارجية من عدة زوايا",
              "صور داخلية: كل الغرف، الحوش، الممرات، المرافق",
              "صكوك الملكية وعقود الإيجار إن وُجدت",
              "حدد الموقع بدقة — الموقع عامل أساسي في التقييم",
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border/50 pt-3">
          <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <span>💡</span>
            <span>كل ملف إضافي يساعد في الوصول لتقييم أدق — لا تتردد في رفع أي وثيقة تخص الأصل</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
