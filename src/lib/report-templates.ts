/**
 * Report Templates Engine
 * قوالب تقارير مخصصة حسب نوع الأصل
 */

export type TemplateType = 'residential' | 'commercial' | 'land' | 'machinery' | 'portfolio';

export interface TemplateSection {
  id: string;
  titleAr: string;
  titleEn: string;
  required: boolean;
  order: number;
}

export interface ReportTemplate {
  type: TemplateType;
  nameAr: string;
  nameEn: string;
  icon: string;
  color: string;
  sections: TemplateSection[];
  requiredApproaches: string[];
  minComparables: number;
  specialFields: string[];
}

const baseSections: TemplateSection[] = [
  { id: 'cover', titleAr: 'الغلاف', titleEn: 'Cover Page', required: true, order: 1 },
  { id: 'toc', titleAr: 'جدول المحتويات', titleEn: 'Table of Contents', required: true, order: 2 },
  { id: 'executive_summary', titleAr: 'الملخص التنفيذي', titleEn: 'Executive Summary', required: true, order: 3 },
  { id: 'engagement', titleAr: 'شروط التكليف', titleEn: 'Terms of Engagement', required: true, order: 4 },
  { id: 'property_description', titleAr: 'وصف العقار', titleEn: 'Property Description', required: true, order: 5 },
  { id: 'legal_description', titleAr: 'الوصف القانوني', titleEn: 'Legal Description', required: true, order: 6 },
  { id: 'inspection', titleAr: 'المعاينة الميدانية', titleEn: 'Field Inspection', required: true, order: 7 },
  { id: 'market_analysis', titleAr: 'تحليل السوق', titleEn: 'Market Analysis', required: true, order: 8 },
  { id: 'hbu', titleAr: 'الاستخدام الأعلى والأفضل', titleEn: 'Highest & Best Use', required: true, order: 9 },
];

const valuationSections: TemplateSection[] = [
  { id: 'methodology', titleAr: 'منهجية التقييم', titleEn: 'Valuation Methodology', required: true, order: 10 },
  { id: 'comparables', titleAr: 'المقارنات السوقية', titleEn: 'Market Comparables', required: true, order: 11 },
  { id: 'adjustments', titleAr: 'التعديلات', titleEn: 'Adjustments', required: true, order: 12 },
  { id: 'reconciliation', titleAr: 'الترجيح والنتيجة', titleEn: 'Reconciliation', required: true, order: 13 },
  { id: 'assumptions', titleAr: 'الافتراضات والشروط المقيدة', titleEn: 'Assumptions & Limiting Conditions', required: true, order: 14 },
  { id: 'conclusion', titleAr: 'الخلاصة والقيمة النهائية', titleEn: 'Conclusion & Final Value', required: true, order: 15 },
  { id: 'photos', titleAr: 'معرض الصور', titleEn: 'Photo Gallery', required: true, order: 16 },
  { id: 'maps', titleAr: 'الخرائط', titleEn: 'Maps & Location', required: true, order: 17 },
  { id: 'signature', titleAr: 'التوقيع والاعتماد', titleEn: 'Certification & Signature', required: true, order: 18 },
  { id: 'glossary', titleAr: 'المصطلحات', titleEn: 'Glossary', required: false, order: 19 },
  { id: 'appendices', titleAr: 'الملاحق', titleEn: 'Appendices', required: false, order: 20 },
];

