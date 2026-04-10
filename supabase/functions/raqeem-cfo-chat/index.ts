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
    const { message, conversationHistory, cfo_user_id, stream: wantStream } = await req.json();

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

    const cfoId = cfo_user_id;

    // ── Fetch CFO context ──
    const [profileResult, pendingPaymentsResult, recentInvoicesResult, paymentsAwaitingResult] = await Promise.all([
      cfoId
        ? db.from("profiles").select("full_name_ar, full_name_en, phone").eq("user_id", cfoId).maybeSingle()
        : Promise.resolve({ data: null }),
      // Payments awaiting confirmation (proof uploaded but not yet confirmed)
      db.from("payments").select(`
        id, amount, payment_type, payment_stage, payment_status, created_at, proof_url,
        request:valuation_requests!payments_request_id_fkey ( id, client_name_ar ),
        assignment:valuation_assignments!payments_assignment_id_fkey ( id, reference_number, status )
      `).in("payment_status", ["proof_uploaded", "pending"]).order("created_at", { ascending: false }).limit(20),
      // Recent invoices
      db.from("invoices").select(`
        id, invoice_number, total_amount, payment_status, created_at, due_date,
        client:clients!invoices_client_id_fkey ( name_ar ),
        assignment:valuation_assignments!invoices_assignment_id_fkey ( reference_number, status )
      `).order("created_at", { ascending: false }).limit(15),
      // Assignments waiting for payment gate
      db.from("valuation_assignments").select(`
        id, reference_number, status, property_type, created_at,
        client:clients!valuation_assignments_client_id_fkey ( name_ar )
      `).in("status", ["scope_approved", "draft_approved"]).order("created_at", { ascending: false }).limit(15),
    ]);

    const cfoName = profileResult.data?.full_name_ar || profileResult.data?.full_name_en || "المدير المالي";
    const pendingPayments = pendingPaymentsResult.data || [];
    const recentInvoices = recentInvoicesResult.data || [];
    const awaitingPayment = paymentsAwaitingResult.data || [];

    // ── Status labels ──
    const statusLabels: Record<string, string> = {
      scope_approved: "بانتظار الدفعة الأولى",
      draft_approved: "بانتظار الدفعة النهائية",
      first_payment_confirmed: "الدفعة الأولى مؤكدة",
      final_payment_confirmed: "الدفعة النهائية مؤكدة",
      pending: "بانتظار السداد",
      proof_uploaded: "تم رفع إثبات السداد",
      paid: "مدفوع",
      rejected: "مرفوض",
      overdue: "متأخر",
    };

    const paymentStageLabels: Record<string, string> = {
      first: "الدفعة الأولى (50%)",
      final: "الدفعة النهائية (50%)",
      full: "دفعة كاملة (100%)",
    };

    // ── Build financial summary ──
    let financialSummary = "";

    // Pending payments
    if (pendingPayments.length > 0) {
      financialSummary += `\n## مدفوعات بانتظار التأكيد (${pendingPayments.length})\n`;
      for (const p of pendingPayments) {
        const ref = (p as any).assignment?.reference_number || "—";
        const client = (p as any).request?.client_name_ar || "—";
        const stage = paymentStageLabels[(p as any).payment_stage] || (p as any).payment_stage;
        const status = statusLabels[(p as any).payment_status] || (p as any).payment_status;
        financialSummary += `- ${ref} | ${client} | ${stage} | ${(p as any).amount} ر.س | ${status}\n`;
      }
    } else {
      financialSummary += "\n## مدفوعات بانتظار التأكيد\n- لا توجد مدفوعات معلقة حالياً.\n";
    }

    // Assignments awaiting payment
    if (awaitingPayment.length > 0) {
      financialSummary += `\n## طلبات بانتظار تأكيد مالي (${awaitingPayment.length})\n`;
      for (const a of awaitingPayment) {
        const ref = (a as any).reference_number || "—";
        const client = (a as any).client?.name_ar || "—";
        const status = statusLabels[(a as any).status] || (a as any).status;
        financialSummary += `- ${ref} | ${client} | ${status}\n`;
      }
    }

    // Recent invoices summary
    const unpaidInvoices = recentInvoices.filter((i: any) => i.payment_status !== "paid");
    if (unpaidInvoices.length > 0) {
      financialSummary += `\n## فواتير غير مسددة (${unpaidInvoices.length})\n`;
      for (const inv of unpaidInvoices.slice(0, 8)) {
        const invNum = (inv as any).invoice_number || "—";
        const client = (inv as any).client?.name_ar || "—";
        const total = (inv as any).total_amount || 0;
        const status = statusLabels[(inv as any).payment_status] || (inv as any).payment_status;
        financialSummary += `- ${invNum} | ${client} | ${total} ر.س | ${status}\n`;
      }
    }

    // KPIs
    const totalRevenue = recentInvoices.filter((i: any) => i.payment_status === "paid").reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
    const totalPending = unpaidInvoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
    financialSummary += `\n## ملخص مالي\n- الإيرادات المحصلة (آخر 15 فاتورة): ${totalRevenue} ر.س\n- المبالغ المعلقة: ${totalPending} ر.س\n- عدد المدفوعات المعلقة: ${pendingPayments.length}\n`;

    // ── System prompt ──
    const systemPrompt = `أنت "${AI.name}" — المساعد المالي داخل منصة جسّاس للتقييم.

## هويتك (إلزامية عند سؤال "من أنت؟")
عند سؤالك عن هويتك، أجب حرفياً:
"أنا ${AI.name} — مساعدك المالي داخل المنصة. أساعدك في مراقبة المدفوعات، التحقق من حالة السداد، تأكيد الدفعات، ومتابعة الدورة المالية للطلبات. أعمل ضمن صلاحيات المدير المالي فقط."
لا تذكر أبداً: التقييم العقاري التفصيلي، المعاينات الميدانية، إعداد التقارير، أو أي وصف خاص بدور المالك أو المعاين أو العميل.

## دورك
تساعد المدير المالي في إدارة الدورة المالية فقط. لا تملك صلاحيات المالك أو العميل أو المعاين.

## قواعد اللغة (إلزامية)
- اكتب بالعربية الفصحى المهنية دائماً.
- تأكد أن كل كلمة مكتملة وصحيحة إملائياً قبل الإرسال.
- لا ترسل أي جملة مقطوعة أو كلمة ناقصة.
- استخدم جملاً قصيرة ومباشرة (2-4 جمل كحد أقصى).
- استخدم الأرقام الغربية (0-9) دائماً.
- كن مختصراً وعملياً.

## صلاحياتك
يمكنك:
- عرض المدفوعات المعلقة وحالتها
- التحقق من حالة السداد لأي طلب
- تأكيد الدفعات (أولى / نهائية)
- توضيح أهلية الطلب للانتقال للمرحلة التالية
- عرض الطلبات التي تنتظر تأكيداً مالياً
- توضيح الفروقات أو النواقص المالية
- اقتراح الخطوة التالية

لا يمكنك:
- إلغاء الطلبات
- مراجعة التقارير الفنية
- تعديل بيانات العملاء
- إدارة المعاينات الميدانية
- إصدار التقارير

## إجراءات (Action Tokens)
- تأكيد الدفعة الأولى: [ACTION:CONFIRM_FIRST_PAYMENT:assignment_ref]
- تأكيد الدفعة النهائية: [ACTION:CONFIRM_FINAL_PAYMENT:assignment_ref]
- لا تنفّذ أي إجراء بدون تأكيد صريح من المدير المالي.
- عند طلب تأكيد دفعة، اعرض التفاصيل أولاً واطلب التأكيد.

## بوابة إثبات السداد (إلزامية — لا استثناء)
- لا يمكن تأكيد أي دفعة (أولى أو نهائية) إلا إذا كان إثبات السداد مرفوعاً في النظام.
- إذا لم يكن هناك إثبات سداد (proof_url أو مرفق إيصال)، يجب أن ترفض الطلب فوراً وتقول:
  "لا يمكن تأكيد الدفعة بدون إثبات سداد مرفوع في النظام. يرجى التأكد من رفع الإيصال أولاً."
- لا تُصدر Action Token إذا لم يكن هناك إثبات.
- هذا منطق حوكمة مالية إلزامي وليس اختيارياً.

## قواعد تشغيلية
- لا تعرض معرّفات تقنية (UUIDs). استخدم الأرقام المرجعية وأرقام الفواتير فقط.
- كل مبلغ يجب أن يُعرض بـ "ر.س" (ريال سعودي).
- عند عرض الحالة، استخدم المسميات العربية المعتمدة.
${cfoName ? `- اسم المدير المالي: ${cfoName}. رحّب باسمه في أول رسالة فقط.` : ""}

${financialSummary}`;

    // ── Build messages ──
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    if (conversationHistory?.length) {
      for (const msg of conversationHistory.slice(-6)) {
        if (msg.sender_type === "cfo" || msg.role === "user") {
          aiMessages.push({ role: "user", content: msg.content });
        } else {
          aiMessages.push({ role: "assistant", content: msg.content });
        }
      }
    }

    aiMessages.push({ role: "user", content: message });

    const model = "google/gemini-2.5-flash";

    // ── Helper: process action tokens ──
    async function processActions(reply: string) {
      let cleanReply = reply;
      const executedActions: string[] = [];

      // CONFIRM_FIRST_PAYMENT
      const firstPaymentMatch = cleanReply.match(/\[ACTION:CONFIRM_FIRST_PAYMENT:([^\]]+)\]/);
      if (firstPaymentMatch) {
        const refNum = firstPaymentMatch[1].trim();
        cleanReply = cleanReply.replace(firstPaymentMatch[0], "").trim();

        try {
          // Find assignment by reference number
          const { data: assignment } = await db.from("valuation_assignments")
            .select("id, status, reference_number")
            .eq("reference_number", refNum)
            .maybeSingle();

          if (!assignment) {
            cleanReply += `\n\n⚠️ لم يتم العثور على طلب بالرقم المرجعي: ${refNum}`;
          } else if (assignment.status !== "scope_approved") {
            cleanReply += `\n\n⚠️ الطلب ${refNum} ليس في مرحلة انتظار الدفعة الأولى.`;
          } else {
            // Use the centralized RPC
            const result = await db.rpc("update_request_status", {
              _assignment_id: assignment.id,
              _new_status: "first_payment_confirmed",
              _user_id: cfoId,
              _action_type: "normal",
              _reason: `تأكيد الدفعة الأولى عبر ${AI.name}`,
            });

            if (result.data?.success) {
              executedActions.push("confirm_first_payment");
              cleanReply += `\n\n✅ تم تأكيد الدفعة الأولى للطلب ${refNum} بنجاح. الطلب الآن جاهز للمرحلة التالية.`;
            } else {
              cleanReply += `\n\n⚠️ تعذر تأكيد الدفعة: ${result.data?.error || "خطأ غير معروف"}`;
            }

            // Audit log
            await db.from("audit_logs").insert({
              user_id: cfoId, action: "status_change" as any,
              table_name: "valuation_assignments", record_id: assignment.id,
              assignment_id: assignment.id,
              description: `المدير المالي أكد الدفعة الأولى عبر ${AI.name}`,
              new_data: { status: "first_payment_confirmed", ref: refNum },
              user_name: cfoName, user_role: "financial_manager",
            } as any).catch(() => {});
          }
        } catch (e) {
          cleanReply += "\n\n⚠️ خطأ أثناء تأكيد الدفعة الأولى.";
        }
      }

      // CONFIRM_FINAL_PAYMENT
      const finalPaymentMatch = cleanReply.match(/\[ACTION:CONFIRM_FINAL_PAYMENT:([^\]]+)\]/);
      if (finalPaymentMatch) {
        const refNum = finalPaymentMatch[1].trim();
        cleanReply = cleanReply.replace(finalPaymentMatch[0], "").trim();

        try {
          const { data: assignment } = await db.from("valuation_assignments")
            .select("id, status, reference_number")
            .eq("reference_number", refNum)
            .maybeSingle();

          if (!assignment) {
            cleanReply += `\n\n⚠️ لم يتم العثور على طلب بالرقم المرجعي: ${refNum}`;
          } else if (assignment.status !== "draft_approved") {
            cleanReply += `\n\n⚠️ الطلب ${refNum} ليس في مرحلة انتظار الدفعة النهائية.`;
          } else {
            const result = await db.rpc("update_request_status", {
              _assignment_id: assignment.id,
              _new_status: "final_payment_confirmed",
              _user_id: cfoId,
              _action_type: "normal",
              _reason: `تأكيد الدفعة النهائية عبر ${AI.name}`,
            });

            if (result.data?.success) {
              executedActions.push("confirm_final_payment");
              cleanReply += `\n\n✅ تم تأكيد الدفعة النهائية للطلب ${refNum} بنجاح. الطلب جاهز للإصدار.`;
            } else {
              cleanReply += `\n\n⚠️ تعذر تأكيد الدفعة: ${result.data?.error || "خطأ غير معروف"}`;
            }

            await db.from("audit_logs").insert({
              user_id: cfoId, action: "status_change" as any,
              table_name: "valuation_assignments", record_id: assignment.id,
              assignment_id: assignment.id,
              description: `المدير المالي أكد الدفعة النهائية عبر ${AI.name}`,
              new_data: { status: "final_payment_confirmed", ref: refNum },
              user_name: cfoName, user_role: "financial_manager",
            } as any).catch(() => {});
          }
        } catch {
          cleanReply += "\n\n⚠️ خطأ أثناء تأكيد الدفعة النهائية.";
        }
      }

      return { cleanReply, executedActions };
    }

    // ── Sanitize Arabic ──
    function sanitizeArabicReply(text: string): string {
      let clean = text;
      clean = clean.split(/\s+/).map(word => {
        if (!/[\u0600-\u06FF]/.test(word)) return word;
        const stripped = word.replace(/[\u064B-\u065F\u0670]/g, "");
        if (stripped.length >= 2) return word;
        return "";
      }).filter(Boolean).join(" ");
      clean = clean.replace(/\n{4,}/g, "\n\n\n");
      clean = clean.replace(/ {2,}/g, " ");
      return clean.trim();
    }

    // ── Suggested actions ──
    function buildSuggestedActions() {
      const actions: { label: string; message: string }[] = [];
      if (pendingPayments.length > 0) {
        actions.push({ label: "💳 المدفوعات المعلقة", message: "اعرض المدفوعات المعلقة" });
      }
      if (awaitingPayment.length > 0) {
        actions.push({ label: "📋 طلبات بانتظار تأكيد", message: "اعرض الطلبات التي تنتظر تأكيداً مالياً" });
      }
      if (unpaidInvoices.length > 0) {
        actions.push({ label: "📄 فواتير غير مسددة", message: "اعرض الفواتير غير المسددة" });
      }
      actions.push({ label: "📊 الملخص المالي", message: "اعرض الملخص المالي الحالي" });
      actions.push({ label: "❓ الخطوة التالية", message: "ما الإجراء المالي التالي المطلوب؟" });
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
        return new Response(JSON.stringify({ reply: "عذراً، يرجى المحاولة لاحقاً." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const readable = new ReadableStream({
        async start(controller) {
          const reader = aiResponse.body!.getReader();
          const decoder = new TextDecoder();
          const encoder = new TextEncoder();
          let fullReply = "";
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";

              for (const rawLine of lines) {
                const line = rawLine.trimEnd();
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;

                if (data === "[DONE]") {
                  const sanitizedReply = sanitizeArabicReply(fullReply);
                  const actionResult = await processActions(sanitizedReply);
                  const finalReply = sanitizeArabicReply(actionResult.cleanReply);
                  const meta = JSON.stringify({
                    done: true,
                    reply: finalReply,
                    suggestedActions: buildSuggestedActions(),
                    executedActions: actionResult.executedActions,
                  });
                  controller.enqueue(encoder.encode(`data: ${meta}\n\n`));
                  controller.close();

                  if (cfoId) {
                    db.from("client_chat_messages").insert({
                      user_id: cfoId,
                      session_id: `cfo-${cfoId}`,
                      role: "assistant",
                      content: finalReply,
                      metadata: { context: "cfo_chat" },
                    } as any).catch(() => {});
                  }
                  return;
                }

                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content || "";
                  if (delta) {
                    fullReply += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                  }
                } catch {}
              }
            }

            const remaining = buffer.trim();
            if (remaining.startsWith("data: ")) {
              const data = remaining.slice(6).trim();
              if (data && data !== "[DONE]") {
                try {
                  const parsed = JSON.parse(data);
                  const delta = parsed.choices?.[0]?.delta?.content || "";
                  if (delta) {
                    fullReply += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
                  }
                } catch {}
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

    if (cfoId) {
      db.from("client_chat_messages").insert({
        user_id: cfoId,
        session_id: `cfo-${cfoId}`,
        role: "assistant",
        content: reply,
        metadata: { context: "cfo_chat" },
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
    console.error("raqeem-cfo-chat error:", error);
    return new Response(JSON.stringify({ reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى." }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
