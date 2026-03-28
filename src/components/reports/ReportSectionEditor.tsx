import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { REPORT_SECTIONS, type ReportLanguage, type ReportData } from "@/lib/report-types";

interface Props {
  data: ReportData;
  language: ReportLanguage;
  onChange: (updates: Partial<ReportData>) => void;
}

const SECTION_FIELD_MAP: Record<string, { ar: (keyof ReportData)[]; en: (keyof ReportData)[] }> = {
  cover: { ar: ["cover_title_ar"], en: ["cover_title_en"] },
  client: { ar: ["client_name_ar"], en: ["client_name_en"] },
  purpose: { ar: ["purpose_ar", "basis_of_value_ar"], en: ["purpose_en", "basis_of_value_en"] },
  intended_use: { ar: ["intended_use_ar"], en: ["intended_use_en"] },
  intended_users: { ar: ["intended_users_ar"], en: ["intended_users_en"] },
  scope: { ar: ["scope_ar"], en: ["scope_en"] },
  property_id: { ar: ["property_description_ar", "property_address_ar"], en: ["property_description_en", "property_address_en"] },
  legal: { ar: ["legal_description_ar"], en: ["legal_description_en"] },
  ownership: { ar: ["ownership_ar"], en: ["ownership_en"] },
  inspection: { ar: ["inspection_notes_ar"], en: ["inspection_notes_en"] },
  market: { ar: ["market_overview_ar"], en: ["market_overview_en"] },
  property_desc: { ar: ["property_description_ar"], en: ["property_description_en"] },
  hbu: { ar: ["highest_best_use_ar"], en: ["highest_best_use_en"] },
  approaches: { ar: ["approaches_considered_ar"], en: ["approaches_considered_en"] },
  calculations: { ar: ["calculations_ar"], en: ["calculations_en"] },
  reconciliation: { ar: ["reconciliation_ar", "final_value_text_ar"], en: ["reconciliation_en", "final_value_text_en"] },
  conclusion: { ar: ["final_value_text_ar"], en: ["final_value_text_en"] },
  assumptions: { ar: ["assumptions_ar", "special_assumptions_ar", "limiting_conditions_ar"], en: ["assumptions_en", "special_assumptions_en", "limiting_conditions_en"] },
  compliance: { ar: ["compliance_statement_ar"], en: ["compliance_statement_en"] },
};

