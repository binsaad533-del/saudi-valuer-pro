// بيانات تجريبية واقعية لواجهة المنسق الإداري
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

export const MOCK_CLIENTS = [
  { id: "c1", name_ar: "أحمد المالكي", name_en: "Ahmed Al-Malki", phone: "0551234567", email: "ahmed.malki@gmail.com", client_type: "individual", city_ar: "الرياض", organization_id: "org1", is_active: true, created_at: daysAgo(90), updated_at: daysAgo(1) },
  { id: "c2", name_ar: "سارة الغامدي", name_en: "Sara Al-Ghamdi", phone: "0541239876", email: "sara.ghamdi@gmail.com", client_type: "individual", city_ar: "جدة", organization_id: "org1", is_active: true, created_at: daysAgo(120), updated_at: daysAgo(2) },
  { id: "c3", name_ar: "فاطمة الزهراني", name_en: "Fatima Al-Zahrani", phone: "0509876543", email: "fatima.z@outlook.sa", client_type: "individual", city_ar: "الدمام", organization_id: "org1", is_active: true, created_at: daysAgo(60), updated_at: daysAgo(3) },
  { id: "c4", name_ar: "بنك الإنماء", name_en: "Alinma Bank", phone: "0118001234", email: "valuation@alinma.com", client_type: "corporate", city_ar: "الرياض", organization_id: "org1", is_active: true, created_at: daysAgo(200), updated_at: daysAgo(0) },
  { id: "c5", name_ar: "عبدالله الشمري", name_en: "Abdullah Al-Shammari", phone: "0567891234", email: "a.shammari@gmail.com", client_type: "individual", city_ar: "مكة المكرمة", organization_id: "org1", is_active: true, created_at: daysAgo(30), updated_at: daysAgo(5) },
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
  // 3. مكتمل
  {
    id: "r3", reference_number: "VAL-003", client_id: "c3",
    property_type: "apartment", purpose: "mortgage",
    property_city_ar: "الدمام", property_district_ar: "الفيصلية",
    land_area: null, building_area: 165,
    property_description_ar: "شقة تمليك — الدور الرابع — 3 غرف وصالة — قريبة من الخدمات",
    status: "completed", priority: "normal",
    assigned_valuer_name: "م. سارة الحربي",
    quotation_amount: 3500,
    created_at: daysAgo(15), updated_at: daysAgo(1),
    notes: null,
  },
  // 4. بانتظار معلومات العميل (بيانات ناقصة)
  {
    id: "r4", reference_number: "VAL-004", client_id: "c4",
    property_type: "commercial_land", purpose: "financing",
    property_city_ar: null, property_district_ar: null,
    land_area: null, building_area: null,
    property_description_ar: null,
    status: "awaiting_client_info", priority: "urgent",
    assigned_valuer_name: null,
    quotation_amount: 8000,
    created_at: daysAgo(5), updated_at: daysAgo(4),
    notes: "العميل لم يرسل صك الملكية ولم يحدد الموقع — طلب عاجل من البنك",
  },
  // 5. معاينة ميدانية جارية
  {
    id: "r5", reference_number: "VAL-005", client_id: "c5",
    property_type: "residential_land", purpose: "sale_purchase",
    property_city_ar: "مكة المكرمة", property_district_ar: "العزيزية",
    land_area: 900, building_area: null,
    property_description_ar: "أرض سكنية بصك إلكتروني — شارعين — منطقة العزيزية",
    status: "inspection_in_progress", priority: "normal",
    assigned_valuer_name: "م. عمر القحطاني",
    quotation_amount: 4000,
    created_at: daysAgo(4), updated_at: hoursAgo(2),
    notes: "المعاين في الموقع حالياً",
  },
];
