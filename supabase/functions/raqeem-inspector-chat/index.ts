import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AI } from "../_shared/assistantIdentity.ts";
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
    const { message, conversationHistory, inspector_user_id, inspection_id, stream: wantStream } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: "الرسالة مطلوبة" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // ── Fetch inspector context ──
    const inspectorId = inspector_user_id;
    const [profileResult, inspectionsResult, currentInspection] = await Promise.all([
      inspectorId
        ? db.from("profiles").select("full_name_ar, full_name_en, phone").eq("user_id", inspectorId).maybeSingle()
        : Promise.resolve({ data: null }),
      inspectorId
        ? db.from("inspections").select(`
            id, status, inspection_date, inspection_time, type, notes_ar, started_at, submitted_at,
            assignment:valuation_assignments!inspections_assignment_id_fkey (
              id, reference_number, status, property_type,
              subjects (city_ar, district_ar, address_ar, latitude, longitude)
            )
          `).eq("inspector_id", inspectorId).order("created_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: null }),
      inspection_id
        ? db.from("inspections").select(`
            id, status, inspection_date, inspection_time, type, notes_ar, findings_ar, started_at, submitted_at,
            assignment:valuation_assignments!inspections_assignment_id_fkey (
              id, reference_number, status, property_type, valuation_type,
              subjects (city_ar, district_ar, address_ar, latitude, longitude, description_ar)
            )
          `).eq("id", inspection_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const inspectorName = profileResult.data?.full_name_ar || profileResult.data?.full_name_en || "معاين";
    const allInspections = inspectionsResult.data || [];

    // ── Status labels ──
    const statusLabels: Record<string, string> = {
      assigned: "مُسندة", in_progress: "جارية", submitted: "مُرسلة", reviewed: "مُراجعة",
      completed: "مكتملة", cancelled: "ملغية",
    };

    // ── Build inspections summary ──
    let inspectionsSummary = "";
    const pending = allInspections.filter((i: any) => !["submitted", "reviewed", "cancelled"].includes(i.status));
    const completed = allInspections.filter((i: any) => ["submitted", "reviewed"].includes(i.status));

    if (allInspections.length > 0) {
      inspectionsSummary = `\n## المعاينات\n- إجمالي: ${allInspections.length} | نشطة: ${pending.length} | مكتملة: ${completed.length}\n`;
      for (const ins of allInspections.slice(0, 6)) {
        const ref = ins.assignment?.reference_number || "—";
        const city = ins.assignment?.subjects?.[0]?.city_ar || "";
        const district = ins.assignment?.subjects?.[0]?.district_ar || "";
        const loc = [city, district].filter(Boolean).join(" - ");
        inspectionsSummary += `- ${ref}: ${statusLabels[ins.status] || ins.status}`;
        if (loc) inspectionsSummary += ` | ${loc}`;
        if (ins.inspection_date) inspectionsSummary += ` | ${ins.inspection_date}`;
        inspectionsSummary += "\n";
      }
    } else {
      inspectionsSummary = "\n- لا توجد مهام ميدانية مُسندة حالياً.\n";
    }

    // ── Current inspection context ──
    let currentInspectionSection = "";
    if (currentInspection.data) {
      const ci = currentInspection.data as any;
      const subj = ci.assignment?.subjects?.[0];
      currentInspectionSection = `\n## المعاينة الحالية\n`;
      currentInspectionSection += `- الرقم المرجعي: ${ci.assignment?.reference_number || "—"}\n`;
      currentInspectionSection += `- الحالة: ${statusLabels[ci.status] || ci.status}\n`;
      currentInspectionSection += `- نوع العقار: ${ci.assignment?.property_type || "—"}\n`;
      if (subj?.city_ar) currentInspectionSection += `- المدينة: ${subj.city_ar}\n`;
      if (subj?.district_ar) currentInspectionSection += `- الحي: ${subj.district_ar}\n`;
      if (subj?.address_ar) currentInspectionSection += `- العنوان: ${subj.address_ar}\n`;
      if (subj?.latitude && subj?.longitude) currentInspectionSection += `- الإحداثيات: ${subj.latitude}, ${subj.longitude}\n`;
      if (ci.inspection_date) currentInspectionSection += `- تاريخ المعاينة: ${ci.inspection_date}\n`;
      if (ci.notes_ar) currentInspectionSection += `- ملاحظات: ${ci.notes_ar}\n`;
    }

    // ── System prompt ──
    const systemPrompt = `أنت "${AI.title}"، مساعد ميداني ذكي للمُعاين في شركة جسّاس للتقييم.

## دورك
تساعد المُعاين في إدارة مهامه الميدانية فقط. لا تملك صلاحيات المالك أو العميل أو المدير المالي.

## قواعد اللغة (إلزامية)
- اكتب بالعربية الفصحى المهنية دائماً. لا تستخدم ترجمة حرفية من الإنجليزية.
- تأكد أن كل كلمة مكتملة وصحيحة إملائياً قبل الإرسال.
- لا ترسل أي جملة مقطوعة أو كلمة ناقصة أو غير مفهومة.
- استخدم جملاً قصيرة ومباشرة (2-4 جمل كحد أقصى).
- افهم العامية السعودية لكن أجب بالفصحى المهنية المبسطة.
- استخدم الأرقام الغربية (0-9) دائماً.

## صياغات معتمدة (استخدمها حرفياً)
- عند عدم وجود مهام: "لا توجد مهام ميدانية مُسندة إليك حالياً."
- عند عدم وجود معاينات: "لا توجد معاينات حالية."
- عند عدم وجود معاينة جارية: "لا توجد معاينة جارية حالياً."
- عند السؤال عن الجدول: "هل تودّ عرض جدول اليوم أو هذا الأسبوع؟"
- عند نجاح البدء: "تم تسجيل بدء المعاينة بنجاح."
- عند نجاح التسليم: "تم تسليم المعاينة بنجاح. ستتم مراجعتها من قِبل المقيّم المعتمد."
- عند الترحيب: "أهلاً [الاسم]، كيف أساعدك اليوم؟"

## قواعد تشغيلية
- لا تعرض معرّفات تقنية (UUIDs). استخدم الأرقام المرجعية فقط.
- لا تقدّم أي معلومات تقييمية أو مالية.
- لا توجّه المعاين لصفحة أخرى. كل شيء يتم عبر الدردشة.
${inspectorName ? `- اسم المُعاين: ${inspectorName}. رحّب باسمه في أول رسالة فقط.` : ""}

## صلاحياتك
يمكنك:
- عرض المعاينات المُسندة وحالتها
- توضيح بيانات المهمة (الموقع، نوع العقار، التاريخ)
- إرشاد المعاين لرفع الصور والملاحظات
- تحديث حالة المعاينة (بدء / تسليم)
- توضيح النواقص الميدانية والخطوة التالية

لا يمكنك:
- إلغاء الطلبات
- مراجعة التقارير
- عرض بيانات مالية
- تعديل بيانات العملاء

## إجراءات (Action Tokens)
- بدء المعاينة: [ACTION:START_INSPECTION]
- إنهاء وتسليم المعاينة: [ACTION:SUBMIT_INSPECTION]
- لا تنفّذ أي إجراء بدون تأكيد صريح من المعاين.

${inspectionsSummary}${currentInspectionSection}`;

    // ── Build messages ──
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-4)) {
        if (msg.sender_type === "inspector" || msg.role === "user") {
          aiMessages.push({ role: "user", content: msg.content });
        } else {
          aiMessages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    aiMessages.push({ role: "user", content: message });

    const model = "google/gemini-2.5-flash-lite";

    // ── Helper: process action tokens ──
    async function processActions(reply: string) {
      let cleanReply = reply;
      const executedActions: string[] = [];

      if (cleanReply.includes("[ACTION:START_INSPECTION]") && inspection_id) {
        cleanReply = cleanReply.replace("[ACTION:START_INSPECTION]", "").trim();
        try {
          const { error } = await db.from("inspections").update({
            status: "in_progress", started_at: new Date().toISOString(),
          }).eq("id", inspection_id);
          if (!error) {
            executedActions.push("start_inspection");
            cleanReply += "\n\n✅ تم تسجيل بدء المعاينة بنجاح.";
            // Audit log
            await db.from("audit_logs").insert({
              user_id: inspectorId, action: "status_change" as any,
              table_name: "inspections", record_id: inspection_id,
              description: `المعاين بدأ المعاينة عبر ${AI.name}`,
              new_data: { status: "in_progress" },
              user_name: inspectorName, user_role: "inspector",
            } as any).catch(() => {});
          } else {
            cleanReply += "\n\n⚠️ تعذر بدء المعاينة. حاول مجدداً.";
          }
        } catch { cleanReply += "\n\n⚠️ خطأ أثناء بدء المعاينة."; }
      }

      if (cleanReply.includes("[ACTION:SUBMIT_INSPECTION]") && inspection_id) {
        cleanReply = cleanReply.replace("[ACTION:SUBMIT_INSPECTION]", "").trim();
        try {
          const { error } = await db.from("inspections").update({
            status: "submitted", submitted_at: new Date().toISOString(),
          }).eq("id", inspection_id);
          if (!error) {
            executedActions.push("submit_inspection");
            cleanReply += "\n\n✅ تم تسليم المعاينة بنجاح. سيتم مراجعتها من قبل المقيم المعتمد.";
            await db.from("audit_logs").insert({
              user_id: inspectorId, action: "status_change" as any,
              table_name: "inspections", record_id: inspection_id,
              description: `المعاين سلّم المعاينة عبر ${AI.name}`,
              new_data: { status: "submitted" },
              user_name: inspectorName, user_role: "inspector",
            } as any).catch(() => {});
          } else {
            cleanReply += "\n\n⚠️ تعذر تسليم المعاينة. تأكد من رفع الصور أولاً.";
          }
        } catch { cleanReply += "\n\n⚠️ خطأ أثناء تسليم المعاينة."; }
      }

      return { cleanReply, executedActions };
    }

    // ── Post-processing: sanitize Arabic output ──
    function sanitizeArabicReply(text: string): string {
      let clean = text;

      // 1) Fix known AI glitch phrases
      const fixes: [RegExp, string][] = [
        [/لا يوجد حالة/g, "لا توجد معاينات حالية"],
        [/لا توجد أيينات/g, "لا توجد معاينات"],
        [/مهام نش حالياً/g, "لا توجد مهام ميدانية مُسندة حالياً"],
        [/موقع جار المعاينة/g, "لا توجد معاينة جارية حالياً"],
        [/لا يوجد معاينات/g, "لا توجد معاينات"],
        [/لا يوجد مهام/g, "لا توجد مهام"],
        [/تم بدء المعاينة/g, "تم تسجيل بدء المعاينة"],
        [/الإجراءوب/g, "الإجراء"],
        [/وسأسجّلاغ/g, "وسأسجّل"],
      ];
      for (const [pattern, replacement] of fixes) {
        clean = clean.replace(pattern, replacement);
      }

      // 2) Remove words with garbled Arabic (mixed valid+invalid sequences at word boundaries)
      // Detect words that end or start with orphan Arabic letters glued to non-Arabic chars
      clean = clean.replace(/[\u0600-\u06FF]{1,2}(?=[^\s\u0600-\u06FF\d.,،:؛؟!)\]}>»"'])/g, "");
      clean = clean.replace(/(?<=[^\s\u0600-\u06FF\d.,،:؛؟!(\[{<«"'])[\u0600-\u06FF]{1,2}/g, "");

      // 3) Remove words that look like broken Arabic tokens (very short fragments surrounded by spaces)
      clean = clean.split(/\s+/).map(word => {
        // Keep non-Arabic words, numbers, punctuation, markdown, emoji
        if (!/[\u0600-\u06FF]/.test(word)) return word;
        // Keep Arabic words that are at least 2 real chars (excluding diacritics)
        const stripped = word.replace(/[\u064B-\u065F\u0670]/g, "");
        if (stripped.length >= 2) return word;
        return "";
      }).filter(Boolean).join(" ");

      // 4) Fix sentences that end mid-word (trailing incomplete Arabic)
      clean = clean.replace(/[\u0600-\u06FF][\u064B-\u065F\u0670]*$/gm, (match) => {
        // If trailing fragment is very short, remove it
        const stripped = match.replace(/[\u064B-\u065F\u0670]/g, "");
        return stripped.length >= 3 ? match : "";
      });

      // 5) Remove lines that are too short to be meaningful
      clean = clean.split("\n").filter(line => {
        const trimmed = line.trim();
        if (trimmed.length === 0) return true;
        if (trimmed.length <= 2 && !/^[-•*#>✅⚠️📋📍▶️📸❓]/.test(trimmed) && !/^\d+$/.test(trimmed)) return false;
        return true;
      }).join("\n");

      // 6) Collapse excessive whitespace
      clean = clean.replace(/\n{4,}/g, "\n\n\n");
      clean = clean.replace(/ {2,}/g, " ");

      return clean.trim();
    }

    // ── Suggested actions ──
    function buildSuggestedActions() {
      const actions: { label: string; message: string }[] = [];
      if (pending.length > 0) {
        actions.push({ label: "📋 المعاينات المُسندة", message: "اعرض المعاينات المُسندة إليّ" });
        actions.push({ label: "📍 موقع المهمة", message: "أين موقع المعاينة القادمة؟" });
      }
      if (currentInspection.data) {
        const ci = currentInspection.data as any;
        if (ci.status === "assigned") {
          actions.push({ label: "▶️ بدء المعاينة", message: "أريد بدء المعاينة الآن" });
        } else if (ci.status === "in_progress") {
          actions.push({ label: "✅ تسليم المعاينة", message: "أنهيت المعاينة وأريد تسليمها" });
          actions.push({ label: "📸 رفع الصور", message: "أريد رفع صور المعاينة" });
        }
      }
      actions.push({ label: "❓ الخطوة التالية", message: "ما الخطوة التالية المطلوبة منّي؟" });
      return actions;
    }

    // ── STREAMING ──
    if (wantStream) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({ model, messages: aiMessages, stream: true }),
      });

      if (!aiResponse.ok) {
        console.error("AI stream error:", aiResponse.status);
        return new Response(JSON.stringify({ reply: "عذراً، يرجى المحاولة لاحقاً." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const readable = new ReadableStream({
        async start(controller) {
          const reader = aiResponse.body!.getReader();
          const decoder = new TextDecoder();
          let fullReply = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    // Sanitize and process actions
                    fullReply = sanitizeArabicReply(fullReply);
                    const actionResult = await processActions(fullReply);
                    const meta = JSON.stringify({
                      done: true,
                      suggestedActions: buildSuggestedActions(),
                      executedActions: actionResult.executedActions,
                    });
                    controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));
                    controller.close();

                    // Persist sanitized reply
                    if (inspectorId) {
                      db.from("client_chat_messages").insert({
                        user_id: inspectorId,
                        session_id: `inspector-${inspectorId}`,
                        role: "assistant",
                        content: sanitizeArabicReply(actionResult.cleanReply),
                        metadata: { inspection_id: inspection_id || null },
                      } as any).catch(() => {});
                    }
                    return;
                  }
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content || "";
                    if (delta) {
                      fullReply += delta;
                      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ delta })}\n\n`));
                    }
                  } catch {}
                }
              }
            }
          } catch (err) {
            console.error("Stream error:", err);
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // ── NON-STREAMING fallback ──
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model, messages: aiMessages }),
    });

    if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

    const aiData = await aiResponse.json();
    let reply = aiData.choices?.[0]?.message?.content || "عذراً، يرجى المحاولة مرة أخرى.";

    const actionResult = await processActions(reply);
    reply = sanitizeArabicReply(actionResult.cleanReply);

    // Persist
    if (inspectorId) {
      db.from("client_chat_messages").insert({
        user_id: inspectorId,
        session_id: `inspector-${inspectorId}`,
        role: "assistant",
        content: reply,
        metadata: { inspection_id: inspection_id || null },
      } as any).catch(() => {});
    }

    return new Response(JSON.stringify({
      reply,
      suggestedActions: buildSuggestedActions(),
      executedActions: actionResult.executedActions,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-inspector-chat error:", error);
    return new Response(JSON.stringify({ reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
