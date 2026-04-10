import logo from "@/assets/logo-full.png";

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-muted/30 border-t border-border mt-8" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-5">
        {/* 3-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-muted-foreground">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start gap-2">
            <img src={logo} alt="جساس للتقييم" className="w-24 h-auto object-contain" />
            <p className="leading-relaxed">جساس للتقييم — نصنع للأصل قيمة</p>
          </div>

          {/* Services */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-2">خدماتنا</h4>
            <ul className="space-y-1">
              <li>تقييم العقارات</li>
              <li>تقييم الآلات والمعدات</li>
              <li>نزع الملكية والتعويضات</li>
            </ul>
          </div>

          {/* Contact */}
          <div className="text-center sm:text-right">
            <h4 className="text-sm font-semibold text-foreground mb-2">تواصل معنا</h4>
            <ul className="space-y-1">
              <li dir="ltr" className="sm:text-left">0500668089</li>
              <li>
                <a href="mailto:care@jsaas-valuation.com" className="hover:text-primary transition-colors">
                  care@jsaas-valuation.com
                </a>
              </li>
              <li>
                <a href="https://www.jsaas-valuation.com/ar" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
                  jsaas-valuation.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border mt-4 pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <p>© {year} شركة جساس للتقييم — جميع الحقوق محفوظة</p>
          <div className="flex items-center gap-4">
            <a href="/login" className="hover:text-primary transition-colors">تسجيل الدخول</a>
            <a href="/client/auth" className="hover:text-primary transition-colors">إنشاء حساب</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
