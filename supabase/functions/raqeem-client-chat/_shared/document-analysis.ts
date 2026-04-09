import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface DocumentReadiness {
  total: number;
  classified: number;
  missing: string[];
  readinessPercent: number;
  section: string;
}

const REQUIRED_DOCS: Record<string, string[]> = {
  residential: ["صك ملكية", "رخصة بناء", "مخطط معماري", "كروكي الموقع"],
  commercial: ["صك ملكية", "رخصة بناء", "عقود إيجار", "كروكي الموقع", "رخصة تجارية"],
  land: ["صك ملكية", "كروكي الموقع", "تصنيف الأرض"],
  industrial: ["صك ملكية", "رخصة بناء", "رخصة تشغيل", "كروكي الموقع"],
  machinery_equipment: ["قائمة الأصول", "فواتير الشراء", "سجلات الصيانة", "صور المعدات"],
};

export async function analyzeDocumentReadiness(
  db: SupabaseClient,
  requestId: string,
  propertyType: string | null
): Promise<DocumentReadiness> {
  const { data: docs } = await db
    .from("request_documents")
    .select("file_name, ai_category, mime_type")
    .eq("request_id", requestId);

  const total = docs?.length || 0;
  const categories = (docs || []).map((d) => d.ai_category).filter(Boolean);
  const classified = categories.length;

  // Determine required docs based on property type
  const type = propertyType || "residential";
  const required = REQUIRED_DOCS[type] || REQUIRED_DOCS.residential;
  const missing = required.filter(
    (req) => !categories.some((cat) => cat?.includes(req) || req.includes(cat || ""))
  );

  const readinessPercent = total === 0 ? 0 : Math.min(100, Math.round(((required.length - missing.length) / required.length) * 100));

  let section = `\n\n## تحليل جاهزية المستندات\n`;
  section += `- إجمالي المرفوعة: ${total} ملف\n`;
  section += `- المصنفة آلياً: ${classified}\n`;
  section += `- نسبة الاكتمال: ${readinessPercent}%\n`;
  if (missing.length > 0) {
    section += `- **المستندات المفقودة**: ${missing.join("، ")}\n`;
    section += `\n⚠️ أخبر العميل بالمستندات المفقودة واطلبها بأسلوب مهني مبسّط.\n`;
  } else {
    section += `- ✅ جميع المستندات الأساسية متوفرة\n`;
  }

  return { total, classified, missing, readinessPercent, section };
}
