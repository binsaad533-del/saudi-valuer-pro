import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Purpose → Basis of Value mapping (IVS 2025)
const PURPOSE_TO_BASIS: Record<string, { ar: string; en: string; ivs: string }> = {
  financing: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  sale_purchase: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  sale: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  purchase: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  mortgage: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  insurance: { ar: "قيمة إعادة الإحلال", en: "Reinstatement Value", ivs: "IVS 104" },
  financial_reporting: { ar: "القيمة العادلة (IFRS 13)", en: "Fair Value", ivs: "IVS 104.50" },
  taxation: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  zakat: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  litigation: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  dispute: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
  expropriation: { ar: "القيمة السوقية مع التعويض العادل", en: "Market Value with Just Compensation", ivs: "IVS 104.20" },
  investment: { ar: "قيمة الاستثمار", en: "Investment Value", ivs: "IVS 104.60" },
  liquidation: { ar: "قيمة التصفية المنظمة", en: "Orderly Liquidation Value", ivs: "IVS 104.80" },
  other: { ar: "القيمة السوقية", en: "Market Value", ivs: "IVS 104.20" },
};

async function fetchRelevantRules(): Promise<string> {
  try {
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: rules } = await db
      .from("raqeem_rules")
      .select("rule_text_ar, applicable_asset_type, impact_type, severity")
      .eq("is_active", true)
      .in("rule_type", ["compliance", "data", "method"])
      .order("severity", { ascending: false })
      .limit(30);

    if (!rules || rules.length === 0) return "";

    const ruleLines = rules.map((r: any) =>
      `- [${r.severity === "blocking" ? "إلزامي" : "تحذيري"}] ${r.rule_text_ar}`
    );
    return `\n\n══ القواعد المهنية المعمول بها ══\n${ruleLines.join("\n")}`;
  } catch {
    return "";
  }
}

