import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Constants ──
const MAX_CHUNK_SIZE = 45000; // chars per chunk for RAG
const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ── Helpers ──

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function mimeCategory(mime: string): string {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime === "application/vnd.ms-excel") return "excel";
  if (mime === "text/csv" || mime === "text/tab-separated-values") return "csv";
  if (mime.includes("wordprocessing") || mime === "application/msword") return "word";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

function guessExtMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel", csv: "text/csv", pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword", jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", txt: "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

function chunkText(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxSize, text.length);
    // Try to break at a newline
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > start + maxSize * 0.5) end = nl + 1;
    }
    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

async function callAI(apiKey: string, messages: any[], tools?: any[], toolChoice?: any, model = "openai/gpt-5"): Promise<any> {
  const body: any = { model, messages, temperature: 0.1 };
  if (tools) { body.tools = tools; body.tool_choice = toolChoice; }
  
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const resp = await fetch(AI_GATEWAY, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      });
      clearTimeout(timeout);
      if (resp.status === 429 && attempt === 0) { await new Promise(r => setTimeout(r, 3000)); continue; }
      if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
      return await resp.json();
    } catch (e) {
      clearTimeout(timeout);
      if (attempt === 0) continue;
      throw e;
    }
  }
}

function extractContent(aiResult: any): string {
  return aiResult?.choices?.[0]?.message?.content || "";
}

function extractToolArgs(aiResult: any): any {
  const tc = aiResult?.choices?.[0]?.message?.tool_calls?.[0];
  if (tc?.function?.arguments) return JSON.parse(tc.function.arguments);
  // Fallback: parse from content
  const content = extractContent(aiResult);
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
  return {};
}

// ── Analysis Tool Schema ──
const ANALYSIS_TOOL = {
  type: "function",
  function: {
    name: "document_analysis_result",
    description: "Return structured document analysis pipeline result",
    parameters: {
      type: "object",
      properties: {
        file_classifications: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fileName: { type: "string" },
              documentType: { type: "string", description: "قوائم مالية/دراسة جدوى/عقود/تقارير تشغيل/جرد أصول/صكوك/رخص/أخرى" },
              sector: { type: "string", description: "عقار/آلات ومعدات/طاقة/تأجير/صناعي/زراعي/أخرى" },
              relevance: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["fileName", "documentType", "sector", "relevance"],
          },
        },
        extracted_metrics: {
          type: "object",
          properties: {
            revenue: { type: "number", description: "الإيرادات (ر.س)" },
            ebitda: { type: "number" },
            ebitda_margin_pct: { type: "number" },
            capex: { type: "number" },
            opex: { type: "number" },
            net_profit: { type: "number" },
            total_assets_value: { type: "number" },
            total_assets_count: { type: "number" },
            occupancy_rate_pct: { type: "number" },
            operating_hours: { type: "number" },
            contract_value: { type: "number" },
            contract_duration_months: { type: "number" },
            periods_covered: { type: "array", items: { type: "string" } },
            currency: { type: "string" },
          },
        },
        validation_results: {
          type: "object",
          properties: {
            balance_sheet_balanced: { type: "boolean", description: "الأصول = الالتزامات + حقوق الملكية" },
            margins_reasonable: { type: "boolean", description: "هوامش تشغيلية ضمن نطاق القطاع" },
            period_comparison_ok: { type: "boolean", description: "لا يوجد نمو/انخفاض غير طبيعي بين الفترات" },
            consistency_passed: { type: "boolean" },
            validation_notes: { type: "array", items: { type: "string" } },
          },
        },
        anomalies: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              description: { type: "string" },
              severity: { type: "string", enum: ["high", "medium", "low"] },
            },
            required: ["field", "description", "severity"],
          },
        },
        methodology_mapping: {
          type: "object",
          properties: {
            recommended: { type: "string", enum: ["income", "cost", "market", "mixed"], description: "المنهج الموصى به" },
            justification: { type: "string", description: "التبرير المهني" },
            income_applicable: { type: "boolean" },
            income_reason: { type: "string" },
            cost_applicable: { type: "boolean" },
            cost_reason: { type: "string" },
            market_applicable: { type: "boolean" },
            market_reason: { type: "string" },
            assumptions: { type: "array", items: { type: "string" }, description: "3-5 افتراضات جوهرية" },
            data_sources: { type: "array", items: { type: "string" } },
          },
        },
        compliance_status: {
          type: "object",
          properties: {
            ivs_2025: { type: "string", description: "متوافق/يتطلب إفصاح إضافي/غير متوافق" },
            ivs_notes: { type: "array", items: { type: "string" } },
            taqeem: { type: "string", description: "ضمن النطاق/خارج النطاق" },
            taqeem_notes: { type: "array", items: { type: "string" } },
            accounting: { type: "string", description: "IFRS/GAAP/غير محدد" },
            accounting_notes: { type: "array", items: { type: "string" } },
          },
        },
        executive_brief: {
          type: "object",
          properties: {
            file_types_summary: { type: "string" },
            verified_items: { type: "string" },
            initial_finding: { type: "string", description: "اتجاه ربحي/مخاطر/قابلية تقييم" },
          },
        },
        identified_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              missing_item: { type: "string" },
              impact: { type: "string" },
              priority: { type: "string", enum: ["critical", "high", "medium", "low"] },
            },
            required: ["missing_item", "impact", "priority"],
          },
        },
        recommendations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string" },
              time_impact: { type: "string" },
              financial_impact: { type: "string" },
            },
            required: ["action"],
          },
        },
        required_decision: { type: "string" },
        confidence_score: { type: "number", description: "0-100" },
      },
      required: [
        "file_classifications", "extracted_metrics", "validation_results",
        "methodology_mapping", "compliance_status", "executive_brief",
        "identified_gaps", "recommendations", "confidence_score",
      ],
    },
  },
};