const FIELD_LABELS: Record<string, { ar: string; en: string }> = {
  cover_title_ar: { ar: "عنوان الغلاف", en: "Cover Title" },
  cover_title_en: { ar: "عنوان الغلاف (EN)", en: "Cover Title (EN)" },
  client_name_ar: { ar: "اسم العميل", en: "Client Name" },
  client_name_en: { ar: "اسم العميل (EN)", en: "Client Name (EN)" },
  purpose_ar: { ar: "الغرض", en: "Purpose" },
  purpose_en: { ar: "الغرض (EN)", en: "Purpose (EN)" },
  basis_of_value_ar: { ar: "أساس القيمة", en: "Basis of Value" },
  basis_of_value_en: { ar: "أساس القيمة (EN)", en: "Basis of Value (EN)" },
  intended_use_ar: { ar: "الاستخدام المقصود", en: "Intended Use" },
  intended_use_en: { ar: "الاستخدام المقصود (EN)", en: "Intended Use (EN)" },
  intended_users_ar: { ar: "المستخدمون المقصودون", en: "Intended Users" },
  intended_users_en: { ar: "المستخدمون المقصودون (EN)", en: "Intended Users (EN)" },
  scope_ar: { ar: "نطاق العمل", en: "Scope of Work" },
  scope_en: { ar: "نطاق العمل (EN)", en: "Scope of Work (EN)" },
  property_description_ar: { ar: "وصف العقار", en: "Property Description" },
  property_description_en: { ar: "وصف العقار (EN)", en: "Property Description (EN)" },
  property_address_ar: { ar: "العنوان", en: "Address" },
  property_address_en: { ar: "العنوان (EN)", en: "Address (EN)" },
  legal_description_ar: { ar: "الوصف القانوني", en: "Legal Description" },
  legal_description_en: { ar: "الوصف القانوني (EN)", en: "Legal Description (EN)" },
  ownership_ar: { ar: "الملكية", en: "Ownership" },
  ownership_en: { ar: "الملكية (EN)", en: "Ownership (EN)" },
  inspection_notes_ar: { ar: "ملاحظات المعاينة", en: "Inspection Notes" },
  inspection_notes_en: { ar: "ملاحظات المعاينة (EN)", en: "Inspection Notes (EN)" },
  market_overview_ar: { ar: "نظرة على السوق", en: "Market Overview" },
  market_overview_en: { ar: "نظرة على السوق (EN)", en: "Market Overview (EN)" },
  highest_best_use_ar: { ar: "الاستخدام الأعلى والأفضل", en: "Highest and Best Use" },
  highest_best_use_en: { ar: "الاستخدام الأعلى والأفضل (EN)", en: "Highest and Best Use (EN)" },
  approaches_considered_ar: { ar: "الأساليب المستخدمة", en: "Approaches Considered" },
  approaches_considered_en: { ar: "الأساليب المستخدمة (EN)", en: "Approaches Considered (EN)" },
  calculations_ar: { ar: "الحسابات", en: "Calculations" },
  calculations_en: { ar: "الحسابات (EN)", en: "Calculations (EN)" },
  reconciliation_ar: { ar: "التسوية", en: "Reconciliation" },
  reconciliation_en: { ar: "التسوية (EN)", en: "Reconciliation (EN)" },
  final_value_text_ar: { ar: "القيمة كتابة", en: "Value in Words" },
  final_value_text_en: { ar: "القيمة كتابة (EN)", en: "Value in Words (EN)" },
  assumptions_ar: { ar: "الافتراضات", en: "Assumptions" },
  assumptions_en: { ar: "الافتراضات (EN)", en: "Assumptions (EN)" },
  special_assumptions_ar: { ar: "الافتراضات الخاصة", en: "Special Assumptions" },
  special_assumptions_en: { ar: "الافتراضات الخاصة (EN)", en: "Special Assumptions (EN)" },
  limiting_conditions_ar: { ar: "القيود والمحددات", en: "Limiting Conditions" },
  limiting_conditions_en: { ar: "القيود والمحددات (EN)", en: "Limiting Conditions (EN)" },
  compliance_statement_ar: { ar: "بيان الامتثال", en: "Compliance Statement" },
  compliance_statement_en: { ar: "بيان الامتثال (EN)", en: "Compliance Statement (EN)" },
};

export default function ReportSectionEditor({ data, language, onChange }: Props) {
  const sections = REPORT_SECTIONS.filter((s) => SECTION_FIELD_MAP[s.key]);

  return (
    <div className="space-y-4">
      {sections.map((section) => {
        const map = SECTION_FIELD_MAP[section.key];
        if (!map) return null;

        const showAr = language === "ar" || language === "bilingual";
        const showEn = language === "en" || language === "bilingual";
        const fields = [
          ...(showAr ? map.ar : []),
          ...(showEn ? map.en : []),
        ];

        // Remove duplicates
        const uniqueFields = [...new Set(fields)];

        return (
          <Card key={section.key}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{section.order}</Badge>
                {language === "bilingual" ? `${section.title_ar} / ${section.title_en}` : language === "ar" ? section.title_ar : section.title_en}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {language === "bilingual" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    {map.ar.map((field) => (
                      <div key={field}>
                        <Label className="text-xs text-muted-foreground">
                          {FIELD_LABELS[field]?.ar || field}
                        </Label>
                        <Textarea
                          value={String(data[field] || "")}
                          onChange={(e) => onChange({ [field]: e.target.value })}
                          className="mt-1 text-sm min-h-[80px]"
                          dir="rtl"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3" dir="ltr">
                    {map.en.map((field) => (
                      <div key={field}>
                        <Label className="text-xs text-muted-foreground">
                          {FIELD_LABELS[field]?.en || field}
                        </Label>
                        <Textarea
                          value={String(data[field] || "")}
                          onChange={(e) => onChange({ [field]: e.target.value })}
                          className="mt-1 text-sm min-h-[80px]"
                          dir="ltr"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {uniqueFields.map((field) => {
                    const isEn = field.endsWith("_en");
                    return (
                      <div key={field}>
                        <Label className="text-xs text-muted-foreground">
                          {FIELD_LABELS[field]?.[language] || field}
                        </Label>
                        <Textarea
                          value={String(data[field] || "")}
                          onChange={(e) => onChange({ [field]: e.target.value })}
                          className="mt-1 text-sm min-h-[80px]"
                          dir={isEn ? "ltr" : "rtl"}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
