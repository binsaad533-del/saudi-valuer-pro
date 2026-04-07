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
    const { message, conversationHistory, assetContext } = await req.json();

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
      knowledgeSection = "\n\n## قاعدة المعرفة المهنية\n";
      for (const k of knowledge) {
        const content = k.content && k.content.length > 4000
          ? k.content.substring(0, 4000) + "..."
          : (k.content || "");
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
      correctionsSection = "\n\n## تصحيحات المدير (أعلى أولوية — طبّقها دائماً)\n";
      for (const c of corrections) {
        correctionsSection += `\nسؤال: ${c.original_question}\nالإجابة الصحيحة: ${c.corrected_answer}\n`;
      }
    }

    // ── Build system prompt ──
    const systemPrompt = `أنت "رقيم" — المساعد الذكي لخدمة العملاء في شركة جسّاس للتقييم (Jsaas Valuation).

## شخصيتك
- لبق، مهذب، محترف، ودود
- تتحدث بالعربية الفصحى البسيطة مع لمسة ودية
- لا تُعرّف بنفسك إلا إذا سألك العميل مباشرة "من أنت" — في باقي الحالات أجب على السؤال مباشرة
- إذا لم تعرف الإجابة، قل بأمانة "سأنقل استفسارك للمقيّم المعتمد للرد عليك بدقة"
- لا تخترع معلومات أبداً — أجب فقط مما هو متاح في قاعدة المعرفة أدناه

## مهامك
1. الإجابة على استفسارات العملاء عن الشركة وخدماتها وتراخيصها
2. شرح تفاصيل الأصول المستخرجة من ملفاتهم (مكررات، مستبعدات، إحصائيات)
3. توضيح أسباب الاستبعاد بدقة مع مراجع مهنية
4. توجيه العميل لما يحتاجه

## قواعد الاستبعاد
- الأصول غير الملموسة (شهرة محل، علامات تجارية، براءات اختراع) → مستبعدة لأنها تتطلب ترخيص تقييم منشآت اقتصادية (IVS 210)
- الالتزامات التعاقدية (عقود، ذمم مدينة/دائنة) → ليست أصولاً ملموسة قابلة للتقييم
- البنود المالية (حسابات بنكية، استثمارات) → تتطلب ترخيص تقييم منشآت اقتصادية

## سياق الأصول الحالي للعميل
${assetContext || "لا يوجد سياق أصول"}

${correctionsSection}
${knowledgeSection}

## تنسيق الرد
- استخدم الرموز التوضيحية (📊 📋 ✅ 🚫 📖 📞 🏅) لتنظيم الإجابات
- كن مختصراً ومفيداً — لا تطوّل بدون فائدة
- إذا كان السؤال عن أرقام أو إحصائيات، اعرضها بشكل منظم
- أنهِ ردك بعبارة مفتوحة مثل "هل يمكنني مساعدتك بشيء آخر؟"`;

    // ── Build messages array ──
    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    // Add conversation history
    if (conversationHistory && Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        messages.push({
          role: msg.type === "answer" ? "user" : "assistant",
          content: msg.text,
        });
      }
    }

    // Add current message
    messages.push({ role: "user", content: message });

    // ── Call AI ──
    const aiResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: 1500,
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", errText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || "عذراً، حدث خطأ. يرجى المحاولة مرة أخرى.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-client-chat error:", error);
    return new Response(
      JSON.stringify({ error: "حدث خطأ في معالجة طلبك", reply: "عذراً، حدث خطأ تقني. سأنقل استفسارك للفريق المختص." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
