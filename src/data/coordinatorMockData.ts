// بيانات تجريبية واقعية لواجهة المنسق الإداري
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

export const MOCK_CLIENTS = [
  { id: "c1", name_ar: "أحمد المالكي", name_en: "Ahmed Al-Malki", phone: "0551234567", email: "ahmed.malki@gmail.com", client_type: "individual", city_ar: "الرياض", organization_id: "org1", is_active: true, created_at: daysAgo(90), updated_at: daysAgo(1) },
  { id: "c2", name_ar: "سارة الغامدي", name_en: "Sara Al-Ghamdi", phone: "0541239876", email: "sara.ghamdi@gmail.com", client_type: "individual", city_ar: "جدة", organization_id: "org1", is_active: true, created_at: daysAgo(120), updated_at: daysAgo(2) },
  { id: "c3", name_ar: "محمد الدوسري", name_en: "Mohammed Al-Dosari", phone: "0509876543", email: "m.dosari@outlook.sa", client_type: "individual", city_ar: "الدمام", organization_id: "org1", is_active: true, created_at: daysAgo(60), updated_at: daysAgo(3) },
  { id: "c4", name_ar: "فاطمة الشهري", name_en: "Fatima Al-Shahri", phone: "0538765432", email: "fatima.shahri@gmail.com", client_type: "individual", city_ar: "الرياض", organization_id: "org1", is_active: true, created_at: daysAgo(200), updated_at: daysAgo(0) },
  { id: "c5", name_ar: "عبدالله الحربي", name_en: "Abdullah Al-Harbi", phone: "0567891234", email: "a.harbi@gmail.com", client_type: "individual", city_ar: "الرياض", organization_id: "org1", is_active: true, created_at: daysAgo(30), updated_at: daysAgo(5) },
];

export const MOCK_REQUESTS: any[] = [
  // 1. قيد التنفيذ
  {
    id: "r1", reference_number: "VAL-001", client_id: "c1",
    property_type: "villa", purpose: "sale_purchase",
    property_city_ar: "الرياض", property_district_ar: "النرجس",
    land_area: 625, building_area: 480,
    property_description_ar: "فيلا درج صالة — 5 غرف نوم — تشطيب سوبر ديلوكس — حي النرجس",
    status: "in_production", priority: "normal",
    assigned_valuer_name: "م. خالد العتيبي",
    quotation_amount: 5500,
    created_at: daysAgo(3), updated_at: hoursAgo(4),
    notes: null,
  },
  // 2. مكتملة — تقرير جاهز
  {
    id: "r2", reference_number: "VAL-002", client_id: "c2",
    property_type: "commercial_building", purpose: "financing",
    property_city_ar: "جدة", property_district_ar: "الشاطئ",
    land_area: 1800, building_area: 5400,
    property_description_ar: "مجمع تجاري — 3 طوابق — 12 محل تجاري على شارع الأمير سلطان",
    status: "report_issued", priority: "normal",
    assigned_valuer_name: "م. فهد السبيعي",
    quotation_amount: 12000,
    created_at: daysAgo(2), updated_at: hoursAgo(8),
    notes: "إيصال الدفع مرفوع — بانتظار المراجعة والتأكيد",
  },
  // 3. معلق — بانتظار التعيين
  {
    id: "r3", reference_number: "VAL-003", client_id: "c3",
    property_type: "residential_land", purpose: "sale_purchase",
    property_city_ar: "الدمام", property_district_ar: null,
    land_area: null, building_area: null,
    property_description_ar: "أرض سكنية بصك إلكتروني — شارع 20م",
    status: "submitted", priority: "normal",
    assigned_valuer_name: null,
    quotation_amount: 3500,
    created_at: daysAgo(15), updated_at: daysAgo(1),
    notes: null,
  },
  // 4. قيد التنفيذ — أولوية عالية
  {
    id: "r4", reference_number: "VAL-004", client_id: "c4",
    property_type: "villa", purpose: "mortgage",
    property_city_ar: "الرياض", property_district_ar: "الياسمين",
    land_area: 500, building_area: 380,
    property_description_ar: "فيلا دوبلكس — 6 غرف — مسبح خاص — حي الياسمين",
    status: "in_production", priority: "high",
    assigned_valuer_name: "م. خالد العتيبي",
    quotation_amount: 6000,
    created_at: daysAgo(2), updated_at: hoursAgo(3),
    notes: "أولوية عالية — العميلة تحتاج التقرير للبنك خلال أسبوع",
  },
  // 5. تحتاج متابعة — بانتظار معلومات العميل
  {
    id: "r5", reference_number: "VAL-005", client_id: "c5",
    property_type: "warehouse", purpose: "insurance",
    property_city_ar: "الرياض", property_district_ar: "المدينة الصناعية الثانية",
    land_area: 3000, building_area: 2400,
    property_description_ar: "مستودع صناعي مع مكاتب إدارية — منطقة صناعية",
    status: "awaiting_client_info", priority: "normal",
    assigned_valuer_name: null,
    quotation_amount: 7000,
    created_at: daysAgo(6), updated_at: daysAgo(5),
    notes: "بانتظار صك الملكية ورخصة البناء من العميل",
  },
];
