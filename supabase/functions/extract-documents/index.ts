import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function mimeCategory(mime: string): "image" | "pdf" | "excel" | "csv" | "word" | "zip" | "text" | "unsupported" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || mime === "application/vnd.ms-excel" || mime === "application/x-excel") return "excel";
  if (mime === "text/csv" || mime === "text/tab-separated-values") return "csv";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mime === "application/msword") return "word";
  if (mime === "application/zip" || mime === "application/x-zip-compressed" || mime === "application/x-rar-compressed" || mime === "application/x-7z-compressed" || mime === "application/gzip") return "zip";
  if (mime.startsWith("text/")) return "text";
  return "unsupported";
}

function guessExtMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xls: "application/vnd.ms-excel",
    csv: "text/csv", tsv: "text/tab-separated-values", pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", doc: "application/msword",
    zip: "application/zip", rar: "application/x-rar-compressed", "7z": "application/x-7z-compressed", gz: "application/gzip",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
    txt: "text/plain", json: "application/json", xml: "text/xml",
  };
  return map[ext] || "application/octet-stream";
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stripMarkdownCodeFences(value: string): string {
  return value.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

function detectTruncation(value: string): boolean {
  const text = value.trim();
  if (!text) return false;

  const openBraces = (text.match(/\{/g) || []).length;
  const closeBraces = (text.match(/\}/g) || []).length;
  const openBrackets = (text.match(/\[/g) || []).length;
  const closeBrackets = (text.match(/\]/g) || []).length;

  if (openBraces !== closeBraces || openBrackets !== closeBrackets) return true;

  return [/\.\.\.$/, /…$/, /\[truncated\]/i, /\[continued\]/i].some((pattern) => pattern.test(text));
}

function extractJsonFromText(value: string): Record<string, any> {
  const cleaned = stripMarkdownCodeFences(value);
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");

  let start = -1;
  let endChar = "}";
  if (objectStart === -1 && arrayStart === -1) throw new Error("No JSON object found in model response");
  if (objectStart === -1 || (arrayStart !== -1 && arrayStart < objectStart)) {
    start = arrayStart;
    endChar = "]";
  } else {
    start = objectStart;
  }

  const end = cleaned.lastIndexOf(endChar);
  if (start === -1 || end === -1 || end < start) throw new Error("Incomplete JSON detected in model response");

  let candidate = cleaned.slice(start, end + 1)
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  const parsed = JSON.parse(candidate);
  if (Array.isArray(parsed)) {
    return {
      discipline: "real_estate",
      discipline_label: "تقييم عقاري",
      confidence: 50,
      description: "",
      inventory: parsed,
      summary: { total: parsed.length, by_type: { real_estate: parsed.length, machinery_equipment: 0 }, by_condition: {} },
      notes: ["تم تحويل استجابة مصفوفة إلى تنسيق الجرد المعتمد تلقائياً"],
      documentCategories: [],
    };
  }

  if (!parsed || typeof parsed !== "object") throw new Error("Parsed JSON is not an object");
  return parsed as Record<string, any>;
}

function normalizeInventoryItem(item: any, index: number) {
  const normalizedType = item?.type === "machinery_equipment" ? "machinery_equipment" : item?.type === "mixed" ? "machinery_equipment" : "real_estate";
  const quantity = typeof item?.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : Number(item?.quantity || 1) || 1;
  return {
    id: typeof item?.id === "number" && Number.isFinite(item.id) ? item.id : index + 1,
    name: safeString(item?.name) || `أصل ${index + 1}`,
    type: normalizedType,
    category: safeString(item?.category) || (normalizedType === "machinery_equipment" ? "معدة" : "عقار"),
    subcategory: safeString(item?.subcategory) || undefined,
    quantity,
    condition: safeString(item?.condition) || "unknown",
    fields: Array.isArray(item?.fields)
      ? item.fields
          .filter((field: any) => field && typeof field === "object")
          .map((field: any) => ({
            key: safeString(field?.key) || `field_${index}_${crypto.randomUUID().slice(0, 8)}`,
            label: safeString(field?.label) || safeString(field?.key) || "حقل",
            value: field?.value == null ? "" : String(field.value),
            confidence: typeof field?.confidence === "number" && Number.isFinite(field.confidence)
              ? Math.min(100, Math.max(0, field.confidence))
              : 50,
          }))
      : [],
    source: safeString(item?.source) || "تحليل ذكي",
    confidence: typeof item?.confidence === "number" && Number.isFinite(item.confidence)
      ? Math.min(100, Math.max(0, item.confidence))
      : 50,
  };
}

function summarizeInventory(inventory: ReturnType<typeof normalizeInventoryItem>[]) {
  return inventory.reduce((acc, item) => {
    acc.total += 1;
    acc.by_type[item.type] = (acc.by_type[item.type] || 0) + 1;
    const condition = item.condition || "unknown";
    acc.by_condition[condition] = (acc.by_condition[condition] || 0) + 1;
    return acc;
  }, {
    total: 0,
    by_type: { real_estate: 0, machinery_equipment: 0 },
    by_condition: {} as Record<string, number>,
  });
}

function normalizeDocumentCategories(categories: any[], fileNames: string[]) {
  const normalized = Array.isArray(categories)
    ? categories
        .filter((category) => category && typeof category === "object")
        .map((category) => ({
          fileName: safeString(category?.fileName),
          category: safeString(category?.category) || "other",
          categoryLabel: safeString(category?.categoryLabel) || "أخرى",
          relevance: ["high", "medium", "low"].includes(category?.relevance) ? category.relevance : "medium",
          extractedInfo: safeString(category?.extractedInfo) || undefined,
        }))
        .filter((category) => category.fileName)
    : [];

  if (normalized.length > 0) return normalized;

  return fileNames.map((fileName) => ({
    fileName,
    category: "other",
    categoryLabel: "أخرى",
    relevance: "low",
    extractedInfo: undefined,
  }));
}

function normalizeExtractedResult(raw: any, fileNames: string[]) {
  const inventory = Array.isArray(raw?.inventory)
    ? raw.inventory.map((item: any, index: number) => normalizeInventoryItem(item, index))
    : [];

  const normalizedSummary = raw?.summary && typeof raw.summary === "object"
    ? {
        total: typeof raw.summary.total === "number" && Number.isFinite(raw.summary.total) ? raw.summary.total : inventory.length,
        by_type: {
          real_estate: Number(raw.summary.by_type?.real_estate || inventory.filter((item) => item.type === "real_estate").length),
          machinery_equipment: Number(raw.summary.by_type?.machinery_equipment || inventory.filter((item) => item.type === "machinery_equipment").length),
        },
        by_condition: raw.summary.by_condition && typeof raw.summary.by_condition === "object" ? raw.summary.by_condition : summarizeInventory(inventory).by_condition,
      }
    : summarizeInventory(inventory);

  const normalizedDiscipline = ["real_estate", "machinery_equipment", "mixed"].includes(raw?.discipline)
    ? raw.discipline
    : inventory.some((item) => item.type === "real_estate") && inventory.some((item) => item.type === "machinery_equipment")
      ? "mixed"
      : inventory.some((item) => item.type === "machinery_equipment")
        ? "machinery_equipment"
        : "real_estate";

  const disciplineLabelMap: Record<string, string> = {
    real_estate: "تقييم عقاري",
    machinery_equipment: "تقييم آلات ومعدات",
    mixed: "تقييم مختلط",
  };

  return {
    ...raw,
    discipline: normalizedDiscipline,
    discipline_label: safeString(raw?.discipline_label) || disciplineLabelMap[normalizedDiscipline],
    confidence: typeof raw?.confidence === "number" && Number.isFinite(raw.confidence) ? Math.min(100, Math.max(0, raw.confidence)) : 50,
    client: raw?.client && typeof raw.client === "object" ? {
      clientName: safeString(raw.client.clientName) || undefined,
      idNumber: safeString(raw.client.idNumber) || undefined,
      phone: safeString(raw.client.phone) || undefined,
      email: safeString(raw.client.email) || undefined,
    } : {},
    description: safeString(raw?.description),
    inventory,
    summary: normalizedSummary,
    suggestedPurpose: safeString(raw?.suggestedPurpose) || undefined,
    notes: Array.isArray(raw?.notes) ? raw.notes.map((note: any) => String(note)) : [],
    documentCategories: normalizeDocumentCategories(raw?.documentCategories, fileNames),
  };
}

function extractToolPayload(aiResult: any): Record<string, any> {
  const firstChoice = aiResult?.choices?.[0]?.message;
  const toolCall = firstChoice?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }

  const content = firstChoice?.content;
  if (typeof content === "string" && content.trim()) {
    if (detectTruncation(content)) {
      console.warn("Potential truncation detected in model content response");
    }
    return extractJsonFromText(content);
  }

  if (Array.isArray(content)) {
    const textContent = content
      .filter((item: any) => item?.type === "text" && typeof item?.text === "string")
      .map((item: any) => item.text)
      .join("\n")
      .trim();
    if (textContent) {
      if (detectTruncation(textContent)) {
        console.warn("Potential truncation detected in multimodal content response");
      }
      return extractJsonFromText(textContent);
    }
  }

  throw new Error("لم يتم العثور على JSON صالح في استجابة النموذج");
}

