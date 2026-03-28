export type ReportLanguage = "ar" | "en" | "bilingual";

export interface ReportSection {
  id: string;
  key: string;
  title_ar: string;
  title_en: string;
  content_ar: string;
  content_en: string;
  order: number;
}

export interface ReportData {
  // Cover
  cover_title_ar: string;
  cover_title_en: string;
  reference_number: string;
  report_date: string;
  valuation_date: string;

  // Client
  client_name_ar: string;
  client_name_en: string;
  client_id_number: string;

  // Purpose
  purpose_ar: string;
  purpose_en: string;
  intended_use_ar: string;
  intended_use_en: string;
  intended_users_ar: string;
  intended_users_en: string;
  basis_of_value_ar: string;
  basis_of_value_en: string;

  // Scope
  scope_ar: string;
  scope_en: string;

  // Property
  property_description_ar: string;
  property_description_en: string;
  legal_description_ar: string;
  legal_description_en: string;
  property_address_ar: string;
  property_address_en: string;
  property_city_ar: string;
  property_city_en: string;
  land_area: string;
  building_area: string;
  property_type_ar: string;
  property_type_en: string;

  // Ownership
  ownership_ar: string;
  ownership_en: string;

  // Inspection
  inspection_date: string;
  inspection_notes_ar: string;
  inspection_notes_en: string;

  // Market
  market_overview_ar: string;
  market_overview_en: string;

  // HBU
  highest_best_use_ar: string;
  highest_best_use_en: string;

  // Valuation
  approaches_considered_ar: string;
  approaches_considered_en: string;
  calculations_ar: string;
  calculations_en: string;

  // Reconciliation
  reconciliation_ar: string;
  reconciliation_en: string;
  final_value: string;
  final_value_text_ar: string;
  final_value_text_en: string;
  currency: string;

  // Assumptions
  assumptions_ar: string;
  assumptions_en: string;
  special_assumptions_ar: string;
  special_assumptions_en: string;
  limiting_conditions_ar: string;
  limiting_conditions_en: string;

  // Compliance
  compliance_statement_ar: string;
  compliance_statement_en: string;

  // Signature
  signer_name_ar: string;
  signer_name_en: string;
  signer_title_ar: string;
  signer_title_en: string;
  signer_license: string;
}

export const REPORT_SECTIONS = [
  { key: "cover", title_ar: "صفحة الغلاف", title_en: "Cover Page", order: 1 },
  { key: "client", title_ar: "بيانات العميل", title_en: "Client Details", order: 2 },
  { key: "purpose", title_ar: "الغرض من التقييم", title_en: "Purpose of Valuation", order: 3 },
  { key: "intended_use", title_ar: "الاستخدام المقصود", title_en: "Intended Use", order: 4 },
  { key: "intended_users", title_ar: "المستخدمون المقصودون", title_en: "Intended Users", order: 5 },
  { key: "scope", title_ar: "نطاق العمل", title_en: "Scope of Work", order: 6 },
  { key: "property_id", title_ar: "تحديد العقار", title_en: "Property Identification", order: 7 },
  { key: "legal", title_ar: "الوصف القانوني", title_en: "Legal Description", order: 8 },
  { key: "ownership", title_ar: "الملكية / الحقوق", title_en: "Ownership / Rights", order: 9 },
  { key: "valuation_date", title_ar: "تاريخ التقييم", title_en: "Valuation Date", order: 10 },
  { key: "inspection", title_ar: "تفاصيل المعاينة", title_en: "Inspection Details", order: 11 },
  { key: "market", title_ar: "نظرة عامة على السوق", title_en: "Market Overview", order: 12 },
  { key: "property_desc", title_ar: "وصف العقار", title_en: "Property Description", order: 13 },
  { key: "hbu", title_ar: "الاستخدام الأعلى والأفضل", title_en: "Highest and Best Use", order: 14 },
  { key: "approaches", title_ar: "أساليب التقييم المستخدمة", title_en: "Valuation Approaches", order: 15 },
  { key: "calculations", title_ar: "الحسابات والتحليل", title_en: "Calculations & Analysis", order: 16 },
  { key: "reconciliation", title_ar: "التسوية والمطابقة", title_en: "Reconciliation", order: 17 },
  { key: "conclusion", title_ar: "الرأي النهائي في القيمة", title_en: "Final Opinion of Value", order: 18 },
  { key: "assumptions", title_ar: "الافتراضات والقيود", title_en: "Assumptions & Limiting Conditions", order: 19 },
  { key: "compliance", title_ar: "بيان الامتثال", title_en: "Compliance Statement", order: 20 },
  { key: "signature", title_ar: "التوقيع", title_en: "Signature Page", order: 21 },
  { key: "appendices", title_ar: "الملاحق والمرفقات", title_en: "Appendices & Attachments", order: 22 },
] as const;

export const VALUATION_TERMINOLOGY: Record<string, { ar: string; en: string }> = {
  market_value: { ar: "القيمة السوقية", en: "Market Value" },
  fair_value: { ar: "القيمة العادلة", en: "Fair Value" },
  investment_value: { ar: "القيمة الاستثمارية", en: "Investment Value" },
  equitable_value: { ar: "القيمة العادلة المنصفة", en: "Equitable Value" },
  liquidation_value: { ar: "قيمة التصفية", en: "Liquidation Value" },
  sales_comparison: { ar: "أسلوب المقارنة بالمبيعات", en: "Sales Comparison Approach" },
  income: { ar: "أسلوب الدخل", en: "Income Approach" },
  cost: { ar: "أسلوب التكلفة", en: "Cost Approach" },
  residual: { ar: "الأسلوب المتبقي", en: "Residual Approach" },
  dcf: { ar: "أسلوب التدفقات النقدية المخصومة", en: "Discounted Cash Flow" },
  residential: { ar: "سكني", en: "Residential" },
  commercial: { ar: "تجاري", en: "Commercial" },
  land: { ar: "أرض", en: "Land" },
  income_producing: { ar: "عقار مدر للدخل", en: "Income Producing" },
  development: { ar: "عقار تطويري", en: "Development" },
  mixed_use: { ar: "متعدد الاستخدامات", en: "Mixed Use" },
  industrial: { ar: "صناعي", en: "Industrial" },
};
