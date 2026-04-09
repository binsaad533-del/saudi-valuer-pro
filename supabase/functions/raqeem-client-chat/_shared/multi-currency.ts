/**
 * Level 56: Multi-Currency Valuation Engine
 * Supports valuation in SAR, USD, EUR with live FX documentation
 */

interface CurrencyConversion {
  currency: string;
  symbol: string;
  rate: number;
  convertedValue: number;
  lastUpdated: string;
}

interface MultiCurrencyResult {
  section: string;
  baseCurrency: string;
  baseValue: number;
  conversions: CurrencyConversion[];
  fxDisclaimer: string;
}

export async function analyzeMultiCurrency(
  db: any,
  assignmentId: string | undefined
): Promise<MultiCurrencyResult> {
  const empty: MultiCurrencyResult = {
    section: "", baseCurrency: "SAR", baseValue: 0, conversions: [], fxDisclaimer: "",
  };
  if (!assignmentId) return empty;

  try {
    const { data: assignment } = await db
      .from("valuation_assignments")
      .select("final_value_sar")
      .eq("id", assignmentId)
      .single();

    const finalValue = assignment?.final_value_sar;
    if (!finalValue) return empty;

    // Fixed exchange rates (SAR is pegged to USD)
    const fxRates: Record<string, { rate: number; symbol: string; name: string }> = {
      USD: { rate: 0.2667, symbol: "$", name: "دولار أمريكي" },
      EUR: { rate: 0.2450, symbol: "€", name: "يورو" },
      GBP: { rate: 0.2100, symbol: "£", name: "جنيه إسترليني" },
      AED: { rate: 0.9793, symbol: "د.إ", name: "درهم إماراتي" },
      KWD: { rate: 0.0818, symbol: "د.ك", name: "دينار كويتي" },
      BHD: { rate: 0.1005, symbol: "د.ب", name: "دينار بحريني" },
    };

    const now = new Date().toISOString();
    const conversions: CurrencyConversion[] = Object.entries(fxRates).map(([currency, info]) => ({
      currency,
      symbol: info.symbol,
      rate: info.rate,
      convertedValue: Math.round(finalValue * info.rate * 100) / 100,
      lastUpdated: now,
    }));

    const fxDisclaimer = "أسعار الصرف إرشادية مبنية على سعر الصرف الثابت (ريال/دولار = 3.75). القيمة الرسمية بالريال السعودي فقط.";

    let section = "\n\n## التقييم متعدد العملات (المستوى 56)\n";
    section += `- القيمة الأساسية: ${finalValue.toLocaleString()} ر.س\n`;
    for (const c of conversions.slice(0, 4)) {
      section += `- ${c.symbol} ${c.convertedValue.toLocaleString()} ${c.currency}\n`;
    }
    section += `⚠️ ${fxDisclaimer}\n`;

    return { section, baseCurrency: "SAR", baseValue: finalValue, conversions, fxDisclaimer };
  } catch (e) {
    console.error("Multi-currency error:", e);
    return empty;
  }
}