const PIPELINE_SYSTEM_PROMPT = `أنت محرك تحليل مستندات تقييمية تنفيذي — الأدق في المملكة العربية السعودية.
مهمتك تطبيق خط أنابيب كامل على المستندات المرفقة وإنتاج نتائج مهنية قابلة للدفاع أمام CFO/CEO.

## المراحل الإلزامية:

### 1. التصنيف (Classify)
- صنّف كل ملف: قوائم مالية / دراسة جدوى / عقود / تقارير تشغيل / جرد أصول / صكوك / رخص
- حدّد القطاع: عقار، آلات ومعدات، طاقة، تأجير، صناعي، زراعي

### 2. الاستخراج (Extract)
- استخرج كل المؤشرات المالية والتشغيلية الممكنة:
  - إيرادات، EBITDA، CAPEX، OPEX، صافي الربح
  - أعداد/قيم الأصول، نسب إشغال، ساعات تشغيل
  - شروط عقود ومدد وقيم
- وحّد إلى ريال سعودي وتاريخ ميلادي ومتر مربع

### 3. التحقق (Validate)
- اختبر اتساق القوائم المالية (أصول = التزامات + حقوق ملكية)
- تحقق من هوامش تشغيلية منطقية
- قارن بين الفترات لاكتشاف تغيرات غير طبيعية
- حدّد أي قيم شاذة (Outliers)

### 4. الربط بالتقييم (Map to Valuation)
- حدّد المنهج الأنسب (دخل/تكلفة/سوق) مع تبرير مهني
- وضّح لماذا كل منهج ملائم أو غير ملائم
- حدّد 3-5 افتراضات جوهرية
- مرجعية: IVS 105

### 5. فحص الامتثال (Compliance)
- IVS 2025: متوافق أو يتطلب إفصاح إضافي
- TAQEEM: ضمن أو خارج نطاق الترخيص
- معايير محاسبية: IFRS/GAAP إن وُجدت قوائم مالية

### 6. التوليف التنفيذي (Synthesize)
- ملخص تنفيذي: نوع الملفات، ما تم التحقق منه، النتيجة الأولية

### 7. تحديد الفجوات (Gaps)
- كل فجوة: البيان الناقص + الأثر + الأولوية
- رتّب حسب الأثر (الأعلى أولاً)

### 8. التوصيات (Recommend)
- قرار واضح أو خيارات مع الأثر الزمني والمالي

## قواعد إلزامية:
- استخدم العربية الفصحى المهنية
- لا تخمّن أرقاماً — استخرج فقط ما هو موجود فعلاً
- كل رقم يجب أن يكون مدعوماً بمصدر
- إذا لم تتوفر بيانات لقسم معين، اذكره كفجوة`;

