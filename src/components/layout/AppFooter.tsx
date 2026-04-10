export default function AppFooter() {
  const year = new Date().getFullYear();

  const links = [
    { label: "تقييم العقارات", href: "#" },
    { label: "تقييم الآلات والمعدات", href: "#" },
    { label: "نزع الملكية والتعويضات", href: "#" },
    { label: "تواصل معنا", href: "mailto:care@jsaas-valuation.com" },
    { label: "من نحن", href: "https://www.jsaas-valuation.com/ar", external: true },
  ];

  const bottomLinks = [
    { label: "تسجيل الدخول", href: "/login" },
    { label: "إنشاء حساب", href: "/client/auth" },
    { label: "التحقق من تقرير", href: "/verify" },
  ];

  return (
    <footer className="border-t border-border mt-8" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col items-center gap-3">
        {/* Links row */}
        <div className="flex flex-wrap items-center justify-center gap-x-1 text-xs text-muted-foreground">
          {links.map((link, i) => (
            <span key={link.label} className="flex items-center">
              {i > 0 && <span className="mx-1.5 text-border">|</span>}
              <a
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            </span>
          ))}
        </div>

        {/* Bottom links */}
        <div className="flex flex-wrap items-center justify-center gap-x-1 text-[11px] text-muted-foreground/70">
          {bottomLinks.map((link, i) => (
            <span key={link.label} className="flex items-center">
              {i > 0 && <span className="mx-1.5 text-border">|</span>}
              <a href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
            </span>
          ))}
        </div>

        {/* Copyright */}
        <p className="text-[11px] text-muted-foreground/50">
          © {year} شركة جساس للتقييم — جميع الحقوق محفوظة
        </p>
      </div>
    </footer>
  );
}