async function fetchAssignmentData(assignmentId: string) {
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [assignmentRes, subjectRes, inspectionRes, comparablesRes, assumptionsRes] = await Promise.all([
    db.from("valuation_assignments").select("*, clients(*)").eq("id", assignmentId).single(),
    db.from("subjects").select("*").eq("assignment_id", assignmentId).limit(5),
    db.from("inspections").select("*").eq("assignment_id", assignmentId).limit(1),
    db.from("assignment_comparables").select("*, comparables(*)").eq("assignment_id", assignmentId).limit(10),
    db.from("assumptions").select("*").eq("assignment_id", assignmentId).order("sort_order"),
  ]);

  return {
    assignment: assignmentRes.data,
    subjects: subjectRes.data || [],
    inspection: inspectionRes.data?.[0],
    comparables: comparablesRes.data || [],
    assumptions: assumptionsRes.data || [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      purpose,
      purposeText,
      intendedUsers,
      intendedUsersText,
      assetDescription,
      assetType,
      clientName,
      city,
      district,
      area,
      documents,
      assignmentId,
    } = body;

    // Fetch assignment data if available
    let assignmentContext = "";
    if (assignmentId) {
      try {
        const data = await fetchAssignmentData(assignmentId);
        if (data.assignment) {
          const a = data.assignment;
          assignmentContext = `
━━━ بيانات الطلب من النظام ━━━
- رقم الطلب: ${a.reference_number || "—"}
- نوع الأصل: ${a.property_type || "—"}
- المدينة: ${a.city_ar || city || "—"}
- الحي: ${a.district_ar || district || "—"}
- المساحة: ${a.land_area || area || "—"} م²
- العميل: ${(a as any).clients?.name_ar || clientName || "—"}
- عدد المقارنات المتوفرة: ${data.comparables.length}
- حالة المعاينة: ${data.inspection ? (data.inspection.completed ? "مكتملة" : "قيد التنفيذ") : "لم تتم بعد"}
- الافتراضات المسجلة: ${data.assumptions.length}`;

          if (data.subjects.length > 0) {
            assignmentContext += `\n- الأصول المسجلة: ${data.subjects.map((s: any) => s.description_ar || s.name_ar).join("، ")}`;
          }
        }
      } catch (e) {
        console.error("Failed to fetch assignment data:", e);
      }
    }

    // Determine basis of value from purpose
    const purposeKey = purpose || "other";
    const basis = PURPOSE_TO_BASIS[purposeKey] || PURPOSE_TO_BASIS["other"];

    // Fetch compliance rules
    const rulesContext = await fetchRelevantRules();

    const systemPrompt = `أنت خبير تقييم عقاري سعودي معتمد (تقييم + RICS) بخبرة 20 سنة. مهمتك كتابة نطاق عمل احترافي متكامل لتقرير تقييم.

## المخرج المطلوب
نص مهني باللغة العربية يتضمن جميع أقسام نطاق العمل التالية:

1. **الغرض من التقييم** — وصف مهني للغرض مع المرجع المعياري
2. **المستخدمون المقصودون** — تحديد الجهات المستفيدة من التقرير
3. **أساس القيمة** — تحديد أساس القيمة المناسب مع التبرير المعياري (IVS)
4. **تاريخ التقييم** — تاريخ التقييم الفعلي
5. **وصف الأصل** — وصف تفصيلي للأصل/الأصول محل التقييم
6. **نطاق المعاينة** — تفاصيل المعاينة الميدانية المطلوبة
7. **مصادر البيانات** — المصادر المعتمدة لجمع المعلومات
8. **الافتراضات** — الافتراضات العامة والخاصة
9. **القيود والتحفظات** — القيود المهنية على نطاق العمل

## القواعد الملزمة — معايير مهنية موحدة
- اللغة العربية الفصحى المهنية حصراً — لا تبسيط ولا اختصار
- استخدم مصطلحات مهنية دقيقة متوافقة مع IVS 2025 ومعايير تقييم
- خصص المحتوى بناءً على نوع الأصل (عقاري / آلات / مختلط)
- لا تكرر نفس الصياغة — نوّع الأسلوب مع الحفاظ على المهنية
- اذكر مراجع IVS المحددة حيثما أمكن (مثال: IVS 104.20)
- اجعل الافتراضات والقيود واقعية ومرتبطة بالحالة الفعلية
- إذا كانت البيانات ناقصة، أضف افتراضات إضافية تعكس ذلك
- كل قسم يجب أن يحتوي على فقرات مفصلة — لا يُقبل الاقتصار على نقاط مختصرة
- المخرج يجب أن يكون جاهزاً للتضمين في تقرير رسمي بدون تعديل${rulesContext}`;

    const intendedUsersLabel = intendedUsers === "other" ? intendedUsersText : ({
      bank: "البنك / جهة التمويل",
      government: "جهة حكومية",
      court: "المحكمة / الجهة القضائية",
      internal: "الإدارة الداخلية",
      investor: "المستثمر / صندوق الاستثمار",
    }[intendedUsers] || intendedUsers || "غير محدد");

    const purposeLabel = purpose === "other" ? purposeText : ({
      financing: "تمويل بنكي",
      sale: "بيع",
      purchase: "شراء",
      sale_purchase: "بيع / شراء",
      mortgage: "رهن عقاري",
      insurance: "تأمين",
      financial_reporting: "تقارير مالية",
      taxation: "ضريبي",
      zakat: "زكاة / ضريبي",
      litigation: "قضائي / نزاع",
      dispute: "فض نزاع",
      expropriation: "نزع ملكية",
      investment: "استثمار",
      liquidation: "تصفية",
    }[purpose] || purpose || "تقييم عام");

    const docsInfo = Array.isArray(documents) && documents.length > 0
      ? `المستندات المتوفرة: ${documents.map((d: any) => d.name || d).join("، ")}`
      : "لم يتم رفع مستندات بعد";

    const userPrompt = `اكتب نطاق عمل احترافي كامل بناءً على البيانات التالية:

━━━ بيانات الطلب ━━━
- الغرض من التقييم: ${purposeLabel}
- المستخدمون المقصودون: ${intendedUsersLabel}
- أساس القيمة المقترح: ${basis.ar} (${basis.en}) — ${basis.ivs}
- نوع الأصل: ${(assetType === "machinery" || assetType === "machinery_equipment") ? "آلات ومعدات" : (assetType === "mixed" || assetType === "both") ? "مختلط (عقاري + آلات ومعدات)" : "عقاري"}
- وصف الأصل: ${assetDescription || "غير متوفر — يرجى الافتراض بناءً على المعلومات المتاحة"}
- العميل: ${clientName || "غير محدد"}
- المدينة: ${city || "غير محددة"}
- الحي: ${district || "غير محدد"}
- المساحة: ${area || "غير محددة"} م²
- ${docsInfo}
${assignmentContext}

اكتب نطاق العمل الكامل الآن.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_scope_of_work",
              description: "Generate a complete professional scope of work for a valuation report",
              parameters: {
                type: "object",
                properties: {
                  purpose_section: {
                    type: "string",
                    description: "Professional Arabic text for the purpose of valuation section",
                  },
                  intended_users_section: {
                    type: "string",
                    description: "Professional Arabic text for intended users section",
                  },
                  basis_of_value_section: {
                    type: "string",
                    description: "Professional Arabic text for basis of value with IVS reference",
                  },
                  valuation_date_section: {
                    type: "string",
                    description: "Professional Arabic text for valuation date",
                  },
                  asset_description_section: {
                    type: "string",
                    description: "Professional Arabic text for asset description",
                  },
                  inspection_scope_section: {
                    type: "string",
                    description: "Professional Arabic text for scope of inspection",
                  },
                  data_sources_section: {
                    type: "string",
                    description: "Professional Arabic text for data sources",
                  },
                  assumptions_section: {
                    type: "string",
                    description: "Professional Arabic text for assumptions (general and special)",
                  },
                  limiting_conditions_section: {
                    type: "string",
                    description: "Professional Arabic text for limiting conditions",
                  },
                  full_scope_text: {
                    type: "string",
                    description: "Complete combined scope of work as a single professional document in Arabic",
                  },
                  basis_of_value_key: {
                    type: "string",
                    description: "Key for basis of value: market_value, fair_value, investment_value, liquidation_value, reinstatement_value",
                  },
                  methodology_recommendation: {
                    type: "string",
                    description: "Recommended primary valuation methodology in Arabic with justification",
                  },
                },
                required: [
                  "purpose_section",
                  "intended_users_section",
                  "basis_of_value_section",
                  "valuation_date_section",
                  "asset_description_section",
                  "inspection_scope_section",
                  "data_sources_section",
                  "assumptions_section",
                  "limiting_conditions_section",
                  "full_scope_text",
                  "basis_of_value_key",
                  "methodology_recommendation",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_scope_of_work" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز حد الطلبات، يرجى المحاولة بعد قليل" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "رصيد غير كافٍ، يرجى شحن الرصيد" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");

    const scopeData = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        scope: scopeData,
        basisOfValue: basis,
        purposeLabel,
        intendedUsersLabel,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("generate-scope-work error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