function excelToText(buf: Uint8Array, fileName: string): string {
  try {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const parts: string[] = [`📊 ملف إكسل: ${fileName}`];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length === 0) continue;
      parts.push(`\n── ورقة: ${sheetName} (${rows.length} صف) ──`);
      // Send ALL rows for complete inventory extraction
      const limit = Math.min(rows.length, 500);
      for (let r = 0; r < limit; r++) {
        parts.push(rows[r].map((c: any) => String(c ?? "")).join(" | "));
      }
      if (rows.length > limit) parts.push(`... و ${rows.length - limit} صف إضافي`);
    }
    return parts.join("\n");
  } catch (e) {
    return `[تعذر قراءة ملف إكسل ${fileName}: ${e}]`;
  }
}

async function docxToTextAsync(buf: Uint8Array, fileName: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return `[ملف Word فارغ: ${fileName}]`;
    const text = docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return `📄 ملف Word: ${fileName}\n${text.substring(0, 20000)}`;
  } catch (e) {
    return `[تعذر قراءة ملف Word ${fileName}: ${e}]`;
  }
}

async function processZip(buf: Uint8Array, fileName: string): Promise<{ texts: string[]; images: { name: string; base64: string; mimeType: string }[] }> {
  const texts: string[] = [];
  const images: { name: string; base64: string; mimeType: string }[] = [];
  try {
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.keys(zip.files);
    texts.push(`📦 ملف مضغوط: ${fileName} — يحتوي ${entries.length} ملف`);
    for (const entry of entries.slice(0, 100)) {
      const file = zip.files[entry];
      if (file.dir) continue;
      const innerMime = guessExtMime(entry);
      const cat = mimeCategory(innerMime);
      const innerBuf = await file.async("uint8array");
      if (cat === "image") images.push({ name: entry, base64: uint8ToBase64(innerBuf), mimeType: innerMime });
      else if (cat === "excel") texts.push(excelToText(innerBuf, entry));
      else if (cat === "csv" || cat === "text") texts.push(`📄 ${entry}:\n${new TextDecoder("utf-8").decode(innerBuf).substring(0, 10000)}`);
      else if (cat === "word") texts.push(await docxToTextAsync(innerBuf, entry));
      else if (cat === "pdf") images.push({ name: entry, base64: uint8ToBase64(innerBuf), mimeType: "application/pdf" });
      else texts.push(`📎 ${entry} (${innerMime})`);
    }
    if (entries.length > 100) texts.push(`... و ${entries.length - 100} ملف إضافي`);
  } catch (e) {
    texts.push(`[تعذر فك ضغط ${fileName}: ${e}]`);
  }
  return { texts, images };
}

