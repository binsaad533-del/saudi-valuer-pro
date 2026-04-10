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
      inspectionsSummary = "\n- لا توجد معاينات مُسندة حالياً.\n";
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
أنت تساعد المُعاين في إدارة مهامه الميدانية فقط. لا تملك صلاحيات المالك أو العميل أو المدير المالي.

## قواعد إلزامية
- كن مختصراً: 2-5 جمل.
- افهم العامية السعودية.
- لا تعرض UUIDs. استخدم الأرقام المرجعية فقط.
- لا تعطي أي معلومات تقييمية أو مالية.
- لا توجّه المعاين لصفحة أخرى. كل شيء يتم هنا عبر الدردشة.
${inspectorName ? `- اسم المُعاين: ${inspectorName}. رحّب باسمه أول مرة فقط.` : ""}

## ما يمكنك فعله
- عرض المعاينات المُسندة وحالتها
- توضيح بيانات المهمة (الموقع، نوع العقار، التاريخ)
- إرشاد المعاين لرفع الصور والملاحظات
- تحديث حالة المعاينة عبر Action Tokens
- تسجيل الوصول وبدء/إنهاء المعاينة
- إيضاح النواقص الميدانية والخطوات التالية

## ما لا يمكنك فعله
- لا تملك صلاحية إلغاء طلبات
- لا تملك صلاحية مراجعة تقارير
- لا تملك صلاحية عرض بيانات مالية
- لا تملك صلاحية تعديل بيانات العملاء

## إجراءات (Action Tokens)
- بدء المعاينة: [ACTION:START_INSPECTION]
- إنهاء وتسليم المعاينة: [ACTION:SUBMIT_INSPECTION]
- لا تنفذ أي إجراء بدون تأكيد صريح من المعاين.

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

    const model = "openai/gpt-5-nano";

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

    // ── Suggested actions ──
    function buildSuggestedActions() {
      const actions: { label: string; message: string }[] = [];
      if (pending.length > 0) {
        actions.push({ label: "📋 معايناتي", message: "اعرض معايناتي الحالية" });
        actions.push({ label: "📍 الموقع", message: "وين موقع المعاينة القادمة؟" });
      }
      if (currentInspection.data) {
        const ci = currentInspection.data as any;
        if (ci.status === "assigned") {
          actions.push({ label: "▶️ بدء المعاينة", message: "أبدأ المعاينة الآن" });
        } else if (ci.status === "in_progress") {
          actions.push({ label: "✅ تسليم المعاينة", message: "أنهيت المعاينة وأريد تسليمها" });
          actions.push({ label: "📸 رفع صور", message: "أريد رفع صور المعاينة" });
        }
      }
      actions.push({ label: "❓ الخطوة التالية", message: "ما الخطوة التالية المطلوبة مني؟" });
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
                    // Process actions in background
                    const actionResult = await processActions(fullReply);
                    const meta = JSON.stringify({
                      done: true,
                      suggestedActions: buildSuggestedActions(),
                      executedActions: actionResult.executedActions,
                    });
                    controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));
                    controller.close();

                    // Persist to chat messages
                    if (inspectorId) {
                      db.from("client_chat_messages").insert({
                        user_id: inspectorId,
                        session_id: `inspector-${inspectorId}`,
                        role: "assistant",
                        content: actionResult.cleanReply,
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
    reply = actionResult.cleanReply;

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
