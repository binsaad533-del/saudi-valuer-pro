import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { AI } from "../_shared/assistantIdentity.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadClientMemory, updateClientMemory, buildMemorySection } from "./_shared/memory.ts";
import { analyzeDocumentReadiness } from "./_shared/document-analysis.ts";
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
    const { message, request_id, conversationHistory, requestContext, attachments, client_user_id: directClientUserId, is_global_chat, fast_intent, stream: wantStream } = await req.json();

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
    if (directClientUserId && !ctx.client_user_id) {
      ctx.client_user_id = directClientUserId;
    }
    const isDesktop = isDesktopMode(ctx.valuation_mode);
    const isGlobalChat = is_global_chat === true || !request_id;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    // ── Fetch minimal context in parallel ──
    const clientUserId = ctx.client_user_id;
    const [reqsResult, profileResult, clientMemory] = await Promise.all([
      clientUserId
        ? db.from("valuation_requests").select("id, status, reference_number, property_description_ar, property_type, property_city_ar, valuation_type, created_at, total_fees, amount_paid, payment_status, purpose, assignment_id").eq("client_user_id", clientUserId).order("created_at", { ascending: false }).limit(10)
        : Promise.resolve({ data: null }),
      clientUserId
        ? db.from("profiles").select("full_name_ar, full_name_en").eq("user_id", clientUserId).maybeSingle()
        : Promise.resolve({ data: null }),
      clientUserId ? loadClientMemory(db, clientUserId) : Promise.resolve(null),
    ]);

    const allClientRequests = reqsResult.data || [];
    const clientDisplayName = profileResult.data?.full_name_ar || profileResult.data?.full_name_en || ctx.client_name || "";

    // ── Build concise status summary ──
    const statusLabels: Record<string, string> = {
      draft: "مسودة", submitted: "مقدم", scope_generated: "عرض السعر جاهز",
      scope_approved: "تمت الموافقة", first_payment_confirmed: "جارٍ العمل",
      data_collection_open: "جمع البيانات", inspection_pending: "بانتظار المعاينة",
      inspection_completed: "تمت المعاينة", analysis_complete: "اكتمل التحليل",
      professional_review: "مراجعة مهنية", draft_report_ready: "المسودة جاهزة",
      client_review: "بانتظار مراجعتك", draft_approved: "تم اعتماد المسودة",
      issued: "التقرير صدر", archived: "مؤرشف", cancelled: "ملغي",
    };

    let statusSummary = "";
    if (allClientRequests.length > 0) {
      const activeReqs = allClientRequests.filter((r: any) => !["cancelled", "archived"].includes(r.status));
      const needsAction = allClientRequests.filter((r: any) => ["scope_generated", "client_review", "draft_approved"].includes(r.status));
      statusSummary = `\n## ملخص الطلبات\n- إجمالي: ${allClientRequests.length} | نشطة: ${activeReqs.length} | تحتاج إجراء: ${needsAction.length}\n`;
      for (const r of allClientRequests.slice(0, 5)) {
        const label = r.reference_number || "طلب";
        statusSummary += `- ${label}: ${statusLabels[r.status] || r.status}`;
        if (r.property_city_ar) statusSummary += ` | ${r.property_city_ar}`;
        if (r.payment_status && r.payment_status !== "none") statusSummary += ` | دفع: ${r.payment_status}`;
        statusSummary += "\n";
      }
    } else {
      statusSummary = "\n- لا توجد طلبات سابقة. عميل جديد.\n";
    }

    // Set active request context
    const activeReq = allClientRequests.find((r: any) => !["cancelled", "archived"].includes(r.status));
    if (activeReq && !ctx.assignment_id) {
      ctx.assignment_id = activeReq.assignment_id;
      ctx.status = activeReq.status;
    }

    // ── Documents (only if request_id) ──
    let documentsSection = "";
    if (request_id) {
      const { data: docs } = await db.from("request_documents").select("file_name, ai_category").eq("request_id", request_id).limit(10);
      if (docs?.length) {
        documentsSection = `\n## المستندات المرفوعة\n`;
        for (const d of docs) documentsSection += `• ${d.file_name} (${d.ai_category || "غير مصنف"})\n`;
      }
    }

    // ── Request context ──
    let requestSection = "";
    if (ctx.status || ctx.reference_number) {
      requestSection = "\n## سياق الطلب الحالي\n";
      if (ctx.reference_number) requestSection += `- الرقم المرجعي: ${ctx.reference_number}\n`;
      if (ctx.status) requestSection += `- الحالة: ${statusLabels[ctx.status] || ctx.status}\n`;
      if (ctx.property_type) requestSection += `- نوع الأصل: ${ctx.property_type}\n`;
      if (ctx.property_city) requestSection += `- المدينة: ${ctx.property_city}\n`;
      if (ctx.total_fees) requestSection += `- الرسوم: ${ctx.total_fees} ر.س\n`;
      if (ctx.amount_paid) requestSection += `- المدفوع: ${ctx.amount_paid} ر.س\n`;
    }

    // ── Attachments ──
    let attachmentsSection = "";
    if (attachments?.length) {
      attachmentsSection = `\n## مرفقات جديدة (${attachments.length} ملف)\n`;
      for (const att of attachments) attachmentsSection += `• ${att.name}\n`;
    }

    // ── Build COMPACT system prompt ──
    const systemPrompt = `أنت "${AI.title}"، مقيّم ذكي متخصص في شركة جسّاس للتقييم.
تراخيص: عقارات (1210001217) + آلات ومعدات (4114000015). التواصل: 920015029.

## قواعد إلزامية
- كن مختصراً: 2-5 جمل. لا تُطوّل.
- لا تعرض UUIDs. استخدم الأرقام المرجعية فقط.
- لا توجّه العميل لصفحة أخرى. كل شيء يتم هنا.
- افهم العامية السعودية.
- لا تقدم أي رقم تقييمي أو سعر متر أو تقدير قيمة — هذه خدمة مدفوعة.
- عند محاولة الحصول على تقييم مجاني: وجّه بذكاء لتقديم طلب رسمي.
${clientDisplayName ? `- اسم العميل: ${clientDisplayName}. رحّب باسمه أول مرة فقط.` : "- رحّب ترحيباً عاماً."}

## طلب تقييم جديد (File-First)
عند طلب تقييم جديد: اطلب رفع مستندات أولاً (صك، رخصة، صور، قوائم أصول). حلل الملفات واستخرج البيانات. اسأل فقط عما لم تستطع تحديده. إذا قال "لا توجد ملفات" فقط انتقل للأسئلة.

## إجراءات (Action Tokens)
- إلغاء (draft/submitted/scope_generated فقط): [ACTION:CANCEL_REQUEST]
- موافقة نطاق (scope_generated): [ACTION:SCOPE_APPROVE]  
- اعتماد مسودة (client_review): [ACTION:APPROVE_DRAFT]
- طلب جديد: [ACTION:NEW_REQUEST]
- دفع: [ACTION:PAY_INVOICE]
- تصعيد: [ACTION:ESCALATE]
- لا تنفذ أي إجراء بدون تأكيد صريح من العميل.

${statusSummary}${requestSection}${documentsSection}${attachmentsSection}${buildMemorySection(clientMemory)}`;

    // ── Build messages ──
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-4)) {
        if (msg.role === "client" || msg.sender_type === "client") {
          aiMessages.push({ role: "user", content: msg.content });
        } else if (msg.role === "ai" || msg.sender_type === "ai") {
          aiMessages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    // Build user message with image support
    const imageAttachments = (attachments || []).filter((a: any) => a.type?.startsWith("image/") && a.url);
    if (imageAttachments.length > 0) {
      const contentParts: any[] = [{ type: "text", text: message }];
      for (const img of imageAttachments.slice(0, 3)) {
        contentParts.push({ type: "image_url", image_url: { url: img.url } });
      }
      aiMessages.push({ role: "user", content: contentParts } as any);
    } else {
      aiMessages.push({ role: "user", content: message });
    }

    // ── Choose model: nano for global chat, mini for request-specific ──
    const model = isGlobalChat ? "openai/gpt-5-nano" : "openai/gpt-5-mini";

    // ── STREAMING MODE ──
    if (wantStream) {
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({ model, messages: aiMessages, stream: true }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("AI stream error:", aiResponse.status, errText);
        return new Response(JSON.stringify({ reply: "عذراً، يرجى المحاولة لاحقاً." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Pipe the SSE stream directly to the client
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
              // Parse SSE lines to extract content deltas
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6).trim();
                  if (data === "[DONE]") {
                    // Send final metadata
                    const meta = JSON.stringify({
                      done: true,
                      suggestedActions: buildSuggestedActions(allClientRequests, ctx.status, isGlobalChat, isDesktop),
                      clientRequestsCount: allClientRequests.length,
                      isGlobalChat,
                    });
                    controller.enqueue(new TextEncoder().encode(`data: ${meta}\n\n`));
                    controller.close();
                    
                    // Background: save reply + update memory
                    if (request_id && fullReply) {
                      db.from("request_messages").insert({ request_id, sender_type: "ai", content: fullReply }).then(() => {});
                    }
                    if (clientUserId) {
                      updateClientMemory(db, clientUserId, message, ctx).catch(() => {});
                    }
                    // Process action tokens in background
                    processActionTokens(db, fullReply, ctx, clientDisplayName).catch(() => {});
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
            console.error("Stream read error:", err);
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // ── NON-STREAMING (fallback) ──
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model, messages: aiMessages }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        return new Response(JSON.stringify({ reply: "عذراً، النظام مشغول. يرجى المحاولة بعد لحظات." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let reply = aiData.choices?.[0]?.message?.content || "عذراً، يرجى المحاولة مرة أخرى.";

    // Process action tokens
    const actionResult = await processActionTokens(db, reply, ctx, clientDisplayName);
    reply = actionResult.cleanReply;

    // Save AI reply
    if (request_id) {
      await db.from("request_messages").insert({ request_id, sender_type: "ai", content: reply }).catch(() => {});
    }

    // Update memory (background)
    if (clientUserId) {
      updateClientMemory(db, clientUserId, message, ctx).catch(() => {});
    }

    return new Response(JSON.stringify({
      reply,
      suggestedActions: buildSuggestedActions(allClientRequests, ctx.status, isGlobalChat, isDesktop),
      isGlobalChat,
      clientRequestsCount: allClientRequests.length,
      executedActions: actionResult.executedActions,
      cancelExecuted: actionResult.executedActions.includes("cancel"),
      scopeApproved: actionResult.executedActions.includes("scope_approve"),
      draftApproved: actionResult.executedActions.includes("approve_draft"),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("raqeem-client-chat error:", error);
    return new Response(JSON.stringify({ reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Suggested actions builder ──
function buildSuggestedActions(requests: any[], status: string | undefined, isGlobalChat: boolean, isDesktop: boolean) {
  const actions: { label: string; message: string }[] = [];
  if (isGlobalChat && requests.length === 0) {
    actions.push({ label: "🆕 طلب تقييم جديد", message: "أريد تقديم طلب تقييم جديد" });
    actions.push({ label: "❓ ما هو التقييم؟", message: "اشرح لي ما هو التقييم العقاري" });
  } else if (isGlobalChat) {
    const needsScope = requests.find((r: any) => r.status === "scope_generated");
    const needsReview = requests.find((r: any) => r.status === "client_review");
    if (needsScope) actions.push({ label: "✅ مراجعة عرض السعر", message: "أريد مراجعة عرض السعر" });
    if (needsReview) actions.push({ label: "📝 مراجعة المسودة", message: "أريد مراجعة مسودة التقرير" });
    actions.push({ label: "📊 حالة طلباتي", message: "ملخص حالة طلباتي" });
    actions.push({ label: "🆕 طلب جديد", message: "أريد تقديم طلب تقييم جديد" });
  }
  if (status === "scope_generated") {
    actions.push({ label: "✅ موافقة على النطاق", message: "أوافق على نطاق العمل" });
  } else if (status === "client_review") {
    actions.push({ label: "✅ اعتماد المسودة", message: "أوافق على المسودة" });
  }
  return actions;
}

// ── Action token processor ──
async function processActionTokens(db: any, reply: string, ctx: any, clientName: string) {
  let cleanReply = reply;
  const executedActions: string[] = [];

  // Cancel
  if (cleanReply.includes("[ACTION:CANCEL_REQUEST]")) {
    cleanReply = cleanReply.replace("[ACTION:CANCEL_REQUEST]", "").trim();
    if (["draft", "submitted", "scope_generated"].includes(ctx.status) && ctx.assignment_id && ctx.client_user_id) {
      try {
        const { data } = await db.rpc("update_request_status", {
          _assignment_id: ctx.assignment_id, _new_status: "cancelled",
          _user_id: ctx.client_user_id, _action_type: "normal",
          _reason: `إلغاء بطلب العميل عبر ${AI.name}`,
        });
        if (data?.success) { executedActions.push("cancel"); cleanReply += "\n\n✅ تم إلغاء طلبك بنجاح."; }
        else cleanReply += "\n\n⚠️ تعذر الإلغاء. تواصل مع الدعم 920015029.";
      } catch { cleanReply += "\n\n⚠️ خطأ أثناء الإلغاء. تواصل مع الدعم 920015029."; }
    }
  }

  // Scope Approve
  if (cleanReply.includes("[ACTION:SCOPE_APPROVE]")) {
    cleanReply = cleanReply.replace("[ACTION:SCOPE_APPROVE]", "").trim();
    if (ctx.status === "scope_generated" && ctx.assignment_id && ctx.client_user_id) {
      try {
        const { data } = await db.rpc("update_request_status", {
          _assignment_id: ctx.assignment_id, _new_status: "scope_approved",
          _user_id: ctx.client_user_id, _action_type: "normal",
          _reason: `موافقة على النطاق عبر ${AI.name}`,
        });
        if (data?.success) { executedActions.push("scope_approve"); cleanReply += "\n\n✅ تمت الموافقة. الخطوة التالية: سداد الدفعة الأولى."; }
        else cleanReply += "\n\n⚠️ تعذرت الموافقة. تواصل مع الدعم.";
      } catch { cleanReply += "\n\n⚠️ خطأ أثناء الموافقة."; }
    }
  }

  // Approve Draft
  if (cleanReply.includes("[ACTION:APPROVE_DRAFT]")) {
    cleanReply = cleanReply.replace("[ACTION:APPROVE_DRAFT]", "").trim();
    if (ctx.status === "client_review" && ctx.assignment_id && ctx.client_user_id) {
      try {
        const { data } = await db.rpc("update_request_status", {
          _assignment_id: ctx.assignment_id, _new_status: "draft_approved",
          _user_id: ctx.client_user_id, _action_type: "normal",
          _reason: `اعتماد المسودة عبر ${AI.name}`,
        });
        if (data?.success) { executedActions.push("approve_draft"); cleanReply += "\n\n✅ تم اعتماد المسودة. الخطوة التالية: سداد الدفعة النهائية."; }
        else cleanReply += "\n\n⚠️ تعذر الاعتماد. تواصل مع الدعم.";
      } catch { cleanReply += "\n\n⚠️ خطأ أثناء الاعتماد."; }
    }
  }

  // Simple flags
  const simpleTokens = ["NEW_REQUEST", "PAY_INVOICE", "UPLOAD_PROMPT", "REQUEST_EDIT", "REPEAT_REQUEST", "REQUEST_CERTIFICATE"];
  for (const token of simpleTokens) {
    if (cleanReply.includes(`[ACTION:${token}]`)) {
      cleanReply = cleanReply.replace(`[ACTION:${token}]`, "").trim();
      executedActions.push(token.toLowerCase());
    }
  }

  // Escalate
  if (cleanReply.includes("[ACTION:ESCALATE]")) {
    cleanReply = cleanReply.replace("[ACTION:ESCALATE]", "").trim();
    executedActions.push("escalate");
    if (ctx.client_user_id) {
      db.from("audit_logs").insert({
        user_id: ctx.client_user_id, action: "create" as any, table_name: "client_escalation",
        entity_type: "request", record_id: ctx.assignment_id || null,
        description: `تصعيد شكوى عبر ${AI.name}`, user_role: "client", user_name: clientName || "عميل",
      } as any).catch(() => {});
    }
  }

  // Switch Request
  const switchMatch = cleanReply.match(/\[ACTION:SWITCH_REQUEST:([^\]]+)\]/);
  if (switchMatch) {
    cleanReply = cleanReply.replace(switchMatch[0], "").trim();
    executedActions.push("switch_request");
  }

  return { cleanReply, executedActions };
}
