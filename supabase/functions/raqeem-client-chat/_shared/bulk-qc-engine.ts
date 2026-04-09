/**
 * المستوى 47 — ضبط الجودة الجماعي (Bulk QC Engine)
 * فحص الاتساق وكشف القيم الشاذة وتقرير الجودة
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface QCAlert {
  type: "outlier" | "inconsistency" | "missing_data" | "compliance";
  severity: "high" | "medium" | "low";
  assetName: string;
  message: string;
}

export interface BulkQCResult {
  section: string;
  alerts: QCAlert[];
  overallQualityScore: number;
  outlierCount: number;
  inconsistencyCount: number;
  complianceIssues: number;
  readyForIssuance: boolean;
}

export async function analyzeBulkQC(
  db: SupabaseClient,
  assignmentId?: string
): Promise<BulkQCResult> {
  const empty: BulkQCResult = {
    section: "", alerts: [], overallQualityScore: 0,
    outlierCount: 0, inconsistencyCount: 0, complianceIssues: 0,
    readyForIssuance: false,
  };
  if (!assignmentId) return empty;

  try {
    const { data: jobs } = await db
      .from("processing_jobs")
      .select("id")
      .eq("assignment_id", assignmentId)
      .limit(20);
    if (!jobs?.length) return empty;

    const { data: assets } = await db
      .from("extracted_assets")
      .select("id, name, category, condition, asset_data, confidence, missing_fields, quantity")
      .in("job_id", jobs.map(j => j.id))
      .limit(2000);
    if (!assets?.length || assets.length < 10) return empty;

    const alerts: QCAlert[] = [];

    // 1. Group by category for outlier detection
    const catValues = new Map<string, { name: string; value: number }[]>();
    for (const asset of assets) {
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;
      const cat = asset.category || "general";
      if (!catValues.has(cat)) catValues.set(cat, []);
      catValues.get(cat)!.push({ name: asset.name, value: cost });
    }

    // IQR outlier detection per category
    let outlierCount = 0;
    for (const [cat, items] of catValues) {
      if (items.length < 4) continue;
      const sorted = [...items].sort((a, b) => a.value - b.value);
      const q1 = sorted[Math.floor(sorted.length * 0.25)].value;
      const q3 = sorted[Math.floor(sorted.length * 0.75)].value;
      const iqr = q3 - q1;
      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;

      for (const item of items) {
        if (item.value < lower || item.value > upper) {
          outlierCount++;
          alerts.push({
            type: "outlier", severity: "high", assetName: item.name,
            message: `قيمة شاذة (${item.value.toLocaleString()} ر.س) في فئة "${cat}" — المدى الطبيعي: ${Math.round(lower).toLocaleString()}-${Math.round(upper).toLocaleString()} ر.س`,
          });
        }
      }
    }

    // 2. Consistency check: same category + condition = similar values
    let inconsistencyCount = 0;
    const groupKey = (a: typeof assets[0]) => {
      const d = a.asset_data as Record<string, any> || {};
      return `${a.category || ""}|${d.manufacturer || d.make || ""}|${a.condition || ""}`;
    };
    const groups = new Map<string, number[]>();
    for (const asset of assets) {
      const key = groupKey(asset);
      const data = asset.asset_data as Record<string, any> || {};
      const cost = Number(data.original_cost || data.replacement_cost || data.cost || 0);
      if (cost <= 0) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(cost);
    }
    for (const [key, values] of groups) {
      if (values.length < 3) continue;
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const maxDev = Math.max(...values.map(v => Math.abs(v - avg) / avg));
      if (maxDev > 0.5) {
        inconsistencyCount++;
        alerts.push({
          type: "inconsistency", severity: "medium", assetName: key,
          message: `تباين كبير (${Math.round(maxDev * 100)}%) بين أصول متطابقة — يتطلب مراجعة`,
        });
      }
    }

    // 3. Missing data check
    let missingCount = 0;
    for (const asset of assets) {
      if (asset.missing_fields?.length && asset.missing_fields.length > 2) {
        missingCount++;
        if (missingCount <= 5) {
          alerts.push({
            type: "missing_data", severity: "medium", assetName: asset.name,
            message: `بيانات ناقصة: ${asset.missing_fields.join("، ")}`,
          });
        }
      }
    }

    // 4. Low confidence check
    let lowConfCount = 0;
    for (const asset of assets) {
      if ((asset.confidence || 0) < 30) {
        lowConfCount++;
        if (lowConfCount <= 3) {
          alerts.push({
            type: "compliance", severity: "high", assetName: asset.name,
            message: `درجة ثقة منخفضة جداً (${asset.confidence}%) — يتطلب مراجعة يدوية`,
          });
        }
      }
    }

    const complianceIssues = lowConfCount;
    const totalIssues = outlierCount + inconsistencyCount + missingCount + complianceIssues;
    const qualityScore = Math.max(0, Math.round(100 - (totalIssues / assets.length) * 100));
    const readyForIssuance = qualityScore >= 70 && alerts.filter(a => a.severity === "high").length === 0;

    let section = `\n\n## ضبط الجودة الجماعي\n`;
    section += `- درجة الجودة: **${qualityScore}%** ${qualityScore >= 70 ? "✅" : qualityScore >= 40 ? "⚠️" : "🔴"}\n`;
    section += `- جاهزية الإصدار: **${readyForIssuance ? "جاهز ✅" : "يتطلب مراجعة ⚠️"}**\n`;
    section += `\n| نوع الفحص | العدد | الحالة |\n|---|---|---|\n`;
    section += `| قيم شاذة | ${outlierCount} | ${outlierCount === 0 ? "✅" : "🔴"} |\n`;
    section += `| عدم اتساق | ${inconsistencyCount} | ${inconsistencyCount === 0 ? "✅" : "⚠️"} |\n`;
    section += `| بيانات ناقصة | ${missingCount} | ${missingCount === 0 ? "✅" : "⚠️"} |\n`;
    section += `| ثقة منخفضة | ${lowConfCount} | ${lowConfCount === 0 ? "✅" : "🔴"} |\n`;

    if (alerts.filter(a => a.severity === "high").length > 0) {
      section += `\n### 🔴 تنبيهات عالية الأهمية:\n`;
      for (const a of alerts.filter(a => a.severity === "high").slice(0, 5)) {
        section += `• **${a.assetName}**: ${a.message}\n`;
      }
    }

    return {
      section, alerts: alerts.slice(0, 20), overallQualityScore: qualityScore,
      outlierCount, inconsistencyCount, complianceIssues,
      readyForIssuance,
    };
  } catch (e) {
    console.error("Bulk QC error:", e);
    return empty;
  }
}