export const REPORT_TEMPLATES: Record<TemplateType, ReportTemplate> = {
  residential: {
    type: 'residential',
    nameAr: 'تقرير سكني',
    nameEn: 'Residential Report',
    icon: '🏠',
    color: 'hsl(212, 60%, 50%)',
    sections: [
      ...baseSections,
      { id: 'building_specs', titleAr: 'مواصفات البناء', titleEn: 'Building Specifications', required: true, order: 9.5 },
      ...valuationSections,
    ],
    requiredApproaches: ['market_comparison'],
    minComparables: 3,
    specialFields: ['bedrooms', 'bathrooms', 'floors', 'parking', 'garden', 'pool'],
  },
  commercial: {
    type: 'commercial',
    nameAr: 'تقرير تجاري',
    nameEn: 'Commercial Report',
    icon: '🏢',
    color: 'hsl(38, 90%, 50%)',
    sections: [
      ...baseSections,
      { id: 'tenant_schedule', titleAr: 'جدول المستأجرين', titleEn: 'Tenant Schedule', required: true, order: 9.2 },
      { id: 'income_analysis', titleAr: 'تحليل الدخل', titleEn: 'Income Analysis', required: true, order: 9.4 },
      { id: 'dcf', titleAr: 'التدفقات النقدية المخصومة', titleEn: 'DCF Analysis', required: false, order: 9.6 },
      { id: 'capex', titleAr: 'المصروفات الرأسمالية', titleEn: 'Capital Expenditures', required: false, order: 9.8 },
      ...valuationSections,
    ],
    requiredApproaches: ['income', 'market_comparison'],
    minComparables: 3,
    specialFields: ['rental_income', 'occupancy_rate', 'cap_rate', 'noi', 'lease_terms'],
  },
  land: {
    type: 'land',
    nameAr: 'تقرير أراضي',
    nameEn: 'Land Report',
    icon: '🏗️',
    color: 'hsl(152, 55%, 44%)',
    sections: [
      ...baseSections,
      { id: 'zoning', titleAr: 'الاشتراطات التنظيمية', titleEn: 'Zoning & Regulations', required: true, order: 9.3 },
      { id: 'development_potential', titleAr: 'إمكانات التطوير', titleEn: 'Development Potential', required: true, order: 9.6 },
      ...valuationSections,
    ],
    requiredApproaches: ['market_comparison'],
    minComparables: 5,
    specialFields: ['zoning_class', 'far', 'setbacks', 'utilities_available', 'topography'],
  },
  machinery: {
    type: 'machinery',
    nameAr: 'تقرير آلات ومعدات',
    nameEn: 'Machinery & Equipment Report',
    icon: '⚙️',
    color: 'hsl(280, 50%, 50%)',
    sections: [
      { id: 'cover', titleAr: 'الغلاف', titleEn: 'Cover Page', required: true, order: 1 },
      { id: 'toc', titleAr: 'جدول المحتويات', titleEn: 'Table of Contents', required: true, order: 2 },
      { id: 'executive_summary', titleAr: 'الملخص التنفيذي', titleEn: 'Executive Summary', required: true, order: 3 },
      { id: 'engagement', titleAr: 'شروط التكليف', titleEn: 'Terms of Engagement', required: true, order: 4 },
      { id: 'asset_inventory', titleAr: 'جرد الأصول', titleEn: 'Asset Inventory', required: true, order: 5 },
      { id: 'depreciation', titleAr: 'جداول الإهلاك', titleEn: 'Depreciation Schedules', required: true, order: 6 },
      { id: 'condition_assessment', titleAr: 'تقييم الحالة', titleEn: 'Condition Assessment', required: true, order: 7 },
      { id: 'methodology', titleAr: 'منهجية التقييم', titleEn: 'Valuation Methodology', required: true, order: 8 },
      { id: 'cost_approach', titleAr: 'أسلوب التكلفة', titleEn: 'Cost Approach', required: true, order: 9 },
      { id: 'conclusion', titleAr: 'الخلاصة والقيمة النهائية', titleEn: 'Conclusion & Final Value', required: true, order: 10 },
      { id: 'photos', titleAr: 'معرض الصور', titleEn: 'Photo Gallery', required: true, order: 11 },
      { id: 'signature', titleAr: 'التوقيع والاعتماد', titleEn: 'Certification & Signature', required: true, order: 12 },
    ],
    requiredApproaches: ['cost'],
    minComparables: 0,
    specialFields: ['manufacturer', 'model', 'serial_number', 'year_manufactured', 'useful_life', 'remaining_life'],
  },
  portfolio: {
    type: 'portfolio',
    nameAr: 'تقرير محفظة',
    nameEn: 'Portfolio Report',
    icon: '📊',
    color: 'hsl(0, 72%, 51%)',
    sections: [
      { id: 'cover', titleAr: 'الغلاف', titleEn: 'Cover Page', required: true, order: 1 },
      { id: 'toc', titleAr: 'جدول المحتويات', titleEn: 'Table of Contents', required: true, order: 2 },
      { id: 'executive_summary', titleAr: 'الملخص التنفيذي', titleEn: 'Executive Summary', required: true, order: 3 },
      { id: 'portfolio_overview', titleAr: 'نظرة عامة على المحفظة', titleEn: 'Portfolio Overview', required: true, order: 4 },
      { id: 'asset_summaries', titleAr: 'ملخصات الأصول', titleEn: 'Asset Summaries', required: true, order: 5 },
      { id: 'aggregate_value', titleAr: 'القيمة الإجمالية', titleEn: 'Aggregate Value', required: true, order: 6 },
      { id: 'risk_analysis', titleAr: 'تحليل المخاطر', titleEn: 'Risk Analysis', required: true, order: 7 },
      { id: 'assumptions', titleAr: 'الافتراضات', titleEn: 'Assumptions', required: true, order: 8 },
      { id: 'conclusion', titleAr: 'الخلاصة', titleEn: 'Conclusion', required: true, order: 9 },
      { id: 'individual_reports', titleAr: 'التقارير الفردية', titleEn: 'Individual Reports', required: true, order: 10 },
      { id: 'signature', titleAr: 'التوقيع والاعتماد', titleEn: 'Certification', required: true, order: 11 },
    ],
    requiredApproaches: ['market_comparison'],
    minComparables: 3,
    specialFields: ['total_assets', 'total_value', 'asset_distribution'],
  },
};

export function getTemplateByAssetType(assetType: string): ReportTemplate {
  const mapping: Record<string, TemplateType> = {
    residential: 'residential',
    villa: 'residential',
    apartment: 'residential',
    commercial: 'commercial',
    office: 'commercial',
    retail: 'commercial',
    land: 'land',
    vacant_land: 'land',
    machinery: 'machinery',
    equipment: 'machinery',
    industrial: 'machinery',
    portfolio: 'portfolio',
    mixed: 'portfolio',
  };
  return REPORT_TEMPLATES[mapping[assetType] || 'residential'];
}

export function getTemplateSectionCount(type: TemplateType): number {
  return REPORT_TEMPLATES[type].sections.filter(s => s.required).length;
}
