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

    // ── Parallel data loading ──
    const [knowledgeResult, correctionsResult, clientMemory, docReadiness, marketInsights, clientHistory, predictions, workflowStatus, complianceStatus, selfLearning, marketTrends, partyStatus, autonomousResult] = await Promise.all([
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
    if (ctx.valuation_mode) requestSection += `- نوع التقييم: ${ctx.valuation_mode === "desktop" ? "مكتبي" : ctx.valuation_mode === "field" ? "ميداني" : ctx.valuation_mode}\n`;
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
      const deliveryDays = ctx.valuation_mode === "desktop" ? 5 : 10;
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
15. **الاستقلالية الذكية**: اقتراح إجراءات تلقائية وكشف التناقضات والتعافي الذاتي

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

## قواعد الاستبعاد المهنية
- أصول غير ملموسة → IVS 210
- حقوق تعاقدية → IVS 105
- أدوات مالية → IVS 500
- أصل ناقص البيانات → يُعلّق حتى اكتمال المعلومات

## المنهجيات المعتمدة
1. **منهجية التكلفة**: تُستخدم للعقارات الجديدة والأصول المتخصصة. تعتمد على تكلفة الإحلال ناقص الإهلاك
2. **منهجية المقارنة**: تُستخدم للعقارات السكنية والتجارية. تعتمد على بيانات صفقات مماثلة
3. **منهجية الدخل**: تُستخدم للعقارات المدرّة للدخل. تعتمد على رسملة صافي الدخل التشغيلي
${requestSection}${deadlineAlert}${paymentSection}${documentsSection}${docReadiness ? docReadiness.section : ""}${attachmentsSection}${buildMemorySection(clientMemory)}${clientHistory}${marketInsights.section}${predictions.section}${workflowStatus.section}${complianceStatus.section}${selfLearning.section}${marketTrends.section}${partyStatus.section}${autonomousResult.section}${correctionsSection}${knowledgeSection}`;

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
    const reply = aiData.choices?.[0]?.message?.content ||
      "عذراً، لم أتمكن من معالجة سؤالك. يرجى إعادة صياغته أو التواصل معنا على 920015029.";

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
      suggestedActions.push({ label: "🔎 تفاصيل المعاينة", message: "ما تفاصيل المعاينة الميدانية؟" });
      suggestedActions.push({ label: "⚠️ المخاطر", message: "هل هناك مخاطر متوقعة في هذا التقييم؟" });
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
      reply, suggestedActions, documentReadiness,
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