// ── Tool schema for multi-asset inventory extraction ──
const EXTRACTION_TOOL = {
  type: "function",
  function: {
    name: "extract_valuation_data",
    description: "Extract structured multi-asset inventory from documents",
    parameters: {
      type: "object",
      properties: {
        discipline: { type: "string", enum: ["real_estate", "machinery_equipment", "mixed"] },
        discipline_label: { type: "string" },
        confidence: { type: "number" },
        client: {
          type: "object",
          properties: { clientName: { type: "string" }, idNumber: { type: "string" }, phone: { type: "string" }, email: { type: "string" } },
        },
        description: { type: "string", description: "وصف مهني شامل يعكس كل محتويات المستندات باللغة العربية" },
        inventory: {
          type: "array",
          description: "جرد كامل لكل الأصول المستخرجة — كل صف في إكسل = أصل منفصل",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              name: { type: "string", description: "اسم/وصف الأصل" },
              type: { type: "string", enum: ["real_estate", "machinery_equipment"] },
              category: { type: "string", description: "التصنيف الرئيسي (أرض، فيلا، حفار، مولد...)" },
              subcategory: { type: "string", description: "التصنيف الفرعي" },
              quantity: { type: "number" },
              condition: { type: "string", enum: ["excellent", "good", "fair", "poor", "scrap", "unknown"] },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    label: { type: "string" },
                    value: { type: "string" },
                    confidence: { type: "number", description: "0-100" },
                  },
                  required: ["key", "label", "value", "confidence"],
                },
              },
              source: { type: "string", description: "اسم الملف + الصفحة/الصف" },
              confidence: { type: "number" },
            },
            required: ["id", "name", "type", "quantity", "fields", "confidence"],
          },
        },
        summary: {
          type: "object",
          properties: {
            total: { type: "number" },
            by_type: { type: "object", properties: { real_estate: { type: "number" }, machinery_equipment: { type: "number" } } },
            by_condition: { type: "object" },
          },
        },
        suggestedPurpose: { type: "string" },
        notes: { type: "array", items: { type: "string" } },
        documentCategories: {
          type: "array",
          items: {
            type: "object",
            properties: {
              fileName: { type: "string" },
              category: { type: "string", enum: ["deed", "building_permit", "floor_plan", "property_photo", "machinery_photo", "identity_doc", "invoice", "contract", "technical_report", "location_map", "spreadsheet", "archive", "other"] },
              categoryLabel: { type: "string" },
              relevance: { type: "string", enum: ["high", "medium", "low"] },
              extractedInfo: { type: "string" },
            },
            required: ["fileName", "category", "categoryLabel", "relevance"],
          },
        },
      },
      required: ["discipline", "discipline_label", "confidence", "description", "inventory", "summary", "notes", "documentCategories"],
    },
  },
};

