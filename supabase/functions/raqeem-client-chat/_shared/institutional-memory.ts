/**
 * Level 57: Institutional Memory Engine
 * Remembers all past valuations per client and uses them as comparative references
 */

interface HistoricalValuation {
  referenceNumber: string;
  propertyType: string;
  finalValue: number;
  date: string;
  city?: string;
  valuationMode?: string;
}

interface InstitutionalMemoryResult {
  section: string;
  clientHistory: HistoricalValuation[];
  totalPastValuations: number;
  avgValuationValue: number;
  clientTier: "platinum" | "gold" | "silver" | "new";
  insights: string[];
}

export async function analyzeInstitutionalMemory(
  db: any,
  assignmentId: string | undefined
): Promise<InstitutionalMemoryResult> {
  const empty: InstitutionalMemoryResult = {
    section: "", clientHistory: [], totalPastValuations: 0, avgValuationValue: 0, clientTier: "new", insights: [],
  };
  if (!assignmentId) return empty;

  try {
    // Get current assignment's client
    const { data: current } = await db
      .from("valuation_assignments")
      .select("client_id, property_type")
      .eq("id", assignmentId)
      .single();

    if (!current?.client_id) return empty;

    // Get all past valuations for this client
    const { data: pastValuations } = await db
      .from("valuation_assignments")
      .select("reference_number, property_type, final_value_sar, created_at, valuation_mode, status")
      .eq("client_id", current.client_id)
      .neq("id", assignmentId)
      .in("status", ["issued", "archived"])
      .not("final_value_sar", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!pastValuations?.length) return empty;

    const clientHistory: HistoricalValuation[] = pastValuations.map((v: any) => ({
      referenceNumber: v.reference_number,
      propertyType: v.property_type,
      finalValue: v.final_value_sar,
      date: new Date(v.created_at).toLocaleDateString("ar-SA"),
      valuationMode: v.valuation_mode,
    }));

    const totalPastValuations = clientHistory.length;
    const avgValuationValue = Math.round(
      clientHistory.reduce((s, v) => s + v.finalValue, 0) / totalPastValuations
    );

    // Client tier based on volume
    const clientTier: "platinum" | "gold" | "silver" | "new" =
      totalPastValuations >= 20 ? "platinum" : totalPastValuations >= 10 ? "gold" : totalPastValuations >= 3 ? "silver" : "new";

    const tierLabels = { platinum: "بلاتيني", gold: "ذهبي", silver: "فضي", new: "جديد" };

    // Generate insights
    const insights: string[] = [];
    const sameTypeValuations = pastValuations.filter((v: any) => v.property_type === current.property_type);
    if (sameTypeValuations.length > 0) {
      const avgSameType = sameTypeValuations.reduce((s: number, v: any) => s + v.final_value_sar, 0) / sameTypeValuations.length;
      insights.push(`متوسط تقييمات العميل لنفس نوع الأصل: ${Math.round(avgSameType).toLocaleString()} ر.س`);
    }

    if (totalPastValuations >= 5) {
      const recentValues = pastValuations.slice(0, 5).map((v: any) => v.final_value_sar);
      const olderValues = pastValuations.slice(-5).map((v: any) => v.final_value_sar);
      const recentAvg = recentValues.reduce((s: number, v: number) => s + v, 0) / recentValues.length;
      const olderAvg = olderValues.reduce((s: number, v: number) => s + v, 0) / olderValues.length;
      const trend = ((recentAvg - olderAvg) / olderAvg) * 100;
      if (Math.abs(trend) > 5) {
        insights.push(`اتجاه قيم العميل: ${trend > 0 ? "تصاعدي" : "تنازلي"} بنسبة ${Math.abs(Math.round(trend))}%`);
      }
    }

    insights.push(`تصنيف العميل: ${tierLabels[clientTier]} (${totalPastValuations} تقييم سابق)`);

    let section = "\n\n## الذاكرة المؤسسية (المستوى 57)\n";
    section += `- تقييمات سابقة: ${totalPastValuations} | التصنيف: ${tierLabels[clientTier]}\n`;
    section += `- متوسط القيمة: ${avgValuationValue.toLocaleString()} ر.س\n`;
    for (const insight of insights) section += `- ${insight}\n`;
    section += `- آخر 3 تقييمات: ${clientHistory.slice(0, 3).map((h) => `${h.referenceNumber}: ${h.finalValue.toLocaleString()} ر.س`).join(" | ")}\n`;

    return { section, clientHistory, totalPastValuations, avgValuationValue, clientTier, insights };
  } catch (e) {
    console.error("Institutional memory error:", e);
    return empty;
  }
}
