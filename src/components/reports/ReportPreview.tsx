import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ReportLanguage, ReportData } from "@/lib/report-types";
import { REPORT_SECTIONS } from "@/lib/report-types";

interface Props {
  data: ReportData;
  language: ReportLanguage;
}

function BilingualField({ label_ar, label_en, value_ar, value_en, language }: {
  label_ar: string; label_en: string; value_ar: string; value_en: string; language: ReportLanguage;
}) {
  if (language === "bilingual") {
    return (
      <div className="grid grid-cols-2 gap-6 py-3">
        <div className="text-right">
          <p className="text-xs font-semibold text-primary mb-1">{label_ar}</p>
          <p className="text-sm text-foreground leading-relaxed">{value_ar || "—"}</p>
        </div>
        <div className="text-left" dir="ltr">
          <p className="text-xs font-semibold text-primary mb-1">{label_en}</p>
          <p className="text-sm text-foreground leading-relaxed">{value_en || "—"}</p>
        </div>
      </div>
    );
  }

  const label = language === "ar" ? label_ar : label_en;
  const value = language === "ar" ? value_ar : value_en;

  return (
    <div className={`py-3 ${language === "en" ? "text-left" : "text-right"}`} dir={language === "en" ? "ltr" : "rtl"}>
      <p className="text-xs font-semibold text-primary mb-1">{label}</p>
      <p className="text-sm text-foreground leading-relaxed">{value || "—"}</p>
    </div>
  );
}

