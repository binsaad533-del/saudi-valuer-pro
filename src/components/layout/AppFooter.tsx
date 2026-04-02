import { Mail, Phone, MapPin, Globe, Shield, Award } from "lucide-react";
import logo from "@/assets/logo-full.png";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border mt-8" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Top section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <img src={logo} alt="جساس" className="w-16 h-auto object-contain" />
            <p className="text-xs text-muted-foreground text-center sm:text-right leading-relaxed">
              جساس للتقييم — نصنع للأصل قيمة
            </p>
            <p className="text-[11px] text-muted-foreground/70 text-center sm:text-right">
              نقيّم الأصول بعِلم وفنْ
            </p>
          </div>

          {/* Services */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-3">خدماتنا</h4>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>تقييم العقارات</li>
              <li>تقييم الآلات والمعدات</li>
              <li>نزع الملكية والتعويضات</li>
            </ul>
          </div>

          {/* Credentials */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-3">التراخيص والاعتمادات</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center justify-center sm:justify-start gap-1.5">
                <Shield className="w-3 h-3 shrink-0 text-primary" />
                <span>سجل تجاري: 1010625839</span>
              </li>
              {/* عقار */}
              <li className="flex items-center justify-center sm:justify-start gap-1.5">
                <Award className="w-3 h-3 shrink-0 text-primary" />
                <span>عقار — ترخيص وعضوية: 1210001217</span>
              </li>
              {/* آلات ومعدات */}
              <li className="flex items-center justify-center sm:justify-start gap-1.5">
                <Award className="w-3 h-3 shrink-0 text-primary" />
                <span>آلات ومعدات — ترخيص: 4114000015</span>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-1.5">
                <Award className="w-3 h-3 shrink-0 text-primary" />
                <span>آلات ومعدات — عضوية: 4210000041</span>
              </li>
              <li className="text-[11px] text-muted-foreground/70 mt-1">
                حاصل على الزمالة | TAQEEM | IVS | ASA
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-3">تواصل معنا</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <Phone className="w-3 h-3 shrink-0" />
                <span dir="ltr">0500668089</span>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <Mail className="w-3 h-3 shrink-0" />
                <a href="mailto:care@jsaas-valuation.com" className="hover:text-primary transition-colors">
                  care@jsaas-valuation.com
                </a>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <Globe className="w-3 h-3 shrink-0" />
                <a href="https://www.jsaas-valuation.com/ar" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  jsaas-valuation.com
                </a>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>الرياض - حي الياسمين - طريق الثمامة</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Achievement bar */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground text-sm">+111,641</strong> أصل تم تقييمه
          </span>
          <span className="hidden sm:inline text-border">|</span>
          <span>
            <strong className="text-foreground text-sm">+1.185</strong> مليار ريال إجمالي قيم الأصول
          </span>
          <span className="hidden sm:inline text-border">|</span>
          <span>
            شركة ذات مسؤولية محدودة (مهنية)
          </span>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-border pt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            © {year} شركة جساس للتقييم - جميع الحقوق محفوظة
          </p>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <a href="/verify" className="hover:text-primary transition-colors">التحقق من تقرير</a>
            <a href="/login" className="hover:text-primary transition-colors">تسجيل الدخول</a>
            <a href="/client/register" className="hover:text-primary transition-colors">إنشاء حساب</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
