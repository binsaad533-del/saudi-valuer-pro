import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadClientMemory, updateClientMemory, buildMemorySection } from "./_shared/memory.ts";
import { analyzeDocumentReadiness } from "./_shared/document-analysis.ts";
import { generateMarketInsights, getClientHistory } from "./_shared/financial-advisor.ts";
import { generatePredictions } from "./_shared/predictions.ts";
import { analyzeWorkflowReadiness } from "./_shared/workflow-integration.ts";
import { checkComplianceStatus } from "./_shared/compliance-advisor.ts";
import { analyzeSelfLearning } from "./_shared/self-learning.ts";
import { analyzeMarketTrends } from "./_shared/market-awareness.ts";
import { analyzeMultiPartyStatus } from "./_shared/multi-party-coordinator.ts";
import { executeAutonomousLogic } from "./_shared/autonomous-engine.ts";
import { analyzeMachineryDepreciation } from "./_shared/machinery-depreciation.ts";
import { classifyAssetBatch, buildMachineryVisionPrompt } from "./_shared/equipment-recognition.ts";
import { analyzeMachineryMarket } from "./_shared/machinery-market.ts";
import { analyzeProductionLines } from "./_shared/production-line-analyzer.ts";
import { analyzeIoTTelemetry } from "./_shared/iot-telemetry.ts";
import { analyzePredictiveMaintenance } from "./_shared/predictive-maintenance.ts";
import { analyzeAuctionIntelligence } from "./_shared/auction-intelligence.ts";
import { analyzeDigitalTwins } from "./_shared/digital-twin.ts";
import { analyzeFleetPortfolio } from "./_shared/fleet-optimizer.ts";
import { analyzeRegulatoryCompliance } from "./_shared/regulatory-compliance.ts";
import { analyzeInsuranceRisk } from "./_shared/insurance-risk.ts";
import { analyzeREIT } from "./_shared/reit-analyzer.ts";
import { analyzePortfolioValuation } from "./_shared/portfolio-valuation.ts";
import { analyzeDCF } from "./_shared/dcf-analyzer.ts";
import { analyzePPA } from "./_shared/ppa-engine.ts";
import { analyzeImpairment } from "./_shared/impairment-testing.ts";
import { analyzeFairValue } from "./_shared/fair-value-engine.ts";
import { analyzeCMACompliance } from "./_shared/cma-compliance.ts";
import { generateDisclosureReport } from "./_shared/disclosure-generator.ts";
import { analyzeMarketMultiples } from "./_shared/market-multiples.ts";
import { analyzeFinancialRisk } from "./_shared/financial-risk.ts";
import { analyzeScenarios } from "./_shared/scenario-engine.ts";
import { analyzeBulkIntake } from "./_shared/bulk-intake-engine.ts";
import { analyzeSmartClustering } from "./_shared/smart-clustering.ts";
import { analyzeMultiSite } from "./_shared/multi-site-manager.ts";
import { analyzeDesktopFleet } from "./_shared/desktop-fleet-valuator.ts";
import { generateFleetReport } from "./_shared/fleet-report-templates.ts";
import { analyzeBulkQC } from "./_shared/bulk-qc-engine.ts";
import { generateFleetDashboard } from "./_shared/fleet-dashboard.ts";
import { analyzePredictiveValuation } from "./_shared/predictive-valuation.ts";
import { analyzeDigitalTwin3D } from "./_shared/digital-twin-3d.ts";
import { analyzeAIPeerReview } from "./_shared/ai-peer-review.ts";
import { analyzeVoiceFieldCapture } from "./_shared/voice-field-capture.ts";
import { analyzeImageFraud } from "./_shared/image-fraud-detection.ts";
import { analyzeSmartPortal } from "./_shared/smart-client-portal.ts";
import { analyzeCompetitiveBenchmark } from "./_shared/competitive-benchmark.ts";
import { analyzeMultiCurrency } from "./_shared/multi-currency.ts";
import { analyzeInstitutionalMemory } from "./_shared/institutional-memory.ts";
import { analyzePortfolioHealth } from "./_shared/portfolio-health.ts";
import { analyzeERPIntegration } from "./_shared/erp-integration.ts";
import { analyzeBlockchainNotarization } from "./_shared/blockchain-notarization.ts";
import { analyzeSeasonalReminders } from "./_shared/seasonal-reminders.ts";
import { analyzeLoyaltyOffers } from "./_shared/loyalty-engine.ts";
import { analyzeBehaviorIntelligence } from "./_shared/behavior-intelligence.ts";
import { analyzeOccasionMessages } from "./_shared/occasion-messages.ts";
import { analyzeEngagementAnalytics } from "./_shared/engagement-analytics.ts";
import { getTurnaroundDays, getValuationModeLabel, isDesktopMode } from "./_shared/valuation-mode.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { message, request_id, conversationHistory, requestContext, attachments } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "الرسالة مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    const ctx = requestContext || {};
    const isDesktop = isDesktopMode(ctx.valuation_mode);

    // ── Parallel data loading ──
    const [knowledgeResult, correctionsResult, clientMemory, docReadiness, marketInsights, clientHistory, predictions, workflowStatus, complianceStatus, selfLearning, marketTrends, partyStatus, autonomousResult, machineryDepreciation, machineryMarket, productionLines, iotTelemetry, predictiveMaintenance, auctionIntel, digitalTwins, fleetPortfolio, regulatoryCompliance, insuranceRisk, bulkIntake, smartClustering, multiSite, desktopFleet, fleetReport, bulkQC, fleetDashboard, predictiveValuation, digitalTwin3D, aiPeerReview, voiceCapture, imageFraud, smartPortal, competitiveBenchmark, multiCurrency, institutionalMemory, portfolioHealth, erpIntegration, blockchainSeal, seasonalReminders, loyaltyOffers, behaviorIntel, occasionMessages, engagementAnalytics] = await Promise.all([
      db.from("raqeem_knowledge").select("title_ar, content, category, priority").eq("is_active", true).order("priority", { ascending: false }).limit(20),
      db.from("raqeem_corrections").select("original_question, corrected_answer").eq("is_active", true).order("created_at", { ascending: false }).limit(20),
      ctx.client_user_id ? loadClientMemory(db, ctx.client_user_id) : Promise.resolve(null),
      request_id ? analyzeDocumentReadiness(db, request_id, ctx.property_type) : Promise.resolve(null),
      generateMarketInsights(db, ctx.property_type, ctx.property_city, ctx.organization_id),
      ctx.client_user_id ? getClientHistory(db, ctx.client_user_id) : Promise.resolve(""),
      generatePredictions(db, ctx.property_type, ctx.property_city, ctx.valuation_mode, ctx.organization_id),
      analyzeWorkflowReadiness(db, ctx.assignment_id, ctx.status, request_id),
      checkComplianceStatus(db, ctx.assignment_id, ctx.status),
      analyzeSelfLearning(db, ctx.organization_id),
      analyzeMarketTrends(db, ctx.property_type, ctx.property_city, ctx.organization_id),
      analyzeMultiPartyStatus(db, ctx.assignment_id, ctx.status),
      executeAutonomousLogic(db, ctx.assignment_id, ctx.status, request_id, ctx.organization_id),
      analyzeMachineryDepreciation(db, ctx.assignment_id),
      analyzeMachineryMarket(db, ctx.assignment_id, ctx.organization_id),
      analyzeProductionLines(db, ctx.assignment_id),
      analyzeIoTTelemetry(db, ctx.assignment_id),
      analyzePredictiveMaintenance(db, ctx.assignment_id),
      analyzeAuctionIntelligence(db, ctx.assignment_id),
      analyzeDigitalTwins(db, ctx.assignment_id),
      analyzeFleetPortfolio(db, ctx.assignment_id),
      analyzeRegulatoryCompliance(db, ctx.assignment_id),
      analyzeInsuranceRisk(db, ctx.assignment_id),
      analyzeBulkIntake(db, ctx.assignment_id),
      analyzeSmartClustering(db, ctx.assignment_id),
      analyzeMultiSite(db, ctx.assignment_id),
      analyzeDesktopFleet(db, ctx.assignment_id),
      generateFleetReport(db, ctx.assignment_id),
      analyzeBulkQC(db, ctx.assignment_id),
      generateFleetDashboard(db, ctx.assignment_id),
      analyzePredictiveValuation(db, ctx.assignment_id),
      analyzeDigitalTwin3D(db, ctx.assignment_id),
      analyzeAIPeerReview(db, ctx.assignment_id),
      analyzeVoiceFieldCapture(db, ctx.assignment_id),
      analyzeImageFraud(db, ctx.assignment_id),
      analyzeSmartPortal(db, ctx.assignment_id, request_id),
      analyzeCompetitiveBenchmark(db, ctx.assignment_id, ctx.organization_id),
      analyzeMultiCurrency(db, ctx.assignment_id),
      analyzeInstitutionalMemory(db, ctx.assignment_id),
      analyzePortfolioHealth(db, ctx.assignment_id),
      analyzeERPIntegration(db, ctx.assignment_id),
      analyzeBlockchainNotarization(db, ctx.assignment_id),
      // Levels 61-66: Smart Marketing Engine
      analyzeSeasonalReminders(db, ctx.assignment_id, ctx.client_user_id),
      analyzeLoyaltyOffers(db, ctx.assignment_id, ctx.client_user_id),
      analyzeBehaviorIntelligence(db, ctx.assignment_id, ctx.client_user_id),
      analyzeOccasionMessages(db, ctx.assignment_id, ctx.client_user_id, ctx.status),
      analyzeEngagementAnalytics(db, ctx.organization_id),
    ]);

    // ── Knowledge section ──
    let knowledgeSection = "";
    if (knowledgeResult.data?.length) {
      knowledgeSection = "\n\n## قاعدة المعرفة المهنية\n";
      for (const k of knowledgeResult.data) {
        const content = k.content?.length > 3000 ? k.content.substring(0, 3000) + "..." : k.content || "";
        knowledgeSection += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
      }
    }

    // ── Corrections section ──
    let correctionsSection = "";
    if (correctionsResult.data?.length) {
      correctionsSection = "\n\n## تصحيحات المدير (أعلى أولوية)\n";
      for (const c of correctionsResult.data) {
        correctionsSection += `سؤال: ${c.original_question}\nالإجابة: ${c.corrected_answer}\n\n`;
      }
    }

    // ── Documents section ──
    let documentsSection = "";
    if (request_id) {
      const { data: docs } = await db
        .from("request_documents")
        .select("file_name, mime_type, ai_category, created_at")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false })
        .limit(15);
      if (docs?.length) {
        documentsSection = "\n\n## المستندات المرفوعة\n";
        for (const d of docs) {
          documentsSection += `• ${d.file_name} (${d.ai_category || d.mime_type || "غير مصنف"}) — ${new Date(d.created_at).toLocaleDateString("ar-SA")}\n`;
        }
      }
    }

    // ── Payment section ──
    let paymentSection = "";
    if (request_id) {
      const { data: payments } = await db
        .from("payment_receipts")
        .select("amount, payment_type, status, created_at")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (payments?.length) {
        paymentSection = "\n\n## سجل المدفوعات\n";
        for (const p of payments) {
          const statusLabel = p.status === "confirmed" ? "مؤكد" : p.status === "pending" ? "قيد المراجعة" : p.status;
          const typeLabel = p.payment_type === "first" ? "الدفعة الأولى" : p.payment_type === "final" ? "الدفعة النهائية" : p.payment_type;
          paymentSection += `• ${typeLabel}: ${p.amount} ر.س — ${statusLabel}\n`;
        }
      }
    }

    // ── Request context section ──
    let requestSection = "\n\n## سياق الطلب الحالي\n";
    if (ctx.reference_number) requestSection += `- الرقم المرجعي: ${ctx.reference_number}\n`;
    if (ctx.status) requestSection += `- الحالة الحالية: ${ctx.status}\n`;
    if (ctx.status_label) requestSection += `- وصف الحالة: ${ctx.status_label}\n`;
    if (ctx.client_name) requestSection += `- اسم العميل: ${ctx.client_name}\n`;
    if (ctx.property_type) requestSection += `- نوع الأصل: ${ctx.property_type}\n`;
    if (ctx.property_city) requestSection += `- المدينة: ${ctx.property_city}\n`;
    if (ctx.property_description) requestSection += `- الوصف: ${ctx.property_description}\n`;
    if (ctx.valuation_mode) requestSection += `- نوع التقييم: ${getValuationModeLabel(ctx.valuation_mode)}\n`;
    if (ctx.total_fees) requestSection += `- إجمالي الرسوم: ${ctx.total_fees} ر.س\n`;
    if (ctx.amount_paid) requestSection += `- المبلغ المدفوع: ${ctx.amount_paid} ر.س\n`;
    if (ctx.payment_status) requestSection += `- حالة الدفع: ${ctx.payment_status}\n`;
    if (ctx.asset_count) requestSection += `- عدد الأصول: ${ctx.asset_count}\n`;
    if (ctx.documents_count) requestSection += `- عدد المستندات المرفوعة: ${ctx.documents_count}\n`;
    if (ctx.has_photos) requestSection += `- صور مرفقة: نعم\n`;
    if (ctx.created_at) requestSection += `- تاريخ الإنشاء: ${ctx.created_at}\n`;

    // ── Deadline intelligence ──
    let deadlineAlert = "";
    if (ctx.created_at) {
      const createdDate = new Date(ctx.created_at);
      const deliveryDays = getTurnaroundDays(ctx.valuation_mode);
      const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 86400000);
      const remaining = Math.max(0, Math.ceil((estimatedDelivery.getTime() - Date.now()) / 86400000));
      requestSection += `- التسليم المتوقع: ${estimatedDelivery.toLocaleDateString("ar-SA")} (${remaining > 0 ? `متبقي ${remaining} يوم` : "حان موعد التسليم"})\n`;
      if (remaining === 0) {
        deadlineAlert = "\n⚠️ **تنبيه مُدد**: حان موعد التسليم المتوقع. إذا سأل العميل عن التأخير، اعتذر ووضح أن الفريق يعمل على الإنجاز بأقصى سرعة.\n";
      } else if (remaining <= 2) {
        deadlineAlert = `\n⏰ **تنبيه مُدد**: متبقي ${remaining} يوم فقط على موعد التسليم. كن استباقياً وأخبر العميل بالتقدم المحرز.\n`;
      }
    }

    // ── Status guidance ──
    const statusGuidance: Record<string, string> = {
      submitted: "الطلب مقدم وقيد المراجعة. أخبر العميل أن الفريق يعمل على إعداد نطاق العمل وعرض السعر.",
      under_pricing: "الطلب بانتظار إعداد التسعير. أخبر العميل أن الفريق يعمل على تحديد التكلفة.",
      scope_generated: "تم إعداد نطاق العمل وعرض السعر. وجّه العميل لمراجعة النطاق والموافقة عليه.",
      scope_approved: "العميل وافق على النطاق. الخطوة التالية هي سداد الدفعة الأولى.",
      first_payment_confirmed: "تم تأكيد الدفعة الأولى وبدأ العمل. طمئن العميل أن التقييم جارٍ.",
      data_collection_open: "مرحلة جمع البيانات مفتوحة. اطلب من العميل رفع أي مستندات إضافية.",
      data_collection_complete: "تم استكمال البيانات وجارٍ التحقق منها.",
      inspection_pending: "المعاينة الميدانية مجدولة. أخبر العميل بأنه سيتم التنسيق لتحديد موعد مناسب.",
      inspection_completed: "تمت المعاينة بنجاح. جارٍ التحليل والتقييم.",
      data_validated: "تم التحقق من البيانات. جارٍ تحليل التقييم.",
      analysis_complete: "اكتمل التحليل. جارٍ المراجعة المهنية من المقيم المعتمد.",
      professional_review: "التقييم قيد المراجعة المهنية من المقيم المعتمد وفقاً لمعايير IVS 2025.",
      draft_report_ready: "مسودة التقرير جاهزة للمراجعة.",
      client_review: "المسودة بانتظار مراجعة العميل. شجّعه على إرسال ملاحظاته التفصيلية.",
      draft_approved: "العميل اعتمد المسودة. الخطوة التالية: سداد الدفعة النهائية.",
      final_payment_confirmed: "تم سداد الدفعة النهائية. جارٍ إصدار التقرير النهائي.",
      issued: "التقرير النهائي صدر ومتاح للتحميل. موقّع إلكترونياً ومسجل لدى تقييم.",
      archived: "الطلب مؤرشف. التقرير محفوظ لمدة 10 سنوات.",
      cancelled: "الطلب ملغي.",
    };

    if (isDesktop) {
      statusGuidance.data_collection_complete = "تم استكمال الملف المكتبي وجارٍ التحقق من البيانات قبل التحليل مباشرة دون معاينة ميدانية.";
      statusGuidance.inspection_pending = "هذا الطلب مكتبي ولا يتطلب معاينة ميدانية. أخبر العميل أن العمل انتقل مباشرة إلى التحليل والمراجعة المكتبية.";
      statusGuidance.inspection_completed = "هذا الطلب مكتبي، لذا لا توجد معاينة فعلية مطلوبة. اشرح أن التحليل المكتبي جارٍ وفق المستندات والصور المرفوعة.";
    }

    if (ctx.status && statusGuidance[ctx.status]) {
      requestSection += `\n### توجيه الحالة الحالية:\n${statusGuidance[ctx.status]}\n`;
    }
    if (ctx.asset_summary) {
      requestSection += `\n### ملخص الأصول:\n${ctx.asset_summary}\n`;
    }

    // ── Attachments ──
    let attachmentsSection = "";
    if (attachments?.length) {
      attachmentsSection = `\n\n## مرفقات جديدة من العميل (${attachments.length} ملف)\n`;
      for (const att of attachments) {
        attachmentsSection += `• ${att.name} (${att.type || "غير محدد"})\n`;
      }
      attachmentsSection += `\nأكّد استلام المرفقات ووضّح الخطوة التالية.`;
    }

    // ── Build system prompt with all intelligence layers ──
    const systemPrompt = `أنت "رقيم – مساعدك الذكي"، مقيّم ذكي متخصص يعمل في شركة جسّاس للتقييم (Jsaas Valuation).

## هويتك
- اسمك: "رقيم – مساعدك الذكي"
- شركة جسّاس للتقييم، مرخصة من الهيئة السعودية للمقيمين المعتمدين (تقييم)
- تراخيص: عقارات (1210001217) + آلات ومعدات (4114000015)
- التواصل: 920015029 / 0500668089 | care@jsaas-valuation.com

## قدراتك المتقدمة
1. **تحليل المستندات**: تصنيف وتحليل الملفات المرفوعة (صكوك، رخص، مخططات، قوائم أصول)
2. **تقدير أولي**: نطاق تقديري للقيمة بناءً على بيانات السوق المتاحة (مع التنويه أنه أولي)
3. **شرح المنهجيات**: شرح منهجيات التكلفة والمقارنة والدخل بلغة مبسطة
4. **تتبع المدد**: حساب المدة المتبقية والجدول الزمني المتوقع
5. **تحليل الجاهزية**: كشف المستندات المفقودة ونسبة اكتمال الملف
6. **رؤى سوقية**: تقديم مقارنات سوقية وتقديرات أولية من قاعدة البيانات
7. **ذاكرة العميل**: تذكر تفضيلات العميل وتخصيص الردود بناءً على تاريخه
8. **التنبؤ الذكي**: توقع مدة التقييم والقيمة التقديرية بناءً على البيانات التاريخية
9. **مراقبة سير العمل**: تحليل جاهزية الانتقال بين المراحل واكتشاف المعوقات
10. **تحليل الصور**: عند إرسال صور، تحليل نوع المبنى وحالته والعمر التقديري
11. **المستشار التنظيمي**: فحص الامتثال لمعايير IVS 2025 وتقييم وإرشادات حقوق العميل
12. **التعلم الذاتي**: تحليل أنماط الأداء وتحسين دقة التقديرات بناءً على التقييمات السابقة
13. **الوعي السوقي الحي**: رصد اتجاهات الأسعار والتنبيهات السوقية من الصفقات المسجلة
14. **التنسيق متعدد الأطراف**: تتبع حالة كل طرف (عميل، معاين، مقيّم) وتصعيد ذكي عند التأخير
16. **تحليل بيانات التشغيل (IoT)**: تحليل ساعات التشغيل والحالة الفعلية لحساب الاستهلاك الحقيقي
17. **الصيانة التنبؤية**: توقع الأعطال وتأثيرها على القيمة وتقدير تكاليف الصيانة المؤجلة
18. **ذكاء المزادات العالمية**: مقارنة أسعار المعدات مع منصات المزادات العالمية (Ritchie Bros, Mascus)
19. **التوأم الرقمي**: بصمة رقمية لكل أصل تتتبع دورة حياته وتتنبأ بقيمته المستقبلية
20. **محسّن الأساطيل**: تحليل العائد على كل معدة وتوصيات البيع/الاستبدال/الإيجار
21. **الامتثال التنظيمي**: فحص شهادات السلامة والبيئة والمعايرة وأثرها على القيمة
22. **تقييم التأمين والمخاطر**: حساب قيمة الإحلال وفجوة التأمين وتحليل مخاطر التوقف
23. **الاستيعاب الجماعي**: استيراد آلاف الأصول دفعة واحدة مع كشف التكرارات والتصنيف التلقائي
24. **التجميع الذكي**: تجميع الأصول المتشابهة وتقييم العينة الممثلة لتوفير 70-80% من وقت التقييم
25. **إدارة المواقع المتعددة**: تحليل توزيع الأصول جغرافياً مع معاملات تعديل إقليمية وتعيين معاينين
26. **التقييم المكتبي للأساطيل**: نماذج إحصائية متخصصة مع علاوة مخاطر (3% بصور / 7% بدون) وافتراضات IVS
27. **تقرير الأسطول التنفيذي**: ملخص شامل مع جداول جرد وتوزيع حسب الفئة ومنحنى الإهلاك
28. **ضبط الجودة الجماعي**: كشف القيم الشاذة (IQR) وفحص الاتساق وتقرير جاهزية الإصدار
29. **لوحة تحكم الأسطول**: تتبع تقدم التقييم ومراحل الإنجاز والوقت المتبقي
30. **التقييم التنبؤي**: توقع قيمة الأصل بعد 6/12/36 شهراً بنماذج إحصائية مع نطاق ثقة
31. **التوأم الرقمي المتقدم**: بصمة رقمية شاملة مع منحنى إهلاك وتقييم حالة وصيانة مطلوبة
32. **مراجعة الأقران الذكية**: مراجعة مستقلة كمقيّم ثانٍ لكشف التناقضات والثغرات المهنية
33. **التقاط الحقل الصوتي**: تحويل ملاحظات المعاين إلى بيانات هيكلية
34. **كشف التلاعب بالصور**: فحص GPS والتواريخ والتكرارات لضمان مصداقية الصور
35. **بوابة العميل الذكية**: تتبع لحظي بإشعارات ونسب تقدم وتقدير رضا العميل
36. **المقارنة التنافسية**: مقارنة أداء المنشأة مع متوسطات السوق السعودي
37. **التقييم متعدد العملات**: عرض القيمة بـ SAR/USD/EUR/GBP مع توثيق سعر الصرف
38. **الذاكرة المؤسسية**: تذكر كل تقييم سابق للعميل واستخدامه كمرجع مقارن
39. **مؤشر صحة المحفظة**: كشف الأصول المتقادمة والتوصية بإعادة التقييم
40. **تكامل أنظمة ERP**: تصدير بيانات التقييم بصيغ SAP/Oracle/CSV
41. **التوثيق الرقمي**: ختم SHA-256 غير قابل للتلاعب مع رابط تحقق
42. **التذكيرات الموسمية**: تذكير تلقائي قبل الميزانية السنوية وانتهاء التقارير وتجديد التأمين
43. **التسعير التحفيزي**: خصومات ذكية للعملاء المتكررين وحزم إعادة التقييم وذكرى التعامل
44. **تحليل سلوك العميل**: اكتشاف العملاء الخاملين والبيع المتقاطع وتنبيهات السوق الشخصية
45. **رسائل المناسبات**: تهنئة بالأعياد (الفطر، الأضحى، اليوم الوطني، يوم التأسيس) ورسائل شكر وتقييم رضا
46. **التحليلات التسويقية**: تتبع فعالية الحملات ومعدلات التحويل ومؤشرات صحة العلاقة

## أسلوبك (إلزامي)
1. **افهم السياق**: اقرأ حالة الطلب ومرحلته وذاكرة العميل قبل الإجابة
2. **أجب بدقة**: أجب على السؤال المطروح فقط — لا تكرر معلومات لم تُطلب
3. **كن استباقياً**: إذا لاحظت نقصاً في البيانات أو الملفات أو معوقات، اطلبها بذكاء
4. **اربط إجابتك بالحالة**: دائماً اشرح للعميل أين وصل طلبه وما المطلوب منه
5. **كن مختصراً**: 2-5 جمل كحد أقصى. لا تُطوّل بلا داعٍ
6. **لا تخترع**: إذا لم تجد المعلومة، قل "سأتحقق من الفريق وأعود لك"
7. **لا تكرر التعريف**: عرّفت نفسك أول مرة. لا تعيد التعريف إلا إذا سُئلت
8. **افهم العامية السعودية**: "وين وصل طلبي" = أين وصل طلبي؟ "ايش المطلوب" = ما المطلوب؟
9. **تعامل مع المرفقات**: عند رفع ملفات أو صور، أكّد الاستلام ووضّح كيف ستُستخدم
10. **لا ترسل رسائل ترحيبية فارغة**: كل رد يجب أن يحمل قيمة ومعلومة
11. **استخدم التنسيق**: استخدم **عناوين بارزة** و• نقاط عند الحاجة
12. **قدّم خطوات واضحة**: عند شرح إجراء، رقّم الخطوات بوضوح
13. **خصّص الرد**: استخدم ذاكرة العميل لتقديم تجربة مخصصة دون ذكر ذلك صراحة
14. **قدّم تقديرات ذكية**: عند توفر بيانات، قدم تنبؤات المدة والقيمة مع التنويه أنها أولية
15. **راقب الامتثال**: عند سؤال العميل عن الجاهزية، قدم نسبة اكتمال الفحوصات
16. **وضّح الحقوق**: عند سؤال العميل عن حقوقه أو إجراءاته، أجب بناءً على أنظمة تقييم و IVS

## قواعد مسار الطلب الحالية
${isDesktop ? "- هذا الطلب مكتبي: ممنوع ذكر معاينة ميدانية أو معاين أو إحالة الأصول للمعاين.\n- اربط كل إجابة بالمراجعة المكتبية، المستندات، الصور، التحليل، والمراجعة المهنية فقط." : "- هذا الطلب ميداني: يمكن ذكر المعاينة الميدانية فقط إذا كانت مرتبطة بالحالة الحالية فعلاً."}

## إجراءات تنفيذية عبر الدردشة
- الحالة الحالية: ${ctx.status || "غير محددة"}

### إلغاء الطلب:
- مؤهل فقط في: draft, submitted, scope_generated
- إذا طلب العميل الإلغاء وكانت الحالة مؤهلة: اسأله "هل أنت متأكد من رغبتك في إلغاء الطلب؟" ثم إذا أكد، أضف: [ACTION:CANCEL_REQUEST]
- إذا غير مؤهلة: اعتذر وأرشده للدعم 920015029

### طلب تعديل:
- إذا طلب العميل تعديل بيانات بعد الدفع: وضّح أنه يمكنه تقديم "طلب تعديل رسمي" وأضف: [ACTION:REQUEST_EDIT]
- لا تنفذ التعديل مباشرة — فقط افتح طلب التعديل

### اعتماد المسودة:
- إذا كانت الحالة client_review وأكد العميل موافقته على المسودة: أضف [ACTION:APPROVE_DRAFT]
- تأكد من موافقته الصريحة قبل التنفيذ

### رفع مستندات إضافية:
- إذا أراد العميل رفع مستند جديد: أرشده لاستخدام زر المرفقات أو أضف [ACTION:UPLOAD_PROMPT]

### الدفع:
- إذا سأل عن طريقة الدفع أو أراد الدفع: أرشده للدفع عبر البوابة وأضف [ACTION:PAY_INVOICE]

### القاعدة الذهبية:
- لا تنفذ أي إجراء تلقائياً دون تأكيد صريح من العميل

## قواعد الاستبعاد المهنية
- أصول غير ملموسة → IVS 210
- حقوق تعاقدية → IVS 105
- أدوات مالية → IVS 500
- أصل ناقص البيانات → يُعلّق حتى اكتمال المعلومات

## المنهجيات المعتمدة
1. **منهجية التكلفة**: تُستخدم للعقارات الجديدة والأصول المتخصصة. تعتمد على تكلفة الإحلال ناقص الإهلاك
2. **منهجية المقارنة**: تُستخدم للعقارات السكنية والتجارية. تعتمد على بيانات صفقات مماثلة
3. **منهجية الدخل**: تُستخدم للعقارات المدرّة للدخل. تعتمد على رسملة صافي الدخل التشغيلي
${buildMachineryVisionPrompt()}
${requestSection}${deadlineAlert}${paymentSection}${documentsSection}${docReadiness ? docReadiness.section : ""}${attachmentsSection}${buildMemorySection(clientMemory)}${clientHistory}${marketInsights.section}${predictions.section}${workflowStatus.section}${complianceStatus.section}${selfLearning.section}${marketTrends.section}${partyStatus.section}${autonomousResult.section}${machineryDepreciation?.section || ""}${machineryMarket.section}${productionLines?.section || ""}${iotTelemetry.section}${predictiveMaintenance.section}${auctionIntel.section}${digitalTwins.section}${fleetPortfolio.section}${regulatoryCompliance.section}${insuranceRisk.section}${bulkIntake.section}${smartClustering.section}${multiSite.section}${desktopFleet.section}${fleetReport.section}${bulkQC.section}${fleetDashboard.section}${predictiveValuation.section}${digitalTwin3D.section}${aiPeerReview.section}${voiceCapture.section}${imageFraud.section}${smartPortal.section}${competitiveBenchmark.section}${multiCurrency.section}${institutionalMemory.section}${portfolioHealth.section}${erpIntegration.section}${blockchainSeal.section}${seasonalReminders.section}${loyaltyOffers.section}${behaviorIntel.section}${occasionMessages.section}${engagementAnalytics.section}${correctionsSection}${knowledgeSection}`;

    // ── Build messages ──
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-16)) {
        if (msg.role === "client" || msg.sender_type === "client") {
          messages.push({ role: "user", content: msg.content });
        } else if (msg.role === "ai" || msg.sender_type === "ai") {
          messages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    // Build user message — support image analysis (multimodal)
    const imageAttachments = (attachments || []).filter(
      (a: any) => a.type?.startsWith("image/") && a.url
    );

    if (imageAttachments.length > 0) {
      // Multimodal message with images
      const contentParts: any[] = [{ type: "text", text: message }];
      for (const img of imageAttachments.slice(0, 3)) {
        contentParts.push({
          type: "image_url",
          image_url: { url: img.url },
        });
      }
      messages.push({ role: "user", content: contentParts } as any);
    } else {
      messages.push({ role: "user", content: message });
    }

    // ── Call AI ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.4,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ reply: "عذراً، النظام مشغول حالياً. يرجى المحاولة بعد لحظات." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ reply: "عذراً، حدث خطأ تقني مؤقت. يرجى المحاولة لاحقاً." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let reply = aiData.choices?.[0]?.message?.content ||
      "عذراً، لم أتمكن من معالجة سؤالك. يرجى إعادة صياغته أو التواصل معنا على 920015029.";

    // ── Detect and execute cancellation action ──
    let cancelExecuted = false;
    if (reply.includes("[ACTION:CANCEL_REQUEST]")) {
      reply = reply.replace("[ACTION:CANCEL_REQUEST]", "").trim();
      const cancellableStatuses = ["draft", "submitted", "scope_generated"];
      if (ctx.status && cancellableStatuses.includes(ctx.status) && ctx.assignment_id && ctx.client_user_id) {
        try {
          const { data: cancelResult } = await db.rpc("update_request_status", {
            _assignment_id: ctx.assignment_id,
            _new_status: "cancelled",
            _user_id: ctx.client_user_id,
            _action_type: "normal",
            _reason: "إلغاء بطلب العميل عبر رقيم",
          });
          if (cancelResult?.success) {
            cancelExecuted = true;
            reply += "\n\n✅ **تم إلغاء طلبك بنجاح.** يمكنك تقديم طلب جديد في أي وقت.";
          } else {
            reply += "\n\n⚠️ تعذر إلغاء الطلب تلقائياً. يرجى التواصل مع الدعم على 920015029.";
            console.error("Cancel RPC failed:", cancelResult, "ctx:", ctx);
          }
        } catch (cancelErr) {
          console.error("Cancel execution error:", cancelErr, "ctx:", ctx);
          reply += "\n\n⚠️ حدث خطأ أثناء الإلغاء. يرجى التواصل مع الدعم على 920015029.";
        }
      }
    }

    // ── Update client memory (background, don't await) ──
    if (ctx.client_user_id) {
      updateClientMemory(db, ctx.client_user_id, message, ctx).catch((e) =>
        console.error("Memory update failed:", e)
      );
    }

    // ── Generate suggested actions ──
    const suggestedActions: { label: string; message: string }[] = [];
    const status = ctx.status;

    // Universal actions
    suggestedActions.push({ label: "⏱️ المدة المتوقعة", message: "كم المدة المتوقعة لإنجاز التقييم؟" });

    // Cancellation action for eligible statuses
    if (["draft", "submitted", "scope_generated"].includes(status || "")) {
      suggestedActions.push({ label: "❌ إلغاء الطلب", message: "أرغب في إلغاء طلب التقييم" });
    }

    if (status === "submitted" || status === "under_pricing") {
      suggestedActions.push({ label: "📄 المستندات المطلوبة", message: "ما هي المستندات المطلوبة لإتمام التقييم؟" });
      suggestedActions.push({ label: "📊 تقدير أولي", message: "هل يمكنك إعطائي تقدير أولي للقيمة؟" });
    } else if (status === "scope_generated") {
      suggestedActions.push({ label: "📋 شرح النطاق", message: "اشرح لي نطاق العمل بالتفصيل" });
      suggestedActions.push({ label: "💰 تفاصيل السعر", message: "ما تفاصيل عرض السعر؟" });
    } else if (status === "data_collection_open") {
      suggestedActions.push({ label: "📎 ملفات ناقصة", message: "هل هناك ملفات ناقصة في طلبي؟" });
      suggestedActions.push({ label: "📊 نسبة الاكتمال", message: "كم نسبة اكتمال ملف طلبي؟" });
    } else if (status === "inspection_pending" || status === "inspection_completed") {
      if (isDesktop) {
        suggestedActions.push({ label: "📋 حالة التحليل", message: "ما وضع التحليل الحالي في طلبي المكتبي؟" });
        suggestedActions.push({ label: "⚠️ المخاطر", message: "هل توجد مخاطر أو نواقص قد تؤثر على التقييم المكتبي؟" });
      } else {
        suggestedActions.push({ label: "🔎 تفاصيل المعاينة", message: "ما تفاصيل المعاينة الميدانية؟" });
        suggestedActions.push({ label: "⚠️ المخاطر", message: "هل هناك مخاطر متوقعة في هذا التقييم؟" });
      }
    } else if (status === "professional_review" || status === "analysis_complete") {
      suggestedActions.push({ label: "📋 حالة الامتثال", message: "ما حالة فحوصات الامتثال لطلبي؟" });
      suggestedActions.push({ label: "🔍 المنهجيات", message: "ما المنهجيات المستخدمة في التقييم؟" });
    } else if (status === "draft_report_ready" || status === "client_review") {
      suggestedActions.push({ label: "📊 ملخص التقرير", message: "أعطني ملخص المسودة" });
      suggestedActions.push({ label: "📈 مقارنة سوقية", message: "كيف تقارن القيمة مع السوق؟" });
      suggestedActions.push({ label: "✅ جاهزية الإصدار", message: "ما نسبة جاهزية طلبي للإصدار النهائي؟" });
    } else if (status === "issued") {
      suggestedActions.push({ label: "✅ رمز التحقق", message: "ما هو رمز التحقق من التقرير؟" });
      suggestedActions.push({ label: "📜 حقوقي", message: "ما هي حقوقي كعميل بعد صدور التقرير؟" });
    }

    // Add document readiness indicator
    const documentReadiness = docReadiness ? {
      percent: docReadiness.readinessPercent,
      missing: docReadiness.missing,
      total: docReadiness.total,
    } : null;

    // ── Save AI reply ──
    if (request_id) {
      const insertResult = await db.from("request_messages").insert({
        request_id,
        sender_type: "ai",
        content: reply,
      });
      if (insertResult.error) {
        console.error("Failed to save AI reply:", insertResult.error);
      }
    }

    return new Response(JSON.stringify({
      reply, suggestedActions, documentReadiness, cancelExecuted,
      complianceReadiness: complianceStatus.totalChecks > 0 ? {
        percent: complianceStatus.mandatoryTotal > 0 ? Math.round((complianceStatus.mandatoryPassed / complianceStatus.mandatoryTotal) * 100) : 0,
        issuanceReady: complianceStatus.issuanceReady,
        failedMandatory: complianceStatus.failedMandatory,
      } : null,
      predictions: predictions.estimatedDays ? {
        estimatedDays: predictions.estimatedDays,
        valueRange: predictions.valueRange,
        riskFlags: predictions.riskFlags,
      } : null,
      workflowReadiness: workflowStatus.nextStatus ? {
        canAdvance: workflowStatus.canAdvance,
        nextStatus: workflowStatus.nextStatus,
        blockers: workflowStatus.blockers,
      } : null,
      marketTrends: marketTrends.trends.length > 0 ? {
        trends: marketTrends.trends,
        alerts: marketTrends.alerts,
        recentTransactions: marketTrends.recentTransactions,
      } : null,
      partyCoordination: partyStatus.parties.length > 0 ? {
        parties: partyStatus.parties,
        escalationNeeded: partyStatus.escalationNeeded,
        escalationReason: partyStatus.escalationReason,
        summary: partyStatus.unifiedSummary,
      } : null,
      autonomousActions: autonomousResult.actions.length > 0 ? {
        actions: autonomousResult.actions,
        decisions: autonomousResult.decisionsAvailable,
        selfHealAttempts: autonomousResult.selfHealAttempts,
      } : null,
      performanceInsights: selfLearning.totalPredictions > 0 ? {
        totalCompleted: selfLearning.totalPredictions,
        trend: selfLearning.improvementTrend,
        commonErrors: selfLearning.commonErrors,
      } : null,
      machineryAnalysis: machineryDepreciation ? {
        totalOriginalCost: machineryDepreciation.totalOriginalCost,
        totalCurrentValue: machineryDepreciation.totalCurrentValue,
        depreciationPercent: machineryDepreciation.overallDepreciationPercent,
        assetCount: machineryDepreciation.assets.length,
      } : null,
      machineryMarketData: machineryMarket.valueGap ? {
        bookValue: machineryMarket.valueGap.bookValue,
        marketValue: machineryMarket.valueGap.marketValue,
        replacementCost: machineryMarket.valueGap.replacementCost,
        liquidationValue: machineryMarket.valueGap.liquidationValue,
        gapPercent: machineryMarket.valueGap.gapPercent,
      } : null,
      productionLineData: productionLines ? {
        lineCount: productionLines.lineCount,
        systemPremium: productionLines.systemPremium,
        recommendations: productionLines.recommendations,
      } : null,
      fleetAnalysis: bulkIntake.totalAssets > 0 ? {
        totalAssets: bulkIntake.totalAssets,
        duplicates: bulkIntake.duplicatesDetected,
        qualityScore: bulkIntake.qualityScore,
        clusters: smartClustering.totalClusters,
        timeSaving: smartClustering.timeSavingPercent,
        sites: multiSite.totalSites,
        desktopMode: desktopFleet.valuationMode,
        riskPremium: desktopFleet.riskPremiumPercent,
        fleetValue: fleetReport.totalFleetValue,
        qcScore: bulkQC.overallQualityScore,
        qcReady: bulkQC.readyForIssuance,
        progress: fleetDashboard.progress.progressPercent,
        exportReady: fleetDashboard.exportReady,
      } : null,
      predictiveValuationData: predictiveValuation.predictions.length > 0 ? {
        marketTrend: predictiveValuation.marketTrend,
        predictions: predictiveValuation.predictions,
        macroFactors: predictiveValuation.macroFactors,
      } : null,
      peerReview: aiPeerReview.findings.length > 0 ? {
        score: aiPeerReview.overallScore,
        issuanceReady: aiPeerReview.issuanceReady,
        findings: aiPeerReview.findings.length,
        summary: aiPeerReview.reviewSummary,
      } : null,
      imageFraudData: imageFraud.totalPhotos > 0 ? {
        totalPhotos: imageFraud.totalPhotos,
        flagged: imageFraud.flaggedPhotos,
        trustScore: imageFraud.overallTrustScore,
      } : null,
      clientPortal: smartPortal.milestones.length > 0 ? {
        progress: smartPortal.overallProgress,
        daysRemaining: smartPortal.daysRemaining,
        notifications: smartPortal.notifications,
        satisfaction: smartPortal.satisfaction,
      } : null,
      institutionalMemoryData: institutionalMemory.totalPastValuations > 0 ? {
        pastValuations: institutionalMemory.totalPastValuations,
        clientTier: institutionalMemory.clientTier,
        avgValue: institutionalMemory.avgValuationValue,
      } : null,
      portfolioHealthData: portfolioHealth.assets.length > 0 ? {
        healthScore: portfolioHealth.healthScore,
        totalValue: portfolioHealth.totalPortfolioValue,
        staleAssets: portfolioHealth.staleAssets,
        revaluationNeeded: portfolioHealth.revaluationNeeded,
      } : null,
      blockchainData: blockchainSeal.seal ? {
        hash: blockchainSeal.seal.reportHash,
        chainRef: blockchainSeal.seal.chainReference,
        tamperProof: blockchainSeal.tamperProof,
      } : null,
      smartEngagement: {
        seasonalReminders: seasonalReminders.reminders.length > 0 ? {
          activeReminders: seasonalReminders.reminders.length,
          revaluationsDue: seasonalReminders.revaluationsDue,
        } : null,
        loyalty: loyaltyOffers.offers.length > 0 ? {
          clientTier: loyaltyOffers.clientTier,
          activeOffers: loyaltyOffers.offers.length,
          totalRequests: loyaltyOffers.totalRequests,
        } : null,
        behavior: behaviorIntel.insights.length > 0 ? {
          activityStatus: behaviorIntel.activityStatus,
          engagementScore: behaviorIntel.engagementScore,
          crossSellOpportunities: behaviorIntel.crossSellOpportunities,
        } : null,
        occasions: occasionMessages.activeOccasions.length > 0 ? {
          activeOccasions: occasionMessages.activeOccasions.length,
          satisfactionPending: occasionMessages.satisfactionPending,
        } : null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-client-chat error:", error);
    return new Response(
      JSON.stringify({
        reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى أو التواصل معنا على 920015029.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
