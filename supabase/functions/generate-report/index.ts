import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// IVS 2025 + Saudi Taqeem report section keys
const REPORT_SECTIONS = [
  "cover_page",
  "table_of_contents",
  "executive_summary",
  "engagement_letter",
  "purpose_and_intended_use",
  "scope_of_work",
  "property_identification",
  "property_description",
  "legal_description",
  "location_analysis",
  "market_overview",
  "highest_and_best_use",
  "valuation_approaches",
  "sales_comparison_approach",
  "cost_approach",
  "income_approach",
  "reconciliation",
  "assumptions_and_limiting_conditions",
  "compliance_statement",
  "valuer_certification",
  "appendices",
] as const;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { request_id, mode = "collect_data", sections: requestedSections } = body as {
      request_id: string;
      mode?: "collect_data" | "generate_draft";
      sections?: string[];
    };

    if (!request_id) {
      return new Response(
        JSON.stringify({ error: "request_id مطلوب" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ═══════════════════════════════════════════════════════════
    // DATA COLLECTION PHASE — Gather all related data
    // ═══════════════════════════════════════════════════════════

    const { data: request, error: reqError } = await supabase
      .from("valuation_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqError || !request) {
      return new Response(
        JSON.stringify({ error: "لم يتم العثور على الطلب", details: reqError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parallel fetches for independent data
    let clientProfile = null;
    if (request.client_user_id) {
      const { data } = await supabase
        .from("profiles").select("*")
        .eq("user_id", request.client_user_id).single();
      clientProfile = data;
    }

    let assignment = null;
    if (request.assignment_id) {
      const { data } = await supabase
        .from("valuation_assignments").select("*")
        .eq("id", request.assignment_id).single();
      assignment = data;
    }
    if (!assignment) {
      const { data } = await supabase
        .from("valuation_assignments").select("*")
        .eq("organization_id", request.organization_id)
        .order("created_at", { ascending: false }).limit(1);
      if (data?.length) assignment = data[0];
    }

    const assignmentId = assignment?.id;

    let clientRecord = null;
    if (assignment?.client_id) {
      const { data } = await supabase
        .from("clients").select("*")
        .eq("id", assignment.client_id).single();
      clientRecord = data;
    }

    let subject = null;
    if (assignmentId) {
      const { data } = await supabase
        .from("subjects").select("*")
        .eq("assignment_id", assignmentId).single();
      subject = data;
    }

    // Inspection data
    let inspection = null;
    let inspectionAnalysis = null;
    let inspectionPhotos: any[] = [];
    let checklistItems: any[] = [];
    if (assignmentId) {
      const { data: inspData } = await supabase
        .from("inspections").select("*")
        .eq("assignment_id", assignmentId)
        .order("created_at", { ascending: false }).limit(1);

      if (inspData?.length) {
        inspection = inspData[0];
        const [analysisRes, photosRes, checklistRes] = await Promise.all([
          supabase.from("inspection_analysis").select("*")
            .eq("inspection_id", inspection.id).single(),
          supabase.from("inspection_photos")
            .select("id, category, caption_ar, caption_en, file_path")
            .eq("inspection_id", inspection.id),
          supabase.from("inspection_checklist_items").select("*")
            .eq("inspection_id", inspection.id).order("sort_order"),
        ]);
        inspectionAnalysis = analysisRes.data;
        inspectionPhotos = photosRes.data || [];
        checklistItems = checklistRes.data || [];
      }
    }

    // Comparables
    let comparables: any[] = [];
    let comparableAdjustments: any[] = [];
    if (assignmentId) {
      const { data: assignComps } = await supabase
        .from("assignment_comparables")
        .select("id, rank, weight, notes, comparable_id")
        .eq("assignment_id", assignmentId).order("rank");

      if (assignComps?.length) {
        const compIds = assignComps.map((ac) => ac.comparable_id);
        const acIds = assignComps.map((ac) => ac.id);
        const [compRes, adjRes, srcRes] = await Promise.all([
          supabase.from("comparables").select("*").in("id", compIds),
          supabase.from("comparable_adjustments").select("*")
            .in("assignment_comparable_id", acIds).order("sort_order"),
          supabase.from("comparable_sources").select("*").in("comparable_id", compIds),
        ]);
        comparables = assignComps.map((ac) => ({
          ...ac,
          comparable: compRes.data?.find((c) => c.id === ac.comparable_id) || null,
          sources: (srcRes.data || []).filter((s) => s.comparable_id === ac.comparable_id),
        }));
        comparableAdjustments = adjRes.data || [];
      }
    }

    // Remaining parallel fetches
    const parallelResults = await Promise.all([
      assignmentId
        ? supabase.from("attachments")
            .select("id, file_name, category, extracted_data, mime_type")
            .eq("assignment_id", assignmentId).not("extracted_data", "is", null)
        : Promise.resolve({ data: [] }),
      assignmentId
        ? supabase.from("assumptions").select("*")
            .eq("assignment_id", assignmentId).order("sort_order")
        : Promise.resolve({ data: [] }),
      assignmentId
        ? supabase.from("reconciliation_results").select("*")
            .eq("assignment_id", assignmentId).single()
        : Promise.resolve({ data: null }),
      assignmentId
        ? supabase.from("compliance_checks").select("*")
            .eq("assignment_id", assignmentId).order("category")
        : Promise.resolve({ data: [] }),
      request.is_portfolio
        ? supabase.from("portfolio_assets").select("*")
            .eq("request_id", request_id).order("sort_order")
        : Promise.resolve({ data: [] }),
      assignment?.assigned_valuer_id
        ? supabase.from("profiles")
            .select("full_name_ar, full_name_en, title_ar, title_en, license_number, taqeem_membership, specialization, signature_url")
            .eq("user_id", assignment.assigned_valuer_id).single()
        : Promise.resolve({ data: null }),
      assignment?.assigned_reviewer_id
        ? supabase.from("profiles")
            .select("full_name_ar, full_name_en, title_ar, title_en, license_number, taqeem_membership")
            .eq("user_id", assignment.assigned_reviewer_id).single()
        : Promise.resolve({ data: null }),
      request.organization_id
        ? supabase.from("organizations").select("*")
            .eq("id", request.organization_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const documentExtractions = parallelResults[0].data || [];
    const assumptions = parallelResults[1].data || [];
    const reconciliation = parallelResults[2].data;
    const complianceChecks = parallelResults[3].data || [];
    const portfolioAssets = parallelResults[4].data || [];
    const valuerProfile = parallelResults[5].data;
    const reviewerProfile = parallelResults[6].data;
    const organization = parallelResults[7].data;

    // Build aggregated data object
    const aggregatedData = {
      request: {
        id: request.id,
        reference_number: request.reference_number,
        property_type: request.property_type,
        property_description_ar: request.property_description_ar,
        property_description_en: request.property_description_en,
        property_address_ar: request.property_address_ar,
        property_address_en: request.property_address_en,
        property_city_ar: request.property_city_ar,
        property_city_en: request.property_city_en,
        property_district_ar: request.property_district_ar,
        property_district_en: request.property_district_en,
        land_area: request.land_area,
        building_area: request.building_area,
        purpose: request.purpose,
        basis_of_value: request.basis_of_value,
        intended_use_ar: request.intended_use_ar,
        intended_use_en: request.intended_use_en,
        intended_users_ar: request.intended_users_ar,
        intended_users_en: request.intended_users_en,
        valuation_type: request.valuation_type,
        is_portfolio: request.is_portfolio,
        scope_of_work_ar: request.scope_of_work_ar,
        scope_of_work_en: request.scope_of_work_en,
        quotation_amount: request.quotation_amount,
        total_fees: request.total_fees,
        status: request.status,
        ai_intake_summary: request.ai_intake_summary,
      },
      client: {
        profile: clientProfile ? {
          full_name_ar: clientProfile.full_name_ar,
          full_name_en: clientProfile.full_name_en,
          phone: clientProfile.phone,
          email: clientProfile.email,
        } : null,
        record: clientRecord ? {
          name_ar: clientRecord.name_ar,
          name_en: clientRecord.name_en,
          client_type: clientRecord.client_type,
          id_type: clientRecord.id_type,
          id_number: clientRecord.id_number,
          cr_number: clientRecord.cr_number,
          phone: clientRecord.phone,
          email: clientRecord.email,
          address_ar: clientRecord.address_ar,
          city_ar: clientRecord.city_ar,
        } : null,
      },
      assignment: assignment ? {
        id: assignment.id,
        reference_number: assignment.reference_number,
        status: assignment.status,
        property_type: assignment.property_type,
        purpose: assignment.purpose,
        basis_of_value: assignment.basis_of_value,
        valuation_date: assignment.valuation_date,
        report_date: assignment.report_date,
        engagement_date: assignment.engagement_date,
        priority: assignment.priority,
        qr_verification_code: assignment.qr_verification_code,
        valuation_type: assignment.valuation_type,
        is_retrospective: assignment.is_retrospective,
      } : null,
      subject,
      inspection: inspection ? {
        id: inspection.id,
        inspection_date: inspection.inspection_date,
        status: inspection.status,
        findings_ar: inspection.findings_ar,
        findings_en: inspection.findings_en,
        notes_ar: inspection.notes_ar,
        notes_en: inspection.notes_en,
        weather_conditions: inspection.weather_conditions,
        duration_minutes: inspection.duration_minutes,
        gps_verified: inspection.gps_verified,
        latitude: inspection.latitude,
        longitude: inspection.longitude,
        completed: inspection.completed,
      } : null,
      inspection_analysis: inspectionAnalysis ? {
        condition_rating: inspectionAnalysis.condition_rating,
        condition_score: inspectionAnalysis.condition_score,
        quality_score: inspectionAnalysis.quality_score,
        finishing_level: inspectionAnalysis.finishing_level,
        maintenance_level: inspectionAnalysis.maintenance_level,
        environment_quality: inspectionAnalysis.environment_quality,
        physical_depreciation_pct: inspectionAnalysis.physical_depreciation_pct,
        functional_obsolescence_pct: inspectionAnalysis.functional_obsolescence_pct,
        external_obsolescence_pct: inspectionAnalysis.external_obsolescence_pct,
        condition_adjustment_pct: inspectionAnalysis.condition_adjustment_pct,
        visible_defects: inspectionAnalysis.visible_defects,
        risk_flags: inspectionAnalysis.risk_flags,
        ai_reasoning_ar: inspectionAnalysis.ai_reasoning_ar,
        ai_confidence: inspectionAnalysis.ai_confidence,
      } : null,
      inspection_photos: inspectionPhotos,
      inspection_checklist: checklistItems,
      comparables: comparables.map((ac) => ({
        rank: ac.rank,
        weight: ac.weight,
        notes: ac.notes,
        comparable: ac.comparable ? {
          property_type: ac.comparable.property_type,
          address_ar: ac.comparable.address_ar,
          city_ar: ac.comparable.city_ar,
          district_ar: ac.comparable.district_ar,
          land_area: ac.comparable.land_area,
          building_area: ac.comparable.building_area,
          price: ac.comparable.price,
          price_per_sqm: ac.comparable.price_per_sqm,
          transaction_date: ac.comparable.transaction_date,
          transaction_type: ac.comparable.transaction_type,
          year_built: ac.comparable.year_built,
          condition: ac.comparable.condition,
          confidence_score: ac.comparable.confidence_score,
          is_verified: ac.comparable.is_verified,
        } : null,
        sources: (ac.sources || []).map((s: any) => ({
          source_name_ar: s.source_name_ar,
          source_name_en: s.source_name_en,
          source_type: s.source_type,
          reference_number: s.reference_number,
          source_date: s.source_date,
          url: s.url,
        })),
        adjustments: comparableAdjustments
          .filter((adj) => adj.assignment_comparable_id === ac.id)
          .map((adj) => ({
            label_ar: adj.label_ar,
            label_en: adj.label_en,
            adjustment_type: adj.adjustment_type,
            adjustment_percentage: adj.adjustment_percentage,
            adjustment_amount: adj.adjustment_amount,
            subject_value: adj.subject_value,
            comparable_value: adj.comparable_value,
            justification_ar: adj.justification_ar,
          })),
      })),
      document_extractions: (documentExtractions as any[]).map((d: any) => ({
        file_name: d.file_name,
        category: d.category,
        extracted_data: d.extracted_data,
      })),
      assumptions,
      reconciliation,
      compliance_checks: complianceChecks,
      portfolio_assets: portfolioAssets,
      valuer: valuerProfile,
      reviewer: reviewerProfile,
      organization: organization ? {
        name_ar: organization.name_ar,
        name_en: organization.name_en,
        license_number: organization.license_number,
        taqeem_registration: organization.taqeem_registration,
        cr_number: organization.cr_number,
        address_ar: organization.address_ar,
        city_ar: organization.city_ar,
        phone: organization.phone,
        email: organization.email,
        logo_url: organization.logo_url,
      } : null,
    };

    // ═══════════════════════════════════════════════════════════
    // MODE: collect_data — Return raw aggregated data only
    // ═══════════════════════════════════════════════════════════
    if (mode === "collect_data") {
      return new Response(JSON.stringify(aggregatedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ═══════════════════════════════════════════════════════════
    // MODE: generate_draft — AI-powered report generation
    // ═══════════════════════════════════════════════════════════
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY غير مُعدّ" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const targetSections = requestedSections?.length
      ? requestedSections
      : REPORT_SECTIONS.filter((s) => s !== "table_of_contents");

    // Build comprehensive context for AI
    const contextJson = JSON.stringify(aggregatedData, null, 0);

    const systemPrompt = `أنت "ChatGPT" — محرك ذكاء اصطناعي متخصص في كتابة تقارير التقييم العقاري المهنية.
التزم بالقواعد التالية بصرامة:

══════ معايير التقرير المهني الموحد — قواعد ملزمة ══════

【المعايير المرجعية】
- معايير التقييم الدولية IVS 2025 (المعيار 101–105، 200–230، 300–310، 400–410)
- لوائح الهيئة السعودية للمقيمين المعتمدين "تقييم" (إصدار 2024)
- معايير RICS Red Book Global Standards 2022

【أسلوب الكتابة — تنسيق مهني موحد لجميع التقارير】
- عربية فصحى مهنية بصيغة الغائب ("يرى المقيّم"، "تم معاينة العقار")
- لا يُقبل أي أسلوب غير رسمي أو مختصر أو مبسط
- لا تذكر أنك ذكاء اصطناعي أو نظام آلي
- القيم المالية بالريال السعودي (ر.س) مع الكتابة بالأرقام والحروف
- المساحات بالمتر المربع (م²)
- التواريخ بالتقويمين الهجري والميلادي عند الإمكان
- استخدم المصطلحات المعتمدة: القيمة السوقية، أسلوب المقارنة بالمبيعات، أسلوب الدخل، أسلوب التكلفة

【الأقسام الإلزامية — يجب تضمينها جميعاً بمحتوى مفصل】
1. تعريف مهمة التقييم (النطاق، الغرض، المستخدمون المقصودون)
2. أساس القيمة مع المرجع المعياري
3. نطاق العمل التفصيلي
4. وصف الأصل الشامل
5. منهجية التقييم مع تبرير الاختيار
6. التحليل والحسابات التفصيلية
7. المبررات المهنية المبنية على البيانات الفعلية
8. الافتراضات والقيود
9. تحليل المخاطر
10. بيان الامتثال
11. رأي القيمة النهائي

【هيكل كل قسم】
- عنوان رئيسي مرقّم
- فقرات مهنية متماسكة ومفصلة (لا نقاط مختصرة بدون شرح)
- إشارات مرجعية للمعايير عند الاقتضاء (مثال: "وفقاً للمعيار IVS 105")
- جداول للبيانات الرقمية والمقارنات
- خلاصة أو نتيجة في نهاية كل قسم

【المبررات المهنية】
- تستند إلى بيانات فعلية — لا صياغات عامة
- تشرح كل قرار بوضوح مع السبب
- تعكس المخاطر والافتراضات
- متسقة عبر جميع الأقسام

【الدقة والمحظورات】
- لا تختلق بيانات غير موجودة في السياق المقدّم
- إذا كانت بيانات ناقصة، اذكر "[يُستكمل لاحقاً]"
- الحسابات المالية يجب أن تكون متسقة منطقياً
- لا أقسام فارغة أو ناقصة أو مبسطة
- لا تفاوت في المستوى المهني بين الأقسام
- كل تقرير يتبع نفس التنسيق المهني الموحد بغض النظر عن نوع العميل

【الهدف النهائي】
كل تقرير يجب أن يكون جاهزاً للتقديم الرسمي إلى البنوك والمحاكم والجهات الحكومية بدون أي تعديل.

عند طلب إخراج JSON، أعد JSON فقط بدون أي نص إضافي أو markdown.`;

    const sectionDescriptions: Record<string, string> = {
      cover_page: "صفحة الغلاف: اسم المنشأة، شعار الشركة، عنوان التقرير، الرقم المرجعي، تاريخ التقرير، بيانات العميل، تصنيف السرية",
      executive_summary: "الملخص التنفيذي: ملخص شامل يتضمن الغرض، وصف مختصر للعقار، المنهجية المتبعة، القيمة النهائية بالأرقام والحروف، تاريخ التقييم",
      engagement_letter: "خطاب التكليف: تفاصيل التكليف والاتفاق بين المقيّم والعميل",
      purpose_and_intended_use: "الغرض من التقييم والاستخدام المقصود: غرض التقييم، أساس القيمة (IVS 104)، المستخدمون المقصودون، القيود على الاستخدام",
      scope_of_work: "نطاق العمل: التحقيقات المنفذة، مصادر المعلومات، الافتراضات الجوهرية، القيود (IVS 101)",
      property_identification: "تعريف العقار: رقم الصك، رقم المخطط، رقم القطعة، الإحداثيات الجغرافية، المساحة حسب الصك",
      property_description: "وصف العقار: الوصف الإنشائي التفصيلي، المواصفات، المرافق، الحالة العامة، الصيانة، عمر المبنى",
      legal_description: "الوصف القانوني: الملكية، الحقوق العينية، الأعباء، القيود التنظيمية، تصنيف الاستخدام",
      location_analysis: "تحليل الموقع: المنطقة والحي، المرافق المحيطة، البنية التحتية، إمكانية الوصول، المزايا والعيوب",
      market_overview: "نظرة عامة على السوق العقاري: اتجاهات السوق المحلي، العرض والطلب، متوسط الأسعار، التطورات المستقبلية",
      highest_and_best_use: "الاستخدام الأعلى والأفضل (HBU): التحليل الرباعي — الممكن قانونياً، الممكن مادياً، المجدي مالياً، الأعلى إنتاجية (IVS 105)",
      valuation_approaches: "أساليب التقييم المستخدمة: تبرير اختيار الأساليب وأسباب استبعاد أي أسلوب (IVS 105)",
      sales_comparison_approach: "أسلوب المقارنة بالمبيعات: جدول المقارنات، التعديلات التفصيلية لكل عنصر مقارنة، القيمة المستنتجة",
      cost_approach: "أسلوب التكلفة: تكلفة الإحلال/الاستبدال، الإهلاك المادي والوظيفي والاقتصادي، قيمة الأرض المجردة",
      income_approach: "أسلوب الدخل: الدخل الإجمالي، المصروفات التشغيلية، صافي الدخل، معدل الرسملة، القيمة المستنتجة",
      reconciliation: "التسوية والمطابقة: أوزان الأساليب المستخدمة، تبرير الترجيح، القيمة النهائية المستنتجة بالأرقام والحروف (IVS 105)",
      assumptions_and_limiting_conditions: "الافتراضات والشروط المقيّدة: الافتراضات العامة والخاصة، القيود، إخلاء المسؤولية (IVS 101)",
      compliance_statement: "بيان الامتثال: إقرار المقيّم بالالتزام بمعايير IVS 2025 وأنظمة تقييم، بيان الاستقلالية وعدم تعارض المصالح",
      valuer_certification: "شهادة المقيّم: بيانات المقيّم المعتمد، رقم العضوية، التوقيع، الختم الرسمي",
      appendices: "الملاحق: قائمة المرفقات (صور المعاينة، خرائط، مستندات الملكية، بيانات المقارنات)",
    };

    const sectionsInstructions = targetSections
      .map((key, i) => `${i + 1}. ${key}: ${sectionDescriptions[key] || key}`)
      .join("\n");

    const userPrompt = `بناءً على البيانات التالية، قم بتوليد مسودة تقرير تقييم عقاري كامل ومهني.

═══════════════════════════════════
البيانات المُجمَّعة:
═══════════════════════════════════
${contextJson}

═══════════════════════════════════
الأقسام المطلوبة:
═══════════════════════════════════
${sectionsInstructions}

═══════════════════════════════════
تعليمات الإخراج:
═══════════════════════════════════
أعد JSON بالهيكل التالي فقط (بدون markdown أو نص إضافي):
{
  "report_title_ar": "عنوان التقرير بالعربية",
  "report_title_en": "Report title in English",
  "reference_number": "الرقم المرجعي",
  "report_date": "تاريخ التقرير",
  "sections": {
    "<section_key>": {
      "title_ar": "عنوان القسم بالعربية",
      "title_en": "Section title in English",
      "content_ar": "المحتوى المهني الكامل بالعربية (فقرات كاملة مع إشارات مرجعية)",
      "content_en": "Full professional content in English",
      "tables": [
        {
          "caption_ar": "عنوان الجدول",
          "headers": ["عمود 1", "عمود 2"],
          "rows": [["قيمة", "قيمة"]]
        }
      ]
    }
  },
  "final_value": {
    "amount": 0,
    "currency": "SAR",
    "text_ar": "القيمة بالحروف العربية",
    "text_en": "Value in English words",
    "effective_date": "تاريخ سريان القيمة",
    "basis_of_value_ar": "أساس القيمة",
    "confidence_level": "high|medium|low"
  },
  "metadata": {
    "standards_referenced": ["IVS 2025", "تقييم"],
    "approaches_used": ["المقارنة", "التكلفة", "الدخل"],
    "data_completeness_pct": 0,
    "sections_needing_review": ["أقسام تحتاج مراجعة يدوية"],
    "missing_data_items": ["بيانات ناقصة يجب استكمالها"]
  }
}`;

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 16000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const errorMap: Record<number, string> = {
        429: "تم تجاوز حد الطلبات، يرجى المحاولة لاحقاً",
        402: "يرجى إضافة رصيد لاستخدام خدمات الذكاء الاصطناعي",
      };
      const errorMsg = errorMap[status] || "خطأ في خدمة الذكاء الاصطناعي";
      const details = await aiResponse.text();
      console.error("AI gateway error:", status, details);
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: status === 429 || status === 402 ? status : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "";

    // Parse AI response — strip markdown fences if present
    let reportDraft;
    try {
      const cleaned = rawContent
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      reportDraft = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response as JSON, returning raw");
      return new Response(
        JSON.stringify({
          success: false,
          error: "فشل في تحليل استجابة الذكاء الاصطناعي كـ JSON",
          raw_content: rawContent,
          aggregated_data: aggregatedData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: "generate_draft",
        report_draft: reportDraft,
        aggregated_data: aggregatedData,
        generated_at: new Date().toISOString(),
        ai_model: "openai/gpt-5",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير معروف" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