export default function ReportPreview({ data, language }: Props) {
  return (
    <div className="space-y-4">
      {/* Cover Page */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-bl from-primary/5 to-primary/10 p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-xl">J</span>
          </div>
          {language === "bilingual" ? (
            <>
              <h2 className="text-2xl font-bold text-foreground">{data.cover_title_ar}</h2>
              <h3 className="text-xl font-semibold text-muted-foreground" dir="ltr">{data.cover_title_en}</h3>
            </>
          ) : (
            <h2 className="text-2xl font-bold text-foreground" dir={language === "en" ? "ltr" : "rtl"}>
              {language === "ar" ? data.cover_title_ar : data.cover_title_en}
            </h2>
          )}
          <div className="text-sm text-muted-foreground space-y-1">
            <p>{language === "ar" ? "رقم المرجع" : language === "en" ? "Reference No." : "رقم المرجع / Reference No."}: {data.reference_number}</p>
            <p>{language === "ar" ? "تاريخ التقرير" : language === "en" ? "Report Date" : "تاريخ التقرير / Report Date"}: {data.report_date}</p>
            <p>{language === "ar" ? "تاريخ التقييم" : language === "en" ? "Valuation Date" : "تاريخ التقييم / Valuation Date"}: {data.valuation_date}</p>
          </div>
        </div>
      </Card>

      {/* Table of Contents */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-bold text-foreground mb-4">
            {language === "bilingual" ? "فهرس المحتويات / Table of Contents" : language === "ar" ? "فهرس المحتويات" : "Table of Contents"}
          </h3>
          <div className="space-y-2">
            {REPORT_SECTIONS.map((sec) => (
              <div key={sec.key} className="flex items-center justify-between text-sm py-1 border-b border-dashed border-border last:border-0">
                <span className="text-muted-foreground">{sec.order}</span>
                {language === "bilingual" ? (
                  <div className="flex items-center gap-4">
                    <span className="text-foreground">{sec.title_ar}</span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-foreground" dir="ltr">{sec.title_en}</span>
                  </div>
                ) : (
                  <span className="text-foreground">{language === "ar" ? sec.title_ar : sec.title_en}</span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Client Details */}
      <SectionCard title_ar="بيانات العميل" title_en="Client Details" order={2} language={language}>
        <BilingualField label_ar="اسم العميل" label_en="Client Name" value_ar={data.client_name_ar} value_en={data.client_name_en} language={language} />
        <BilingualField label_ar="رقم الهوية / السجل" label_en="ID / CR Number" value_ar={data.client_id_number} value_en={data.client_id_number} language={language} />
      </SectionCard>

      {/* Purpose & Basis */}
      <SectionCard title_ar="الغرض من التقييم" title_en="Purpose of Valuation" order={3} language={language}>
        <BilingualField label_ar="الغرض" label_en="Purpose" value_ar={data.purpose_ar} value_en={data.purpose_en} language={language} />
        <BilingualField label_ar="الاستخدام المقصود" label_en="Intended Use" value_ar={data.intended_use_ar} value_en={data.intended_use_en} language={language} />
        <BilingualField label_ar="المستخدمون المقصودون" label_en="Intended Users" value_ar={data.intended_users_ar} value_en={data.intended_users_en} language={language} />
        <BilingualField label_ar="أساس القيمة" label_en="Basis of Value" value_ar={data.basis_of_value_ar} value_en={data.basis_of_value_en} language={language} />
      </SectionCard>

      {/* Scope */}
      <SectionCard title_ar="نطاق العمل" title_en="Scope of Work" order={6} language={language}>
        <BilingualField label_ar="نطاق العمل" label_en="Scope of Work" value_ar={data.scope_ar} value_en={data.scope_en} language={language} />
      </SectionCard>

      {/* Property */}
      <SectionCard title_ar="تحديد العقار" title_en="Property Identification" order={7} language={language}>
        <BilingualField label_ar="نوع العقار" label_en="Property Type" value_ar={data.property_type_ar} value_en={data.property_type_en} language={language} />
        <BilingualField label_ar="العنوان" label_en="Address" value_ar={data.property_address_ar} value_en={data.property_address_en} language={language} />
        <BilingualField label_ar="المدينة" label_en="City" value_ar={data.property_city_ar} value_en={data.property_city_en} language={language} />
        <BilingualField label_ar="مساحة الأرض (م²)" label_en="Land Area (sqm)" value_ar={data.land_area} value_en={data.land_area} language={language} />
        <BilingualField label_ar="المساحة المبنية (م²)" label_en="Built-Up Area (sqm)" value_ar={data.building_area} value_en={data.building_area} language={language} />
        <BilingualField label_ar="الوصف القانوني" label_en="Legal Description" value_ar={data.legal_description_ar} value_en={data.legal_description_en} language={language} />
        <BilingualField label_ar="وصف العقار" label_en="Property Description" value_ar={data.property_description_ar} value_en={data.property_description_en} language={language} />
      </SectionCard>

      {/* Ownership */}
      <SectionCard title_ar="الملكية / الحقوق" title_en="Ownership / Rights" order={9} language={language}>
        <BilingualField label_ar="نوع الملكية" label_en="Ownership Type" value_ar={data.ownership_ar} value_en={data.ownership_en} language={language} />
      </SectionCard>

      {/* Inspection */}
      <SectionCard title_ar="تفاصيل المعاينة" title_en="Inspection Details" order={11} language={language}>
        <BilingualField label_ar="تاريخ المعاينة" label_en="Inspection Date" value_ar={data.inspection_date} value_en={data.inspection_date} language={language} />
        <BilingualField label_ar="ملاحظات المعاينة" label_en="Inspection Notes" value_ar={data.inspection_notes_ar} value_en={data.inspection_notes_en} language={language} />
      </SectionCard>

      {/* Market Overview */}
      <SectionCard title_ar="نظرة عامة على السوق" title_en="Market Overview" order={12} language={language}>
        <BilingualField label_ar="نظرة عامة" label_en="Overview" value_ar={data.market_overview_ar} value_en={data.market_overview_en} language={language} />
      </SectionCard>

      {/* HBU */}
      <SectionCard title_ar="الاستخدام الأعلى والأفضل" title_en="Highest and Best Use" order={14} language={language}>
        <BilingualField label_ar="الاستخدام الأعلى والأفضل" label_en="Highest and Best Use" value_ar={data.highest_best_use_ar} value_en={data.highest_best_use_en} language={language} />
      </SectionCard>

      {/* Valuation Approaches */}
      <SectionCard title_ar="أساليب التقييم المستخدمة" title_en="Valuation Approaches" order={15} language={language}>
        <BilingualField label_ar="الأساليب المستخدمة" label_en="Approaches Considered" value_ar={data.approaches_considered_ar} value_en={data.approaches_considered_en} language={language} />
      </SectionCard>

      {/* Calculations */}
      <SectionCard title_ar="الحسابات والتحليل" title_en="Calculations & Analysis" order={16} language={language}>
        <BilingualField label_ar="التحليل" label_en="Analysis" value_ar={data.calculations_ar} value_en={data.calculations_en} language={language} />
      </SectionCard>

      {/* Reconciliation */}
      <SectionCard title_ar="التسوية والمطابقة" title_en="Reconciliation" order={17} language={language}>
        <BilingualField label_ar="التسوية" label_en="Reconciliation" value_ar={data.reconciliation_ar} value_en={data.reconciliation_en} language={language} />
      </SectionCard>

      {/* Final Value */}
      <Card className="overflow-hidden border-primary/30">
        <div className="bg-primary/5 p-6">
          <SectionHeader title_ar="الرأي النهائي في القيمة" title_en="Final Opinion of Value" order={18} language={language} />
          <div className="text-center mt-6 space-y-3">
            <div className="text-4xl font-bold text-primary">
              {data.final_value} {data.currency}
            </div>
            {language === "bilingual" ? (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{data.final_value_text_ar}</p>
                <p className="text-sm text-muted-foreground" dir="ltr">{data.final_value_text_en}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground" dir={language === "en" ? "ltr" : "rtl"}>
                {language === "ar" ? data.final_value_text_ar : data.final_value_text_en}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Assumptions */}
      <SectionCard title_ar="الافتراضات والقيود" title_en="Assumptions & Limiting Conditions" order={19} language={language}>
        <BilingualField label_ar="الافتراضات" label_en="Assumptions" value_ar={data.assumptions_ar} value_en={data.assumptions_en} language={language} />
        <BilingualField label_ar="الافتراضات الخاصة" label_en="Special Assumptions" value_ar={data.special_assumptions_ar} value_en={data.special_assumptions_en} language={language} />
        <BilingualField label_ar="القيود والمحددات" label_en="Limiting Conditions" value_ar={data.limiting_conditions_ar} value_en={data.limiting_conditions_en} language={language} />
      </SectionCard>

      {/* Compliance */}
      <SectionCard title_ar="بيان الامتثال" title_en="Compliance Statement" order={20} language={language}>
        <BilingualField label_ar="بيان الامتثال" label_en="Compliance Statement" value_ar={data.compliance_statement_ar} value_en={data.compliance_statement_en} language={language} />
      </SectionCard>

      {/* Signature */}
      <Card className="overflow-hidden">
        <CardContent className="pt-6">
          <SectionHeader title_ar="التوقيع" title_en="Signature Page" order={21} language={language} />
          <Separator className="my-4" />
          <div className={language === "bilingual" ? "grid grid-cols-2 gap-8" : ""}>
            {(language === "ar" || language === "bilingual") && (
              <div className="text-center space-y-3 py-6">
                <div className="w-32 h-16 mx-auto border-b-2 border-foreground/30" />
                <p className="font-bold text-foreground text-lg">{data.signer_name_ar}</p>
                <p className="text-sm text-muted-foreground">{data.signer_title_ar}</p>
                {data.signer_license && (
                  <p className="text-xs text-muted-foreground">رقم الترخيص: {data.signer_license}</p>
                )}
                <p className="text-xs text-muted-foreground">التاريخ: {data.report_date}</p>
              </div>
            )}
            {(language === "en" || language === "bilingual") && (
              <div className="text-center space-y-3 py-6" dir="ltr">
                <div className="w-32 h-16 mx-auto border-b-2 border-foreground/30" />
                <p className="font-bold text-foreground text-lg">{data.signer_name_en}</p>
                <p className="text-sm text-muted-foreground">{data.signer_title_en}</p>
                {data.signer_license && (
                  <p className="text-xs text-muted-foreground">License No.: {data.signer_license}</p>
                )}
                <p className="text-xs text-muted-foreground">Date: {data.report_date}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionHeader({ title_ar, title_en, order, language }: {
  title_ar: string; title_en: string; order: number; language: ReportLanguage;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
        {order}
      </span>
      {language === "bilingual" ? (
        <div>
          <h3 className="text-lg font-bold text-foreground">{title_ar}</h3>
          <p className="text-sm text-muted-foreground" dir="ltr">{title_en}</p>
        </div>
      ) : (
        <h3 className="text-lg font-bold text-foreground" dir={language === "en" ? "ltr" : "rtl"}>
          {language === "ar" ? title_ar : title_en}
        </h3>
      )}
    </div>
  );
}

function SectionCard({ title_ar, title_en, order, language, children }: {
  title_ar: string; title_en: string; order: number; language: ReportLanguage; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <SectionHeader title_ar={title_ar} title_en={title_en} order={order} language={language} />
        <Separator className="my-4" />
        <div className="space-y-1 divide-y divide-border/50">{children}</div>
      </CardContent>
    </Card>
  );
}
