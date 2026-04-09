/**
 * المستوى 39 — محلل المقارنات السوقية للشركات
 * مضاعفات التقييم (P/E, P/B, EV/EBITDA) مع المماثلات في تداول
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface MarketMultiple {
  metric: string;
  metricAr: string;
  subjectValue: number | null;
  sectorAvg: number;
  sectorRange: [number, number];
  impliedValue: number;
  deviation: number;
}

export interface MarketMultiplesResult {
  section: string;
  multiples: MarketMultiple[];
  impliedEquityValue: number;
  sector: string;
}

// Saudi market sector averages (Tadawul 2024/2025 approximations)
const SECTOR_MULTIPLES: Record<string, { pe: [number, number, number]; pb: [number, number, number]; evEbitda: [number, number, number]; dy: [number, number, number] }> = {
  "عقاري": { pe: [12, 18, 25], pb: [0.8, 1.3, 2.0], evEbitda: [10, 15, 22], dy: [3, 5.5, 8] },
  "صناعي": { pe: [10, 15, 22], pb: [1.0, 1.8, 3.0], evEbitda: [7, 11, 16], dy: [2, 4, 6] },
  "تجزئة": { pe: [15, 22, 30], pb: [2.0, 3.5, 6.0], evEbitda: [10, 14, 20], dy: [1, 3, 5] },
  "بنوك": { pe: [10, 14, 18], pb: [1.2, 1.8, 2.5], evEbitda: [0, 0, 0], dy: [3, 5, 7] },
  "صحي": { pe: [18, 28, 40], pb: [2.0, 4.0, 7.0], evEbitda: [12, 18, 25], dy: [0.5, 2, 4] },
  "طاقة": { pe: [8, 12, 18], pb: [0.8, 1.5, 2.5], evEbitda: [5, 8, 12], dy: [4, 6, 9] },
  "عام": { pe: [12, 18, 25], pb: [1.0, 2.0, 3.5], evEbitda: [8, 12, 18], dy: [2, 4, 6] },
};

export async function analyzeMarketMultiples(
  db: SupabaseClient,
  assignmentId?: string
): Promise<MarketMultiplesResult> {
  const empty: MarketMultiplesResult = { section: "", multiples: [], impliedEquityValue: 0, sector: "" };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("property_type, notes, valuation_type")
      .eq("id", assignmentId)
      .maybeSingle();
    if (!assignment) return empty;

    // Determine sector
    const notes = (assignment.notes || "").toLowerCase();
    let sector = "عام";
    if (notes.includes("عقار") || assignment.property_type === "commercial") sector = "عقاري";
    else if (notes.includes("صناع") || assignment.valuation_type === "machinery_equipment") sector = "صناعي";
    else if (notes.includes("تجزئة") || notes.includes("retail")) sector = "تجزئة";
    else if (notes.includes("بنك") || notes.includes("مالي")) sector = "بنوك";
    else if (notes.includes("صح") || notes.includes("طب")) sector = "صحي";
    else if (notes.includes("طاقة") || notes.includes("نفط")) sector = "طاقة";

    const sectorData = SECTOR_MULTIPLES[sector] || SECTOR_MULTIPLES["عام"];

    // Get financial data from assets
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(5);

    let earnings = 0, bookValue = 0, ebitda = 0, revenue = 0;
    if (jobs?.length) {
      const { data: assets } = await db
        .from("extracted_assets")
        .select("asset_data")
        .in("job_id", jobs.map(j => j.id))
        .limit(200);

      for (const a of assets || []) {
        const d = a.asset_data as Record<string, any> || {};
        earnings += Number(d.net_income || d.earnings || 0);
        bookValue += Number(d.book_value || d.equity || d.cost || 0);
        ebitda += Number(d.ebitda || d.noi || 0);
        revenue += Number(d.revenue || d.annual_revenue || 0);
      }
    }

    // If no financial data, use estimated values
    if (bookValue <= 0) return empty;
    if (earnings <= 0) earnings = bookValue * 0.08;
    if (ebitda <= 0) ebitda = earnings * 1.4;

    const multiples: MarketMultiple[] = [];

    // P/E
    const peImplied = earnings * sectorData.pe[1];
    multiples.push({
      metric: "P/E", metricAr: "مكرر الربحية",
      subjectValue: bookValue > 0 ? Math.round(bookValue / earnings * 10) / 10 : null,
      sectorAvg: sectorData.pe[1], sectorRange: [sectorData.pe[0], sectorData.pe[2]],
      impliedValue: Math.round(peImplied),
      deviation: bookValue > 0 ? Math.round(((peImplied - bookValue) / bookValue) * 100) : 0,
    });

    // P/B
    const pbImplied = bookValue * sectorData.pb[1];
    multiples.push({
      metric: "P/B", metricAr: "مكرر القيمة الدفترية",
      subjectValue: 1.0,
      sectorAvg: sectorData.pb[1], sectorRange: [sectorData.pb[0], sectorData.pb[2]],
      impliedValue: Math.round(pbImplied),
      deviation: Math.round(((pbImplied - bookValue) / bookValue) * 100),
    });

    // EV/EBITDA
    if (sectorData.evEbitda[1] > 0 && ebitda > 0) {
      const evImplied = ebitda * sectorData.evEbitda[1];
      multiples.push({
        metric: "EV/EBITDA", metricAr: "مكرر القيمة المنشأة",
        subjectValue: bookValue > 0 ? Math.round(bookValue / ebitda * 10) / 10 : null,
        sectorAvg: sectorData.evEbitda[1], sectorRange: [sectorData.evEbitda[0], sectorData.evEbitda[2]],
        impliedValue: Math.round(evImplied),
        deviation: bookValue > 0 ? Math.round(((evImplied - bookValue) / bookValue) * 100) : 0,
      });
    }

    // Weighted average implied value
    const weights = [0.35, 0.30, 0.35];
    const impliedEquityValue = Math.round(
      multiples.reduce((s, m, i) => s + m.impliedValue * (weights[i] || 0.33), 0)
    );

    let section = "\n\n## تحليل المضاعفات السوقية (Market Multiples)\n";
    section += `- القطاع: ${sector}\n`;
    section += `- القيمة الضمنية المرجحة: ${impliedEquityValue.toLocaleString()} ر.س\n`;

    section += `\n| المضاعف | قيمة المنشأة | متوسط القطاع | النطاق | القيمة الضمنية | الفارق |\n|---|---|---|---|---|---|\n`;
    for (const m of multiples) {
      section += `| ${m.metricAr} (${m.metric}) | ${m.subjectValue ?? "-"} | ${m.sectorAvg} | ${m.sectorRange[0]}-${m.sectorRange[1]} | ${m.impliedValue.toLocaleString()} | ${m.deviation > 0 ? "+" : ""}${m.deviation}% |\n`;
    }

    section += `\n### ملاحظات:\n`;
    section += `• المتوسطات مبنية على بيانات تقريبية لسوق تداول السعودي\n`;
    section += `• يجب تعديل المضاعفات لتعكس حجم الشركة ونموها ومخاطرها\n`;
    section += `• IVS 105.40 — أسلوب المقارنة يتطلب تعديلات لفروقات المخاطر والنمو\n`;

    return { section, multiples, impliedEquityValue, sector };
  } catch (e) {
    console.error("Market multiples error:", e);
    return empty;
  }
}
