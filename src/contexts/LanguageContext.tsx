import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

export type Language = "ar" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: "rtl" | "ltr";
}

const translations: Record<string, Record<Language, string>> = {
  // TopBar & common
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  welcome: { ar: "مرحباً", en: "Welcome" },
  back: { ar: "رجوع", en: "Back" },
  logout: { ar: "تسجيل الخروج", en: "Sign Out" },
  settings: { ar: "الإعدادات", en: "Settings" },
  search: { ar: "بحث متقدم", en: "Advanced Search" },
  save: { ar: "حفظ", en: "Save" },
  cancel: { ar: "إلغاء", en: "Cancel" },
  delete: { ar: "حذف", en: "Delete" },
  edit: { ar: "تعديل", en: "Edit" },
  add: { ar: "إضافة", en: "Add" },
  confirm: { ar: "تأكيد", en: "Confirm" },
  close: { ar: "إغلاق", en: "Close" },
  loading: { ar: "جاري التحميل...", en: "Loading..." },
  noData: { ar: "لا توجد بيانات", en: "No data available" },
  actions: { ar: "إجراءات", en: "Actions" },
  status: { ar: "الحالة", en: "Status" },
  date: { ar: "التاريخ", en: "Date" },
  notes: { ar: "ملاحظات", en: "Notes" },
  details: { ar: "التفاصيل", en: "Details" },
  viewAll: { ar: "عرض الكل", en: "View All" },
  filter: { ar: "تصفية", en: "Filter" },
  export: { ar: "تصدير", en: "Export" },

  // Sidebar navigation
  raqeem: { ar: "رقيم", en: "Raqeem" },
  coordinatorPanel: { ar: "واجهة المنسق", en: "Coordinator Panel" },

  // Valuation section
  valuationSection: { ar: "التقييم", en: "Valuation" },
  valuations: { ar: "التقييمات", en: "Valuations" },
  reports: { ar: "التقارير", en: "Reports" },
  marketData: { ar: "بيانات السوق", en: "Market Data" },
  marketComparables: { ar: "المقارنات السوقية", en: "Market Comparables" },

  // Operations section
  operationsSection: { ar: "العمليات", en: "Operations" },
  clientRequests: { ar: "طلبات العملاء", en: "Client Requests" },
  inspections: { ar: "المعاينات", en: "Inspections" },
  clients: { ar: "العملاء", en: "Clients" },

  // AI section
  aiSection: { ar: "الذكاء", en: "AI" },
  smartTools: { ar: "الأدوات الذكية", en: "Smart Tools" },
  documentExtraction: { ar: "استخراج المستندات", en: "Document Extraction" },
  scopeAndPricing: { ar: "نطاق العمل والتسعير", en: "Scope & Pricing" },
  reportGeneration: { ar: "توليد التقرير", en: "Report Generation" },

  // Finance section
  financeSection: { ar: "المالية", en: "Finance" },
  cfoDashboard: { ar: "لوحة المدير المالي", en: "CFO Dashboard" },
  invoicesPayments: { ar: "الفواتير والمدفوعات", en: "Invoices & Payments" },

  // System section
  systemSection: { ar: "النظام", en: "System" },
  analytics: { ar: "التحليلات", en: "Analytics" },
  compliance: { ar: "الامتثال", en: "Compliance" },
  myProfile: { ar: "حسابي", en: "My Account" },

  // Quick actions
  quickActions: { ar: "إجراءات سريعة", en: "Quick Actions" },
  newValuation: { ar: "طلب تقييم جديد", en: "New Valuation Request" },
  allValuations: { ar: "جميع التقييمات", en: "All Valuations" },
  reviewQuality: { ar: "المراجعة والجودة", en: "Review & Quality" },
  advancedSearch: { ar: "بحث متقدم", en: "Advanced Search" },
  exportReports: { ar: "تصدير التقارير", en: "Export Reports" },
  clientManagement: { ar: "إدارة العملاء", en: "Client Management" },

  // Dashboard stats
  totalValuations: { ar: "إجمالي التقييمات", en: "Total Valuations" },
  inProgress: { ar: "قيد التنفيذ", en: "In Progress" },
  completedThisMonth: { ar: "مكتملة هذا الشهر", en: "Completed This Month" },
  complianceAlerts: { ar: "تنبيهات الامتثال", en: "Compliance Alerts" },
  activeClients: { ar: "العملاء النشطين", en: "Active Clients" },
  todayInspections: { ar: "المعاينات اليوم", en: "Today's Inspections" },
  monthlyRevenue: { ar: "الإيرادات الشهرية", en: "Monthly Revenue" },
  averageRating: { ar: "متوسط التقييم", en: "Average Rating" },
  recentAssignments: { ar: "آخر التكليفات", en: "Recent Assignments" },
  activityTimeline: { ar: "سجل النشاط", en: "Activity Timeline" },
  workflowPipeline: { ar: "خط سير العمل", en: "Workflow Pipeline" },
  sinceYearStart: { ar: "منذ بداية العام", en: "Since year start" },
  activeValuation: { ar: "تقييم نشط", en: "Active valuation" },
  approvedReport: { ar: "تقرير معتمد", en: "Approved report" },
  needsReview: { ar: "تحتاج مراجعة", en: "Needs review" },

  // Roles
  platformOwner: { ar: "مالك المنصة", en: "Platform Owner" },
  financialManager: { ar: "مدير مالي", en: "Financial Manager" },
  adminCoordinator: { ar: "منسق إداري", en: "Admin Coordinator" },
  inspector: { ar: "معاين", en: "Inspector" },
  client: { ar: "عميل", en: "Client" },

  // Settings page
  companyData: { ar: "بيانات الشركة", en: "Company Data" },
  valuerData: { ar: "بيانات المقيّم", en: "Valuer Data" },
  reportsSettings: { ar: "التقارير", en: "Reports" },
  system: { ar: "النظام", en: "System" },
  backupSecurity: { ar: "النسخ والأمان", en: "Backup & Security" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  settingsTitle: { ar: "الإعدادات", en: "Settings" },
  settingsDesc: { ar: "إدارة إعدادات المنصة والشركة والتقارير", en: "Manage platform, company, and report settings" },
  myProfileTitle: { ar: "حسابي", en: "My Account" },
  myProfileDesc: { ar: "تعديل بياناتك الشخصية وكلمة المرور", en: "Edit your personal information and password" },

  // Valuations list page
  valuationsList: { ar: "قائمة التقييمات", en: "Valuations List" },
  review: { ar: "المراجعة والجودة", en: "Review & Quality" },
  archive: { ar: "الأرشيف", en: "Archive" },

  // Common property / report terms
  property: { ar: "عقار", en: "Property" },
  machineryEquipment: { ar: "آلات ومعدات", en: "Machinery & Equipment" },
  saudiRiyal: { ar: "ريال سعودي", en: "Saudi Riyal" },

  // Platform name
  platformName: { ar: "منصة التقييم المهني", en: "Professional Valuation Platform" },

  // Login
  login: { ar: "تسجيل الدخول", en: "Sign In" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  password: { ar: "كلمة المرور", en: "Password" },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("app-language");
    return (stored === "en" ? "en" : "ar") as Language;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("app-language", lang);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("dir", language === "ar" ? "rtl" : "ltr");
    html.setAttribute("lang", language);
  }, [language]);

  const t = useCallback(
    (key: string): string => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[language] || entry.ar || key;
    },
    [language]
  );

  const dir = language === "ar" ? "rtl" : "ltr";

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
