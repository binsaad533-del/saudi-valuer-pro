import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Mail, Clock, MessageCircle, Download } from "lucide-react";

export function ContactSupportCard() {
  return (
    <Card className="bg-gradient-to-l from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Phone className="w-4 h-4 text-primary" />
          </div>
          تواصل معنا
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
            <Phone className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">الهاتف</p>
              <p className="text-sm font-medium text-foreground" dir="ltr">0500668089</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
            <Mail className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
              <p className="text-sm font-medium text-foreground">care@jsaas-valuation.com</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-card rounded-lg p-3 border border-border">
            <Clock className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">ساعات العمل</p>
              <p className="text-sm font-medium text-foreground">السبت - الخميس، 8ص - 5م</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="https://wa.me/966500668089"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            تواصل عبر واتساب
          </a>
          <a
            href="/Profile_Jsaas_Valuation.pdf"
            download="بروفايل_جساس_للتقييم.pdf"
            className="inline-flex items-center gap-2 border border-border hover:bg-muted rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-foreground"
          >
            <Download className="w-4 h-4" />
            تحميل بروفايل الشركة
          </a>
          <a
            href="https://www.jsaas-valuation.com/ar"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-border hover:bg-muted rounded-lg px-4 py-2.5 text-sm font-medium transition-colors text-foreground"
          >
            الموقع الرسمي
          </a>
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-3">
          الرياض - حي الياسمين - طريق الثمامة | سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003 | ترخيص آلات ومعدات: 4114000015 | ترخيص عقار: 1210001217
        </p>
      </CardContent>
    </Card>
  );
}