const SYSTEM_PROMPT = `أنت محرك استخراج بيانات وجرد أصول متقدم متخصص في التقييم العقاري وتقييم الآلات والمعدات في المملكة العربية السعودية.

مهمتك الأساسية: تحليل جميع المستندات المرفوعة واستخراج **جرد كامل ودقيق** لكل الأصول.

## قواعد الجرد:
1. **كل صف في جدول إكسل = أصل منفصل** بكل بياناته (لا تدمج الصفوف)
2. **كل صورة لآلة/معدة = أصل** مع استخراج البيانات المرئية
3. **كل عقار مذكور = أصل** منفصل
4. لا حد أقصى لعدد الأصول — استخرج كل ما تجده

## الحقول الديناميكية حسب النوع:

### عقارات (real_estate):
deed_number (رقم الصك), area_sqm (المساحة م²), classification (التصنيف: سكني/تجاري/زراعي/صناعي), building_age (عمر المبنى), floors_count (عدد الطوابق), construction_type (نوع البناء), finishing_level (مستوى التشطيب), facades (الواجهات), rooms_count (عدد الغرف), services (الخدمات), plot_number (رقم القطعة), plan_number (رقم المخطط), street_width (عرض الشارع), building_area_sqm (مساحة البناء)

### آلات ومعدات (machinery_equipment):
machine_name (اسم الآلة/المعدة), manufacturer (الشركة المصنعة), model (الموديل), year_manufactured (سنة الصنع), serial_number (الرقم التسلسلي), country_of_origin (بلد المنشأ), operating_hours (ساعات التشغيل), odometer_km (عداد الكيلومترات), operational_status (الحالة التشغيلية: تعمل/متوقفة/تحتاج صيانة/خردة), capacity (السعة/القدرة), weight_tons (الوزن بالطن), dimensions (الأبعاد), last_maintenance (تاريخ آخر صيانة), fuel_type (نوع الوقود/الطاقة), accessories (الملحقات والإضافات), operating_license (رخصة التشغيل)

## تحديد التخصص:
- كل الأصول عقارات → "real_estate"
- كل الأصول آلات/معدات/مركبات/أجهزة → "machinery_equipment"
- خليط → "mixed"

## الوصف:
يجب أن يكون وصفاً مهنياً تفصيلياً شاملاً يعكس كل محتويات الملفات: المواصفات الفيزيائية، الحالة، البيانات المالية/القانونية، الموقع، وأي معلومة ذات صلة.

## نسب الثقة:
- 90-100%: بيانات مقروءة بوضوح من المستند
- 70-89%: مستنتج من السياق بثقة عالية
- 50-69%: تقدير تقريبي
- أقل من 50%: تخمين

## ملاحظات حاسمة:
- لا تقتصر على حقول محددة — استخرج كل ما تجده من بيانات
- اذكر مصدر كل أصل (اسم الملف + الصفحة أو رقم الصف)
- كن شاملاً ودقيقاً`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { fileNames, fileDescriptions, storagePaths } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const visionItems: { name: string; base64: string; mimeType: string }[] = [];
    const textExtractions: string[] = [];

    if (storagePaths?.length > 0) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      // Process files in parallel batches of 10
      const batchSize = 10;
      for (let i = 0; i < storagePaths.length; i += batchSize) {
        const batch = storagePaths.slice(i, i + batchSize);
        await Promise.all(batch.map(async (sp: any) => {
          try {
            const { data, error } = await supabase.storage.from("client-uploads").download(sp.path);
            if (error || !data) { console.error(`Download failed ${sp.path}:`, error); return; }
            const bytes = new Uint8Array(await data.arrayBuffer());
            const mime = sp.mimeType || guessExtMime(sp.name || sp.path);
            const cat = mimeCategory(mime);
            switch (cat) {
              case "image": visionItems.push({ name: sp.name, base64: uint8ToBase64(bytes), mimeType: mime }); break;
              case "pdf": visionItems.push({ name: sp.name, base64: uint8ToBase64(bytes), mimeType: mime }); break;
              case "excel": textExtractions.push(excelToText(bytes, sp.name)); break;
              case "csv": case "text": textExtractions.push(`📄 ${sp.name}:\n${new TextDecoder("utf-8").decode(bytes).substring(0, 15000)}`); break;
              case "word": textExtractions.push(await docxToTextAsync(bytes, sp.name)); break;
              case "zip": { const r = await processZip(bytes, sp.name); textExtractions.push(...r.texts); visionItems.push(...r.images); break; }
              default: textExtractions.push(`📎 ${sp.name} (${mime})`);
            }
          } catch (e) { console.error(`Failed ${sp.path}:`, e); }
        }));
      }
    }

    // Build multimodal user message
    const userContent: any[] = [];
    const hasContent = visionItems.length > 0 || textExtractions.length > 0;

    if (hasContent) {
      userContent.push({ type: "text", text: `تم رفع ${fileNames.length} مستند. حلل المحتوى واستخرج جرد كامل لكل الأصول:` });
      if (textExtractions.length > 0) {
        userContent.push({ type: "text", text: `\n=== محتوى مستخرج ===\n${textExtractions.join("\n\n")}` });
      }
      for (const item of visionItems) {
        const idx = fileNames.findIndex((n: string) => n === item.name);
        const hint = idx >= 0 ? fileDescriptions?.[idx] : "";
        userContent.push({ type: "text", text: `\n--- ملف: ${item.name}${hint ? ` — تصنيف: ${hint}` : ""} ---` });
        if (item.mimeType.startsWith("image/") || item.mimeType === "application/pdf") {
          userContent.push({ type: "image_url", image_url: { url: `data:${item.mimeType};base64,${item.base64}` } });
        }
      }
    } else {
      userContent.push({ type: "text", text: `الملفات (${fileNames.length}):\n${fileNames.map((n: string, i: number) => `${i + 1}. ${n}${fileDescriptions?.[i] ? ` — ${fileDescriptions[i]}` : ""}`).join("\n")}` });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: userContent }],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "extract_valuation_data" } },
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const status = response.status;
      if (status === 429) return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI error:", status, t);
      return new Response(JSON.stringify({ error: "خطأ في التحليل الذكي" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResult = await response.json();
    const extracted = normalizeExtractedResult(extractToolPayload(aiResult), fileNames);

    // Post-process discipline from document categories
    const cats = (extracted.documentCategories || []).map((d: any) => d.category);
    const hasProp = cats.some((c: string) => ["deed", "building_permit", "floor_plan", "property_photo", "location_map"].includes(c));
    const hasMach = cats.some((c: string) => c === "machinery_photo");
    if (hasMach && !hasProp) { extracted.discipline = "machinery_equipment"; extracted.discipline_label = "تقييم آلات ومعدات"; }
    else if (hasMach && hasProp) { extracted.discipline = "mixed"; extracted.discipline_label = "تقييم مختلط"; }

    // Metadata
    extracted.analysisMethod = hasContent ? "content_analysis" : "filename_only";
    extracted.analyzedFilesCount = visionItems.length + textExtractions.length;
    extracted.totalFilesCount = fileNames.length;

    if (extracted.inventory.length === 0 && !extracted.description) {
      extracted.notes = [...(extracted.notes || []), "تعذر استخراج أصول قابلة للعرض من المستندات الحالية"];
    }

    return new Response(JSON.stringify(extracted), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("extract-documents error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
