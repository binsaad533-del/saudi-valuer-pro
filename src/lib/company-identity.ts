/**
 * الهوية الرسمية لشركة جساس للتقييم
 * هذا الملف مرجعي ثابت — لا يجوز تعديله إلا بموافقة الإدارة
 */

export const JSAAS_IDENTITY = {
  companyName: "جساس للتقييم",
  companyNameEn: "Jsaas Valuation",

  // المقيّم المعتمد
  valuerName: "أحمد سعد أحمد المالكي",
  valuerTitle: "مقيم معتمد — الهيئة السعودية للمقيمين المعتمدين",

  // ترخيص مزاولة المهنة
  licenseNumber: "4306",
  licenseBranch: "فرع تقييم الآلات والمعدات",

  // العضويات
  memberships: [
    { label: "تقييم الآلات والمعدات", number: "4210000041" },
    { label: "تقييم العقار", number: "1210001217" },
  ],

  // السجل التجاري
  crNumber: "7016803038",

  // الرقم الضريبي
  taxNumber: "311782886300003",

  // العنوان
  address: "الرياض — حي الياسمين — طريق الثمامة",

  // QR URLs for verification
  qrLinks: {
    cr: "https://mc.gov.sa/ar/eservices/Pages/ServiceDetails.aspx?sID=1",
    license: "https://taqeem.org.sa",
    vat: "https://zatca.gov.sa",
  },
} as const;

/** Footer text for all report pages */
export function getReportFooterText(pageNum: number, totalPages?: number) {
  const pageStr = totalPages ? `Page ${pageNum} / ${totalPages}` : `Page ${pageNum}`;
  return {
    right: `${JSAAS_IDENTITY.companyName} | ${JSAAS_IDENTITY.crNumber} | الرقم الضريبي: ${JSAAS_IDENTITY.taxNumber}`,
    left: pageStr,
  };
}
