/**
 * Level 59: ERP Integration Engine
 * Prepares structured data for SAP/Oracle import-export
 */

interface ERPAssetRecord {
  assetNumber: string;
  description: string;
  category: string;
  acquisitionDate?: string;
  acquisitionCost?: number;
  currentBookValue?: number;
  fairMarketValue?: number;
  usefulLife?: number;
  depreciationMethod: string;
  location?: string;
  costCenter?: string;
}

interface ERPIntegrationResult {
  section: string;
  exportFormat: "SAP_ANLA" | "ORACLE_FA" | "GENERIC_CSV";
  records: ERPAssetRecord[];
  totalRecords: number;
  mappingCompleteness: number;
  unmappedFields: string[];
  exportReady: boolean;
}

export async function analyzeERPIntegration(
  db: any,
  assignmentId: string | undefined
): Promise<ERPIntegrationResult> {
  const empty: ERPIntegrationResult = {
    section: "", exportFormat: "GENERIC_CSV", records: [], totalRecords: 0,
    mappingCompleteness: 0, unmappedFields: [], exportReady: false,
  };
  if (!assignmentId) return empty;

  try {
    const [{ data: assignment }, { data: subjects }] = await Promise.all([
      db.from("valuation_assignments").select("reference_number, final_value_sar, property_type, valuation_type, created_at").eq("id", assignmentId).single(),
      db.from("subjects").select("*").eq("assignment_id", assignmentId),
    ]);

    if (!assignment) return empty;

    const records: ERPAssetRecord[] = (subjects || []).map((s: any, i: number) => {
      const propertyLabels: Record<string, string> = {
        residential: "عقار سكني", commercial: "عقار تجاري", industrial: "عقار صناعي",
        land: "أرض", machinery_equipment: "آلات ومعدات",
      };

      return {
        assetNumber: `${assignment.reference_number}-${String(i + 1).padStart(3, "0")}`,
        description: s.description_ar || propertyLabels[assignment.property_type] || "أصل",
        category: assignment.property_type,
        acquisitionDate: s.acquisition_date,
        acquisitionCost: s.original_cost,
        currentBookValue: s.book_value,
        fairMarketValue: assignment.final_value_sar,
        usefulLife: s.useful_life_years,
        depreciationMethod: "straight_line",
        location: [s.city_ar, s.district_ar].filter(Boolean).join(" - "),
        costCenter: s.cost_center,
      };
    });

    // If no subjects, create from assignment
    if (records.length === 0 && assignment.final_value_sar) {
      records.push({
        assetNumber: `${assignment.reference_number}-001`,
        description: assignment.property_type,
        category: assignment.property_type,
        fairMarketValue: assignment.final_value_sar,
        depreciationMethod: "straight_line",
      });
    }

    // Calculate mapping completeness
    const requiredFields = ["assetNumber", "description", "category", "fairMarketValue"];
    const optionalFields = ["acquisitionDate", "acquisitionCost", "currentBookValue", "usefulLife", "location", "costCenter"];
    const unmappedFields: string[] = [];

    for (const field of optionalFields) {
      const hasData = records.some((r: any) => r[field] != null);
      if (!hasData) {
        const fieldLabels: Record<string, string> = {
          acquisitionDate: "تاريخ الاقتناء", acquisitionCost: "تكلفة الاقتناء",
          currentBookValue: "القيمة الدفترية", usefulLife: "العمر الإنتاجي",
          location: "الموقع", costCenter: "مركز التكلفة",
        };
        unmappedFields.push(fieldLabels[field] || field);
      }
    }

    const mappingCompleteness = Math.round(((optionalFields.length - unmappedFields.length + requiredFields.length) / (optionalFields.length + requiredFields.length)) * 100);
    const exportReady = mappingCompleteness >= 60;

    let section = "\n\n## تكامل أنظمة ERP (المستوى 59)\n";
    section += `- السجلات الجاهزة: ${records.length}\n`;
    section += `- اكتمال التعيين: ${mappingCompleteness}%\n`;
    section += `- جاهز للتصدير: ${exportReady ? "✅ نعم" : "❌ يحتاج استكمال"}\n`;
    if (unmappedFields.length > 0) section += `- حقول ناقصة: ${unmappedFields.join("، ")}\n`;
    section += `- الصيغ المدعومة: SAP (ANLA/ANLC) | Oracle FA | CSV\n`;

    return { section, exportFormat: "GENERIC_CSV", records, totalRecords: records.length, mappingCompleteness, unmappedFields, exportReady };
  } catch (e) {
    console.error("ERP integration error:", e);
    return empty;
  }
}