// ── Main ──

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const {
      requestId, assignmentId, organizationId, userId,
      // Option A: provide file references to download from storage
      storagePaths,
      // Option B: provide pre-extracted text content (from extract-documents)
      preExtractedContent,
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Create analysis record ──
    const { data: analysis, error: insertErr } = await supabase
      .from("document_analyses")
      .insert({
        request_id: requestId || null,
        assignment_id: assignmentId || null,
        organization_id: organizationId || null,
        analyzed_by: userId || null,
        status: "processing",
        source_files: storagePaths || [],
      })
      .select("id")
      .single();

    if (insertErr) console.error("Insert analysis record failed:", insertErr);
    const analysisId = analysis?.id;

    // ── Stage 1: Ingest — Download and extract text content ──
    let textContent = "";
    const fileNames: string[] = [];
    const visionItems: { name: string; base64: string; mimeType: string }[] = [];

    if (preExtractedContent) {
      textContent = typeof preExtractedContent === "string"
        ? preExtractedContent
        : JSON.stringify(preExtractedContent, null, 2);
      fileNames.push(...(storagePaths || []).map((sp: any) => sp.name || sp.path));
    } else if (storagePaths?.length > 0) {
      // Dynamic import for XLSX
      const XLSX = await import("https://esm.sh/xlsx@0.18.5");
      
      for (const sp of storagePaths) {
        const fileName = sp.name || sp.path?.split("/").pop() || "unknown";
        fileNames.push(fileName);
        try {
          const { data, error } = await supabase.storage.from("client-uploads").download(sp.path);
          if (error || !data) { console.error(`Download failed: ${sp.path}`); continue; }
          const bytes = new Uint8Array(await data.arrayBuffer());
          const mime = sp.mimeType || guessExtMime(fileName);
          const cat = mimeCategory(mime);

          if (cat === "image" || cat === "pdf") {
            visionItems.push({ name: fileName, base64: uint8ToBase64(bytes), mimeType: mime });
          } else if (cat === "excel") {
            const wb = XLSX.read(bytes, { type: "array", cellDates: true });
            for (const sheetName of wb.SheetNames) {
              const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: "" });
              textContent += `\n📊 ${fileName} — ورقة: ${sheetName} (${rows.length} صف)\n`;
              const limit = Math.min(rows.length, 1000);
              for (let r = 0; r < limit; r++) {
                textContent += rows[r].map((c: any) => String(c ?? "")).join(" | ") + "\n";
              }
              if (rows.length > limit) textContent += `... و ${rows.length - limit} صف إضافي\n`;
            }
          } else if (cat === "csv" || cat === "text") {
            textContent += `\n📄 ${fileName}:\n${new TextDecoder("utf-8").decode(bytes).substring(0, 30000)}\n`;
          } else {
            textContent += `\n📎 ${fileName} (${mime})\n`;
          }
        } catch (e) {
          console.error(`Failed to process ${sp.path}:`, e);
        }
      }
    }

    // ── Stage 2-9: Run full analysis pipeline via AI with chunking ──
    const chunks = chunkText(textContent, MAX_CHUNK_SIZE);
    let fullContent = "";

    if (chunks.length <= 1) {
      fullContent = textContent;
    } else {
      // Multi-chunk RAG: summarize each chunk first, then analyze combined
      const chunkSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const summaryResult = await callAI(LOVABLE_API_KEY, [
          {
            role: "system",
            content: "استخرج المؤشرات المالية والتشغيلية الرئيسية من هذا الجزء من المستندات بدقة. أعد النتائج بصيغة نقطية مختصرة.",
          },
          {
            role: "user",
            content: `الجزء ${i + 1} من ${chunks.length}:\n${chunks[i]}`,
          },
        ], undefined, undefined, "openai/gpt-5-mini");
        chunkSummaries.push(`=== ملخص الجزء ${i + 1} ===\n${extractContent(summaryResult)}`);
      }
      fullContent = chunkSummaries.join("\n\n");
    }

    // Build user message
    const userContent: any[] = [];
    userContent.push({
      type: "text",
      text: `تم رفع ${fileNames.length} مستند. طبّق خط الأنابيب الكامل (تصنيف → استخراج → تحقق → ربط بالتقييم → امتثال → توليف → فجوات → توصيات).\n\nالملفات: ${fileNames.join("، ")}\n\n=== المحتوى ===\n${fullContent.substring(0, 80000)}`,
    });

    // Add vision items (max 15 for stability)
    for (const item of visionItems.slice(0, 15)) {
      userContent.push({ type: "text", text: `\n--- ملف: ${item.name} ---` });
      if (item.mimeType.startsWith("image/") || item.mimeType === "application/pdf") {
        userContent.push({ type: "image_url", image_url: { url: `data:${item.mimeType};base64,${item.base64}` } });
      }
    }

    const aiResult = await callAI(
      LOVABLE_API_KEY,
      [
        { role: "system", content: PIPELINE_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      [ANALYSIS_TOOL],
      { type: "function", function: { name: "document_analysis_result" } },
    );

    const result = extractToolArgs(aiResult);
    const processingDuration = Date.now() - startTime;

    // ── Save to database ──
    const methodologyLabels: Record<string, string> = {
      income: "أسلوب الدخل", cost: "أسلوب التكلفة",
      market: "أسلوب المقارنة السوقية", mixed: "أساليب متعددة",
    };

    const updatePayload = {
      status: "completed",
      file_classifications: result.file_classifications || [],
      extracted_metrics: result.extracted_metrics || {},
      validation_results: result.validation_results || {},
      consistency_passed: result.validation_results?.consistency_passed ?? false,
      anomalies: result.anomalies || [],
      recommended_methodology: methodologyLabels[result.methodology_mapping?.recommended] || result.methodology_mapping?.recommended,
      methodology_justification: result.methodology_mapping?.justification,
      methodology_mapping: result.methodology_mapping || {},
      compliance_status: result.compliance_status || {},
      ivs_alignment: result.compliance_status?.ivs_2025,
      taqeem_alignment: result.compliance_status?.taqeem,
      accounting_standards: result.compliance_status?.accounting,
      executive_brief: result.executive_brief || {},
      key_metrics: result.extracted_metrics || {},
      identified_gaps: result.identified_gaps || [],
      gap_impact_summary: (result.identified_gaps || [])
        .filter((g: any) => g.priority === "critical" || g.priority === "high")
        .map((g: any) => g.missing_item)
        .join("، ") || null,
      recommendations: result.recommendations || [],
      required_decision: result.required_decision || null,
      confidence_score: result.confidence_score || 0,
      ai_model_used: "openai/gpt-5",
      processing_duration_ms: processingDuration,
    };

    if (analysisId) {
      await supabase
        .from("document_analyses")
        .update(updatePayload)
        .eq("id", analysisId);
    }

    return new Response(JSON.stringify({
      success: true,
      analysisId,
      ...result,
      processingDuration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("analyze-documents error:", e);
    return new Response(JSON.stringify({
      success: false,
      error: e instanceof Error ? e.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
