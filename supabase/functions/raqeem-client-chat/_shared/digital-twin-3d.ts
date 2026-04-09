/**
 * Level 50: Digital Twin 3D Property Model
 * Creates a digital fingerprint from inspection data and area measurements
 */

interface DigitalTwinModel {
  propertyFingerprint: string;
  dimensions: { landArea: number; buildingArea: number; floors: number };
  conditionProfile: { exterior: string; interior: string; systems: string; overall: number };
  depreciationCurve: { year: number; valueRetention: number }[];
  maintenanceNeeds: string[];
}

interface DigitalTwin3DResult {
  section: string;
  model: DigitalTwinModel | null;
  futureValueProjections: { year: number; estimatedValue: number }[];
}

export async function analyzeDigitalTwin3D(
  db: any,
  assignmentId: string | undefined
): Promise<DigitalTwin3DResult> {
  const empty: DigitalTwin3DResult = { section: "", model: null, futureValueProjections: [] };
  if (!assignmentId) return empty;

  try {
    const [{ data: subject }, { data: inspection }, { data: analysis }] = await Promise.all([
      db.from("subjects").select("*").eq("assignment_id", assignmentId).limit(1).single(),
      db.from("inspections").select("*").eq("assignment_id", assignmentId).order("created_at", { ascending: false }).limit(1).single(),
      db.from("inspection_analysis").select("*").eq("assignment_id", assignmentId).limit(1).single(),
    ]);

    if (!subject) return empty;

    const landArea = subject.land_area || 0;
    const buildingArea = subject.building_area || 0;
    const floors = subject.number_of_floors || 1;
    const yearBuilt = subject.year_built || new Date().getFullYear();
    const age = new Date().getFullYear() - yearBuilt;

    // Condition assessment
    const conditionScore = analysis?.condition_score || (age < 5 ? 90 : age < 15 ? 75 : age < 30 ? 55 : 35);
    const conditionMap: Record<string, string> = {
      excellent: "ممتاز", good: "جيد", fair: "متوسط", poor: "ضعيف",
    };
    const overallCondition = conditionScore > 80 ? "excellent" : conditionScore > 60 ? "good" : conditionScore > 40 ? "fair" : "poor";

    // Depreciation curve (30-year projection)
    const depreciationCurve = Array.from({ length: 6 }, (_, i) => {
      const y = (i + 1) * 5;
      const totalAge = age + y;
      const retention = Math.max(20, 100 - totalAge * 1.5 - (totalAge > 20 ? (totalAge - 20) * 0.5 : 0));
      return { year: new Date().getFullYear() + y, valueRetention: Math.round(retention) };
    });

    // Maintenance needs based on age
    const maintenanceNeeds: string[] = [];
    if (age > 5) maintenanceNeeds.push("صيانة دهانات خارجية");
    if (age > 10) maintenanceNeeds.push("فحص العزل المائي والحراري");
    if (age > 15) maintenanceNeeds.push("تجديد أنظمة التكييف");
    if (age > 20) maintenanceNeeds.push("فحص الهيكل الإنشائي");
    if (age > 25) maintenanceNeeds.push("تجديد شامل للتشطيبات");

    const fingerprint = `DT-${assignmentId.slice(0, 8)}-${landArea}-${buildingArea}-${yearBuilt}`;

    const model: DigitalTwinModel = {
      propertyFingerprint: fingerprint,
      dimensions: { landArea, buildingArea, floors },
      conditionProfile: {
        exterior: conditionMap[overallCondition] || "غير محدد",
        interior: conditionMap[overallCondition] || "غير محدد",
        systems: age > 15 ? "يحتاج تقييم" : "جيد",
        overall: conditionScore,
      },
      depreciationCurve,
      maintenanceNeeds,
    };

    // Future value projections
    const baseValue = (subject.estimated_value || buildingArea * 3500) || 0;
    const futureValueProjections = depreciationCurve.map((d) => ({
      year: d.year,
      estimatedValue: Math.round(baseValue * (d.valueRetention / 100)),
    }));

    let section = "\n\n## التوأم الرقمي للعقار (المستوى 50)\n";
    section += `- البصمة الرقمية: ${fingerprint}\n`;
    section += `- المساحة: أرض ${landArea} م² | بناء ${buildingArea} م² | ${floors} طابق\n`;
    section += `- العمر: ${age} سنة | الحالة العامة: ${conditionMap[overallCondition]} (${conditionScore}%)\n`;
    section += `- الصيانة المطلوبة: ${maintenanceNeeds.length > 0 ? maintenanceNeeds.join("، ") : "لا توجد"}\n`;
    section += `- منحنى الإهلاك: ${depreciationCurve.map((d) => `${d.year}: ${d.valueRetention}%`).join(" → ")}\n`;

    return { section, model, futureValueProjections };
  } catch (e) {
    console.error("Digital Twin 3D error:", e);
    return empty;
  }
}
