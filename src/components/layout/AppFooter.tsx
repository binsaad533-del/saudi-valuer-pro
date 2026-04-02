import { Mail, Phone, MapPin } from "lucide-react";
import logo from "@/assets/logo.png";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-card border-t border-border mt-8" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Top section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-3">
            <img src={logo} alt="جساس" className="w-16 h-auto object-contain" />
            <p className="text-xs text-muted-foreground text-center sm:text-right leading-relaxed">
              جساس للتقييم — نصنع للأصل قيمة
            </p>
          </div>

          {/* Quick links */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-3">روابط سريعة</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><a href="/login" className="hover:text-primary transition-colors">تسجيل الدخول</a></li>
              <li><a href="/client/register" className="hover:text-primary transition-colors">إنشاء حساب</a></li>
              <li><a href="/verify" className="hover:text-primary transition-colors">التحقق من تقرير</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-3">تواصل معنا</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <Phone className="w-3 h-3 shrink-0" />
                <span dir="ltr">+966 55 000 0000</span>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <Mail className="w-3 h-3 shrink-0" />
                <span>info@jassas.sa</span>
              </li>
              <li className="flex items-center justify-center sm:justify-start gap-2">
                <MapPin className="w-3 h-3 shrink-0" />
                <span>المملكة العربية السعودية</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-border pt-4 text-center">
          <p className="text-[11px] text-muted-foreground">
            © {year} جساس للتقييم - جميع الحقوق محفوظة
          </p>
        </div>
      </div>
    </footer>
  );
}
