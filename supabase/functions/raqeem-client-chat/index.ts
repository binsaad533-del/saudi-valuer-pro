import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const {
      message,
      request_id,
      conversationHistory,
      requestContext,
      attachments,
    } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "الرسالة مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // ── Load company knowledge ──
    const { data: knowledge } = await db
      .from("raqeem_knowledge")
      .select("title_ar, content, category, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(20);

    let knowledgeSection = "";
    if (knowledge && knowledge.length > 0) {
      knowledgeSection = "\n\n## قاعدة المعرفة المهنية\n";
      for (const k of knowledge) {
        const content = k.content?.length > 3000 ? k.content.substring(0, 3000) + "..." : k.content || "";
        knowledgeSection += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
      }
    }

    // ── Load corrections ──
    const { data: corrections } = await db
      .from("raqeem_corrections")
      .select("original_question, corrected_answer")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);

    let correctionsSection = "";
    if (corrections && corrections.length > 0) {
      correctionsSection = "\n\n## تصحيحات المدير (أعلى أولوية)\n";
      for (const c of corrections) {
        correctionsSection += `سؤال: ${c.original_question}\nالإجابة: ${c.corrected_answer}\n\n`;
      }
    }

    // ── Load uploaded documents metadata ──
    let documentsSection = "";
    if (request_id) {
      const { data: docs } = await db
        .from("request_documents")
        .select("file_name, mime_type, ai_category, created_at")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false })
        .limit(15);
      
      if (docs && docs.length > 0) {
        documentsSection = "\n\n## المستندات المرفوعة\n";
        for (const d of docs) {
          documentsSection += `• ${d.file_name} (${d.ai_category || d.mime_type || "غير مصنف"}) — ${new Date(d.created_at).toLocaleDateString("ar-SA")}\n`;
        }
      }
    }

    // ── Load payment info ──
    let paymentSection = "";
    if (request_id) {
      const { data: payments } = await db
        .from("payment_receipts")
        .select("amount, payment_type, status, created_at")
        .eq("request_id", request_id)
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (payments && payments.length > 0) {
        paymentSection = "\n\n## سجل المدفوعات\n";
        for (const p of payments) {
          const statusLabel = p.status === "confirmed" ? "مؤكد" : p.status === "pending" ? "قيد المراجعة" : p.status;
          const typeLabel = p.payment_type === "first" ? "الدفعة الأولى" : p.payment_type === "final" ? "الدفعة النهائية" : p.payment_type;
          paymentSection += `• ${typeLabel}: ${p.amount} ر.س — ${statusLabel}\n`;
        }
      }
    }

    // ── Build request context section ──
    const ctx = requestContext || {};
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

    // Calculate estimated delivery
    if (ctx.created_at) {
      const createdDate = new Date(ctx.created_at);
      const deliveryDays = ctx.valuation_mode === "desktop" ? 5 : 10;
      const estimatedDelivery = new Date(createdDate.getTime() + deliveryDays * 24 * 60 * 60 * 1000);
      const remaining = Math.max(0, Math.ceil((estimatedDelivery.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
      requestSection += `- التسليم المتوقع: ${estimatedDelivery.toLocaleDateString("ar-SA")} (${remaining > 0 ? `متبقي ${remaining} يوم` : "حان موعد التسليم"})\n`;
    }

    // Status-specific guidance for Raqeem
    const statusGuidance: Record<string, string> = {
      submitted: "الطلب مقدم وقيد المراجعة. أخبر العميل أن الفريق يعمل على إعداد نطاق العمل وعرض السعر.",
      under_pricing: "الطلب بانتظار إعداد التسعير. أخبر العميل أن الفريق يعمل على تحديد التكلفة.",
      scope_generated: "تم إعداد نطاق العمل وعرض السعر. وجّه العميل لمراجعة النطاق والموافقة عليه من اللوحة الجانبية.",
      scope_approved: "العميل وافق على النطاق. الخطوة التالية هي سداد الدفعة الأولى.",
      first_payment_confirmed: "تم تأكيد الدفعة الأولى وبدأ العمل. طمئن العميل أن التقييم جارٍ.",
      data_collection_open: "مرحلة جمع البيانات مفتوحة. اطلب من العميل رفع أي مستندات إضافية مثل صكوك الملكية، رخص البناء، مخططات معمارية، قوائم الأصول.",
      data_collection_complete: "تم استكمال البيانات وجارٍ التحقق منها.",
      inspection_pending: "المعاينة الميدانية مجدولة. أخبر العميل بأنه سيتم التنسيق لتحديد موعد مناسب. وضّح أن المعاينة تشمل: حالة المبنى، القياسات، التصوير، والبيئة المحيطة.",
      inspection_completed: "تمت المعاينة بنجاح. جارٍ التحليل والتقييم.",
      data_validated: "تم التحقق من البيانات. جارٍ تحليل التقييم.",
      analysis_complete: "اكتمل التحليل. جارٍ المراجعة المهنية من المقيم المعتمد.",
      professional_review: "التقييم قيد المراجعة المهنية من المقيم المعتمد وفقاً لمعايير IVS 2025.",
      draft_report_ready: "مسودة التقرير جاهزة للمراجعة. وجّه العميل لمراجعة الأقسام التالية: ملخص التقييم، المنهجيات المستخدمة، القيمة التقديرية، الافتراضات.",
      client_review: "المسودة بانتظار مراجعة العميل. شجّعه على إرسال ملاحظاته التفصيلية.",
      draft_approved: "العميل اعتمد المسودة. الخطوة التالية: سداد الدفعة النهائية لإصدار التقرير الرسمي.",
      final_payment_confirmed: "تم سداد الدفعة النهائية. جارٍ إصدار التقرير النهائي الموقّع والمعتمد.",
      issued: "التقرير النهائي صدر ومتاح للتحميل. التقرير موقّع إلكترونياً ومسجل لدى تقييم. يمكن التحقق منه عبر رمز التحقق.",
      archived: "الطلب مؤرشف. التقرير محفوظ لمدة 10 سنوات وفقاً للأنظمة.",
      cancelled: "الطلب ملغي.",
    };

    if (ctx.status && statusGuidance[ctx.status]) {
      requestSection += `\n### توجيه الحالة الحالية:\n${statusGuidance[ctx.status]}\n`;
    }

    // Asset details
    if (ctx.asset_summary) {
      requestSection += `\n### ملخص الأصول:\n${ctx.asset_summary}\n`;
    }

    // Attachments in this message
    let attachmentsSection = "";
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      attachmentsSection = `\n\n## مرفقات جديدة من العميل (${attachments.length} ملف)\n`;
      for (const att of attachments) {
        attachmentsSection += `• ${att.name} (${att.type || "غير محدد"})\n`;
      }
      attachmentsSection += `\nأكّد استلام المرفقات ووضّح الخطوة التالية.`;
    }

    // ── System prompt ──
    const systemPrompt = `أنت "رقيم – مساعدك الذكي"، مقيّم ذكي متخصص يعمل في شركة جسّاس للتقييم (Jsaas Valuation).

## هويتك
- اسمك: "رقيم – مساعدك الذكي"
- شركة جسّاس للتقييم، مرخصة من الهيئة السعودية للمقيمين المعتمدين (تقييم)
- تراخيص: عقارات (1210001217) + آلات ومعدات (4114000015)
- التواصل: 920015029 / 0500668089 | care@jsaas-valuation.com

## قدراتك المتقدمة
1. **تحليل المستندات**: عند رفع العميل لملفات، تستطيع تحليلها وتصنيفها (صكوك، رخص بناء، مخططات، قوائم أصول)
2. **تقدير أولي**: يمكنك تقديم نطاق تقديري للقيمة بناءً على المعطيات المتاحة مع التنويه أنه تقدير أولي
3. **شرح المنهجيات**: اشرح للعميل المنهجيات المستخدمة (التكلفة، المقارنة، الدخل) بلغة مبسطة
4. **تتبع المدد**: احسب المدة المتبقية وأخبر العميل بالجدول الزمني المتوقع
5. **الإجابة على الأسئلة المهنية**: أجب عن أسئلة التقييم المهنية مثل الفرق بين القيمة السوقية والدفترية

## أسلوبك (إلزامي)
1. **افهم السياق**: اقرأ حالة الطلب ومرحلته قبل الإجابة
2. **أجب بدقة**: أجب على السؤال المطروح فقط — لا تكرر معلومات لم تُطلب
3. **كن استباقياً**: إذا لاحظت نقصاً في البيانات أو الملفات، اطلبها بذكاء
4. **اربط إجابتك بالحالة**: دائماً اشرح للعميل أين وصل طلبه وما المطلوب منه
5. **كن مختصراً**: 2-5 جمل كحد أقصى. لا تُطوّل بلا داعٍ
6. **لا تخترع**: إذا لم تجد المعلومة، قل "سأتحقق من الفريق وأعود لك"
7. **لا تكرر التعريف**: عرّفت نفسك أول مرة. لا تعيد التعريف إلا إذا سُئلت
8. **افهم العامية السعودية**: "وين وصل طلبي" = أين وصل طلبي؟ "ايش المطلوب" = ما المطلوب؟
9. **تعامل مع المرفقات**: عند رفع ملفات، أكّد الاستلام ووضّح كيف ستُستخدم في التقييم
10. **لا ترسل رسائل ترحيبية فارغة**: كل رد يجب أن يحمل قيمة ومعلومة
11. **استخدم التنسيق**: استخدم **عناوين بارزة** و• نقاط عند الحاجة لتسهيل القراءة
12. **قدّم خطوات واضحة**: عند شرح إجراء، رقّم الخطوات بوضوح
13. **تحدث عن المستندات بتفصيل**: عند السؤال عن المستندات المطلوبة، اذكر أسماء محددة (صك ملكية، رخصة بناء، كروكي، إلخ)

## قواعد الاستبعاد المهنية
- أصول غير ملموسة (شهرة، علامات تجارية، برمجيات) → IVS 210
- حقوق تعاقدية (عقود، امتيازات) → IVS 105
- أدوات مالية (أسهم، سندات) → IVS 500
- أصل ناقص البيانات → يُعلّق حتى اكتمال المعلومات

## المنهجيات المعتمدة
1. **منهجية التكلفة (Cost Approach)**: تُستخدم للعقارات الجديدة والأصول المتخصصة. تعتمد على تكلفة الإحلال ناقص الإهلاك
2. **منهجية المقارنة (Market Approach)**: تُستخدم للعقارات السكنية والتجارية. تعتمد على بيانات صفقات مماثلة
3. **منهجية الدخل (Income Approach)**: تُستخدم للعقارات المدرّة للدخل. تعتمد على رسملة صافي الدخل التشغيلي
${requestSection}${paymentSection}${documentsSection}${attachmentsSection}${correctionsSection}${knowledgeSection}`;

    // ── Build messages ──
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-16)) {
        if (msg.role === "client" || msg.sender_type === "client") {
          messages.push({ role: "user", content: msg.content });
        } else if (msg.role === "ai" || msg.sender_type === "ai") {
          messages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    messages.push({ role: "user", content: message });

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

    // ── Generate proactive suggested actions based on status ──
    const suggestedActions: { label: string; message: string }[] = [];
    const status = ctx.status;
    if (status === "submitted" || status === "under_pricing") {
      suggestedActions.push({ label: "📄 المستندات المطلوبة", message: "ما هي المستندات المطلوبة لإتمام التقييم؟" });
    } else if (status === "scope_generated") {
      suggestedActions.push({ label: "📋 شرح النطاق", message: "اشرح لي نطاق العمل بالتفصيل" });
      suggestedActions.push({ label: "💰 تفاصيل السعر", message: "ما تفاصيل عرض السعر؟" });
    } else if (status === "data_collection_open") {
      suggestedActions.push({ label: "📎 ملفات ناقصة", message: "هل هناك ملفات ناقصة في طلبي؟" });
      suggestedActions.push({ label: "📝 أنواع المستندات", message: "ما أنواع المستندات المقبولة؟" });
    } else if (status === "draft_report_ready" || status === "client_review") {
      suggestedActions.push({ label: "📊 ملخص التقرير", message: "أعطني ملخص المسودة" });
      suggestedActions.push({ label: "🔍 المنهجيات", message: "ما المنهجيات المستخدمة في التقييم؟" });
    } else if (status === "issued") {
      suggestedActions.push({ label: "✅ رمز التحقق", message: "ما هو رمز التحقق من التقرير؟" });
    }

    // ── Save AI reply to request_messages ──
    if (request_id) {
      const insertResult = await db.from("request_messages").insert({
        request_id,
        sender_type: "ai",
        content: reply,
      });

      if (insertResult.error) {
        console.error("Failed to save AI reply:", insertResult.error);
      } else {
        console.log("AI reply saved successfully for request:", request_id);
      }
    }

    return new Response(JSON.stringify({ reply, suggestedActions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-client-chat error:", error);
    return new Response(
      JSON.stringify({
        reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى أو التواصل معنا على 920015029.",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
