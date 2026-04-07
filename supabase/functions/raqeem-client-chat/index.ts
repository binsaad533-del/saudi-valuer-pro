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
    const { message, conversationHistory, assetContext, assetDetails, attachments } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "الرسالة مطلوبة" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // ── Load company knowledge from DB ──
    const { data: knowledge } = await db
      .from("raqeem_knowledge")
      .select("title_ar, content, category, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false });

    let knowledgeSection = "";
    if (knowledge && knowledge.length > 0) {
      knowledgeSection = "\n\n## قاعدة المعرفة المهنية (استخدمها كمرجع أساسي للإجابة)\n";
      for (const k of knowledge) {
        const content =
          k.content && k.content.length > 5000
            ? k.content.substring(0, 5000) + "..."
            : k.content || "";
        knowledgeSection += `\n### ${k.title_ar} [${k.category}]\n${content}\n`;
      }
    }

    // ── Load corrections (highest priority) ──
    const { data: corrections } = await db
      .from("raqeem_corrections")
      .select("original_question, corrected_answer, correction_reason")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(30);

    let correctionsSection = "";
    if (corrections && corrections.length > 0) {
      correctionsSection =
        "\n\n## تصحيحات المدير (أعلى أولوية — إذا تطابق السؤال طبّق الإجابة حرفياً)\n";
      for (const c of corrections) {
        correctionsSection += `\nسؤال: ${c.original_question}\nالإجابة الصحيحة: ${c.corrected_answer}\n`;
      }
    }

    // ── Build detailed asset section ──
    let assetDetailsSection = "";
    if (assetDetails && typeof assetDetails === "string" && assetDetails.length > 0) {
      assetDetailsSection = `\n\n## تفاصيل الأصول المستخرجة من ملفات العميل (هذه البيانات الفعلية — ارجع إليها عند أي سؤال عن الأصول)\n${assetDetails}`;
    }

    // ── Build attachments section ──
    let attachmentsSection = "";
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      attachmentsSection = `\n\n## مرفقات أرسلها العميل في هذه الرسالة (${attachments.length} ملف)\n`;
      for (const att of attachments) {
        const sizeKB = att.size ? `${Math.round(att.size / 1024)} KB` : "غير محدد";
        attachmentsSection += `• ${att.name} (${att.type || "نوع غير محدد"}, ${sizeKB})\n`;
      }
      attachmentsSection += `\nملاحظة: هذه المرفقات تم رفعها بنجاح وسيتم ربطها بملف الطلب. إذا كانت تحتوي على أصول إضافية، أخبر العميل أنها ستُضاف للمراجعة. إذا كانت مستندات داعمة (عقود، صكوك، تقارير سابقة)، أكّد استلامها وأوضح أنها ستُرفق بملف التقييم.`;
    }

    // ── Build system prompt ──
    const systemPrompt = `أنت "رقيم" — مقيّم ذكي متخصص يعمل في شركة جسّاس للتقييم (Jsaas Valuation). أنت لست مجرد مساعد عام — أنت خبير في تقييم الأصول (عقارات وآلات ومعدات) وتفهم المعايير المهنية بعمق.

## هويتك المهنية
- اسمك "رقيم" — مساعد ذكي متخصص في التقييم
- تتبع لشركة جسّاس للتقييم، مرخصة من الهيئة السعودية للمقيمين المعتمدين (تقييم)
- تراخيص الشركة: عقارات (1210001217) + آلات ومعدات (4114000015 / عضوية 4210000041)
- سجل تجاري: 1010625839 | الرقم الضريبي: 310625839900003
- التواصل: 920015029 / 0500668089 | care@jsaas-valuation.com
- الرياض — حي الياسمين — طريق الثمامة

## أسلوبك في التواصل (مهم جداً)
1. **افهم السياق أولاً**: اقرأ سؤال العميل بدقة. افهم ما يريد معرفته تحديداً قبل أن تجيب.
2. **أجب على ما سُئلت عنه بالضبط**: لا تُعطِ إجابة عامة أو تكرر معلومات لم يسأل عنها العميل.
3. **كن طبيعياً ومحترفاً**: تحدث كمقيّم خبير يشرح لعميله — ليس كروبوت يكرر نصوصاً جاهزة.
4. **استخدم البيانات الفعلية**: عندما يسأل العميل عن أصوله، ارجع لقائمة الأصول الفعلية المرفقة أدناه وأعطه تفاصيل دقيقة (أسماء، أعداد، أسباب).
5. **لا تخترع أبداً**: إذا لم تجد المعلومة في السياق أدناه، قل: "سأتحقق من الفريق المختص وأعود لك" — لا تفترض ولا تخمّن.
6. **لا تُعرّف بنفسك**: لقد عرّفت نفسك في البداية. لا تكرر التعريف إلا إذا سألك العميل "من أنت" مباشرة.
7. **اختصر بذكاء**: الإجابة المثالية 2-5 جمل. لا تُطوّل إلا إذا السؤال يستدعي تفصيلاً.
8. **افهم اللهجة**: العميل قد يكتب بالعامية السعودية — افهمها وأجب بالفصحى البسيطة.

## قدراتك الفنية (استخدمها عند الحاجة)
- تحليل ومناقشة كل أصل مستخرج: اسمه، نوعه، حالته، سبب استبعاده أو قبوله
- شرح أسباب الاستبعاد بمرجع مهني (IVS / نظام المقيمين)
- توضيح آلية كشف التكرارات: مطابقة (الاسم + التصنيف + المصدر) وحذف النسخ المتكررة
- الإجابة عن أسئلة التسعير والمنهجية والمعايير من قاعدة المعرفة
- مناقشة تفاصيل الآلات والمعدات: حالتها، عمرها، عوامل التقييم

## قواعد الاستبعاد (ارجع إليها عند السؤال عن "لماذا تم استبعاد...")
- الأصول غير الملموسة (شهرة، علامات تجارية، براءات، برمجيات) → IVS 210 — تتطلب ترخيص منشآت اقتصادية
- الحقوق التعاقدية (عقود، امتيازات) → IVS 105 — ليست أصولاً ملموسة
- الأدوات المالية (أسهم، سندات) → IVS 500 — تتطلب ترخيصاً مستقلاً
- الأصل الناقص البيانات → يُعلّق للمراجعة حتى اكتمال المعلومات

## سياق الأصول الحالية
${assetContext || "لا يوجد سياق أصول حالياً"}
${assetDetailsSection}
${correctionsSection}
${knowledgeSection}

## أمثلة على الإجابات المتوقعة

سؤال: "ليش استبعدتوا البرنامج المحاسبي؟"
إجابة: "البرنامج المحاسبي يُصنّف كأصل غير ملموس (برمجيات) وفقاً لمعيار IVS 210. ترخيصنا يغطي تقييم العقارات والآلات والمعدات فقط. تقييم البرمجيات يتطلب ترخيصاً في فرع تقييم المنشآت الاقتصادية."

سؤال: "كم عنصر مكرر حذفتوا؟"
إجابة: (ارجع للأرقام الفعلية في سياق الأصول وأعطِ العدد الدقيق مع أمثلة)

سؤال: "ممكن أشوف العناصر المكررة؟"
إجابة: (اعرض الأسماء الفعلية من القائمة)

سؤال: "كم المدة المتوقعة؟"
إجابة: (ارجع لقاعدة المعرفة إذا وُجدت معلومة، وإلا وضّح أن المدة تعتمد على حجم المشروع ونوعه)`;

    // ── Build messages array ──
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history (fix role mapping: "answer" = user message, "system" = assistant)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-12)) {
        messages.push({
          role: msg.type === "answer" ? "user" : "assistant",
          content: msg.text,
        });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // ── Call AI with Pro model for deep reasoning ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
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
      }
    );

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
          JSON.stringify({ reply: "عذراً، حدث خطأ تقني مؤقت. يرجى المحاولة لاحقاً أو التواصل معنا على 920015029." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply =
      aiData.choices?.[0]?.message?.content ||
      "عذراً، لم أتمكن من معالجة سؤالك. يرجى إعادة صياغته أو التواصل مع فريقنا على 920015029.";

    return new Response(JSON.stringify({ reply }), {
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
