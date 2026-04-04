import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── helpers ──────────────────────────────────────────────────────────

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function mimeCategory(mime: string): "image" | "pdf" | "excel" | "csv" | "word" | "zip" | "text" | "unsupported" {
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.ms-excel" ||
    mime === "application/x-excel"
  ) return "excel";
  if (mime === "text/csv" || mime === "text/tab-separated-values") return "csv";
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mime === "application/msword"
  ) return "word";
  if (
    mime === "application/zip" ||
    mime === "application/x-zip-compressed" ||
    mime === "application/x-rar-compressed" ||
    mime === "application/x-7z-compressed" ||
    mime === "application/gzip"
  ) return "zip";
  if (mime.startsWith("text/")) return "text";
  return "unsupported";
}

function guessExtMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    gz: "application/gzip",
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp", gif: "image/gif",
    txt: "text/plain", json: "application/json", xml: "text/xml",
  };
  return map[ext] || "application/octet-stream";
}

/** Convert an Excel workbook buffer to a concise text representation */
function excelToText(buf: Uint8Array, fileName: string): string {
  try {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const parts: string[] = [`📊 ملف إكسل: ${fileName}`];
    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (rows.length === 0) continue;
      parts.push(`\n── ورقة: ${sheetName} (${rows.length} صف) ──`);
      // Include up to 200 rows to stay within limits
      const limit = Math.min(rows.length, 200);
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

/** Extract text content from a DOCX buffer (simplified XML extraction) */
function docxToText(buf: Uint8Array, fileName: string): string {
  try {
    const zip = new JSZip();
    // JSZip loadAsync is async but we need sync; use workaround
    // Actually we will handle this in the async flow
    return `__DOCX_PENDING__${fileName}`;
  } catch {
    return `[تعذر قراءة ملف Word ${fileName}]`;
  }
}

async function docxToTextAsync(buf: Uint8Array, fileName: string): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return `[ملف Word فارغ: ${fileName}]`;
    // Strip XML tags to get plain text
    const text = docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    return `📄 ملف Word: ${fileName}\n${text.substring(0, 15000)}`;
  } catch (e) {
    return `[تعذر قراءة ملف Word ${fileName}: ${e}]`;
  }
}

/** Process a ZIP file, extracting readable contents */
async function processZip(
  buf: Uint8Array,
  fileName: string,
  supabase: any
): Promise<{ texts: string[]; images: { name: string; base64: string; mimeType: string }[] }> {
  const texts: string[] = [];
  const images: { name: string; base64: string; mimeType: string }[] = [];
  try {
    const zip = await JSZip.loadAsync(buf);
    const entries = Object.keys(zip.files);
    texts.push(`📦 ملف مضغوط: ${fileName} — يحتوي ${entries.length} ملف`);

    for (const entry of entries.slice(0, 50)) {
      const file = zip.files[entry];
      if (file.dir) continue;
      const innerMime = guessExtMime(entry);
      const cat = mimeCategory(innerMime);
      const innerBuf = await file.async("uint8array");

      if (cat === "image") {
        images.push({ name: entry, base64: uint8ToBase64(innerBuf), mimeType: innerMime });
      } else if (cat === "excel") {
        texts.push(excelToText(innerBuf, entry));
      } else if (cat === "csv" || cat === "text") {
        const decoder = new TextDecoder("utf-8");
        const txt = decoder.decode(innerBuf).substring(0, 10000);
        texts.push(`📄 ${entry}:\n${txt}`);
      } else if (cat === "word") {
        texts.push(await docxToTextAsync(innerBuf, entry));
      } else if (cat === "pdf") {
        // PDFs inside ZIPs: send as images to AI
        images.push({ name: entry, base64: uint8ToBase64(innerBuf), mimeType: "application/pdf" });
      } else {
        texts.push(`📎 ${entry} (${innerMime}) — ملف غير مدعوم للقراءة المباشرة`);
      }
    }
    if (entries.length > 50) texts.push(`... و ${entries.length - 50} ملف إضافي لم يتم معالجته`);
  } catch (e) {
    texts.push(`[تعذر فك ضغط ${fileName}: ${e}]`);
  }
  return { texts, images };
}

// ── main handler ─────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileNames, fileDescriptions, storagePaths, requestId: _requestId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Collect multimodal content & text extractions
    const visionItems: { name: string; base64: string; mimeType: string }[] = [];
    const textExtractions: string[] = [];

    if (storagePaths && storagePaths.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      for (const sp of storagePaths) {
        try {
          const { data, error } = await supabase.storage.from("client-uploads").download(sp.path);
          if (error || !data) {
            console.error(`Download failed ${sp.path}:`, error);
            continue;
          }

          const arrayBuf = await data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          const mime = sp.mimeType || guessExtMime(sp.name || sp.path);
          const cat = mimeCategory(mime);

          switch (cat) {
            case "image":
              visionItems.push({ name: sp.name, base64: uint8ToBase64(bytes), mimeType: mime });
              break;
            case "pdf":
              visionItems.push({ name: sp.name, base64: uint8ToBase64(bytes), mimeType: mime });
              break;
            case "excel":
              textExtractions.push(excelToText(bytes, sp.name));
              break;
            case "csv":
            case "text": {
              const decoder = new TextDecoder("utf-8");
              const txt = decoder.decode(bytes).substring(0, 15000);
              textExtractions.push(`📄 ${sp.name}:\n${txt}`);
              break;
            }
            case "word":
              textExtractions.push(await docxToTextAsync(bytes, sp.name));
              break;
            case "zip": {
              const zipResult = await processZip(bytes, sp.name, supabase);
              textExtractions.push(...zipResult.texts);
              visionItems.push(...zipResult.images);
              break;
            }
            default:
              textExtractions.push(`📎 ${sp.name} (${mime}) — نوع ملف غير مدعوم للقراءة المباشرة، سيتم التصنيف حسب اسم الملف`);
          }
        } catch (e) {
          console.error(`Failed to process ${sp.path}:`, e);
        }
      }
    }

    const systemPrompt = `أنت محرك استخراج بيانات متقدم متخصص في التقييم العقاري والآلات والمعدات في المملكة العربية السعودية.

مهمتك: تحليل جميع المستندات والملفات المرفوعة (صور، PDF، إكسل، Word، CSV، ملفات مضغوطة) واستخراج كل المعلومات بدقة عالية جداً.

تعليمات حاسمة:
1. **وصف الأصل**: يجب أن يكون وصفاً مهنياً تفصيلياً شاملاً باللغة العربية يعكس كل محتويات المستندات والصور. يشمل:
   - الوصف الفيزيائي الكامل (المساحات، الأبعاد، المواصفات الفنية)
   - الحالة العامة والتفاصيل الدقيقة من الصور
   - البيانات المالية أو القانونية المستخرجة من الجداول والمستندات
   - الموقع والعنوان إن وُجد
   - أي معلومة أخرى ذات صلة بالتقييم
   
2. **نوع التقييم** (real_estate / machinery / mixed) مع مستوى الثقة

3. **بيانات العميل**: الاسم، رقم الهوية/السجل التجاري، الهاتف، البريد

4. **حقول الأصل الديناميكية (assetFields)**: استخرج كل البيانات المتاحة كحقول منفصلة:
   - **عقاري**: المساحة، رقم الصك، التصنيف، عدد الطوابق، سنة البناء، نوع الإنشاء، عدد الوحدات، مساحة البناء، عرض الشارع، التشطيب، إلخ
   - **آلات ومعدات**: اسم المعدة، الشركة المصنعة، الموديل، سنة الصنع، الرقم التسلسلي، الحالة، القدرة/السعة، ساعات التشغيل، نوع الوقود، بلد المنشأ، إلخ
   - **من جداول الإكسل**: استخرج كل عمود كحقل منفصل مع قيمته
   - لا تقتصر على حقول محددة — استخرج كل ما تجده

5. **تصنيف كل مستند**: نوعه وأهميته

6. **البيانات المستخرجة**: كل الأرقام والتواريخ والأسماء والعناوين

تعليمات خاصة بالملفات:
- **إكسل/CSV**: حلل كل صف وعمود واستخرج البيانات المهمة كحقول ديناميكية. إذا كان الجدول يحتوي على قائمة معدات أو أصول، استخرج كل عنصر.
- **PDF**: حلل النصوص والجداول والصور المضمنة.
- **الصور**: حلل المحتوى المرئي بدقة (نوع المبنى، حالته، المعدات، الأرقام المكتوبة).
- **Word**: استخرج النصوص والجداول.
- **ملفات مضغوطة**: تم فك ضغطها مسبقاً — حلل كل ملف داخلها.

تعليمات حقول الأصل (assetFields):
- كل حقل يجب أن يكون له key فريد بالإنجليزية (مثل area, deedNumber, machineName)
- كل حقل يجب أن يكون له label عربي واضح
- كل حقل يجب أن يكون له نسبة ثقة (0-100) تعكس مدى تأكدك من القيمة
- حدد مصدر الاستخراج (اسم المستند)
- صنّف كل حقل ضمن مجموعة: property, machinery, financial, legal, general
- كن شاملاً — استخرج أكبر عدد ممكن من الحقول

قواعد التصنيف:
- صك / صك إلكتروني = deed
- رخصة بناء / تصريح = building_permit
- مخطط معماري / كروكي = floor_plan
- صورة مبنى / أرض / واجهة / أصل عقاري = property_photo
- صورة حفار / شيول / مولد / خط إنتاج / رافعة / شاحنة / معدة ثقيلة / آلة صناعية / معدة ورشة = machinery_photo
- هوية / جواز / إقامة = identity_doc
- فاتورة / سند = invoice
- عقد / اتفاقية = contract
- تقرير فني / تقييم سابق = technical_report
- خريطة / موقع = location_map
- جدول بيانات / إكسل = spreadsheet
- ملف مضغوط = archive
- أخرى = other

قواعد حاسمة لتحديد نوع التقييم:
- إذا كانت الصور أو المستندات تخص آلات أو معدات فقط = machinery
- إذا كانت تخص عقارات فقط = real_estate
- استخدم mixed فقط عند وجود أدلة واضحة على النوعين معاً
- إذا أرسل النظام تلميح تصنيف يدوي فاحترمه ما لم يناقضه المحتوى

قواعد الأولوية:
- إذا وُجد محتوى فعلي = حلل المحتوى بعمق واستخرج كل البيانات الممكنة
- إذا أسماء ملفات فقط = استنتج من الأسماء
- أعط نسبة ثقة أعلى عند تحليل المحتوى الفعلي`;

    // Build messages with multimodal content
    const userContent: any[] = [];

    const hasContent = visionItems.length > 0 || textExtractions.length > 0;

    if (hasContent) {
      userContent.push({
        type: "text",
        text: `تم رفع ${fileNames.length} مستند. قم بتحليل محتوى المستندات التالية واستخرج جميع البيانات بدقة عالية:`,
      });

      // Add text extractions (Excel, CSV, Word, etc.)
      if (textExtractions.length > 0) {
        userContent.push({
          type: "text",
          text: `\n=== محتوى مستخرج من الملفات ===\n${textExtractions.join("\n\n")}`,
        });
      }

      // Add vision items (images, PDFs)
      for (const [index, item] of visionItems.entries()) {
        const originalIndex = fileNames.findIndex((n: string) => n === item.name);
        const manualHint = originalIndex >= 0 ? fileDescriptions?.[originalIndex] : "";

        userContent.push({
          type: "text",
          text: `\n--- ملف: ${item.name}${manualHint ? ` — تصنيف يدوي مقترح: ${manualHint}` : ""} ---`,
        });

        if (item.mimeType.startsWith("image/")) {
          userContent.push({
            type: "image_url",
            image_url: { url: `data:${item.mimeType};base64,${item.base64}` },
          });
        } else if (item.mimeType === "application/pdf") {
          // Send PDF as inline data for Gemini
          userContent.push({
            type: "image_url",
            image_url: { url: `data:application/pdf;base64,${item.base64}` },
          });
        }
      }

      // Add remaining files that weren't processed
      const processedNames = new Set([
        ...visionItems.map((v) => v.name),
        ...textExtractions.map((t) => {
          const match = t.match(/[:：]\s*(.+?)[\n$]/);
          return match?.[1] || "";
        }),
      ]);
      const remaining = fileNames.filter((n: string) => !processedNames.has(n));
      if (remaining.length > 0) {
        const remainingWithHints = remaining.map((n: string) => {
          const idx = fileNames.indexOf(n);
          const hint = idx >= 0 ? fileDescriptions?.[idx] : "";
          return hint ? `${n} — تصنيف يدوي مقترح: ${hint}` : n;
        });
        userContent.push({
          type: "text",
          text: `\nملفات إضافية (أسماء فقط):\n${remainingWithHints.map((n: string, i: number) => `${i + 1}. ${n}`).join("\n")}`,
        });
      }
    } else {
      userContent.push({
        type: "text",
        text: `الملفات المرفوعة (${fileNames.length} ملف):\n${fileNames.map((name: string, i: number) => `${i + 1}. ${name}${fileDescriptions?.[i] ? ` — ${fileDescriptions[i]}` : ""}`).join("\n")}\n\nقم بتحليل هذه الملفات واستخرج البيانات المتاحة.`,
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_valuation_data",
              description: "Extract structured valuation data from document analysis",
              parameters: {
                type: "object",
                properties: {
                  discipline: {
                    type: "string",
                    enum: ["real_estate", "machinery", "mixed"],
                  },
                  discipline_label: { type: "string" },
                  confidence: { type: "number" },
                  client: {
                    type: "object",
                    properties: {
                      clientName: { type: "string" },
                      idNumber: { type: "string" },
                      phone: { type: "string" },
                      email: { type: "string" },
                    },
                  },
                  asset: {
                    type: "object",
                    properties: {
                      description: { type: "string", description: "وصف تفصيلي مهني شامل للأصل باللغة العربية يعكس كل محتويات المستندات والصور والجداول" },
                    },
                  },
                  assetFields: {
                    type: "array",
                    description: "حقول ديناميكية مستخرجة من جميع المستندات والملفات",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        value: { type: "string" },
                        confidence: { type: "number" },
                        source: { type: "string" },
                        group: { type: "string", enum: ["property", "machinery", "financial", "legal", "general"] },
                      },
                      required: ["key", "label", "value", "confidence"],
                    },
                  },
                  suggestedPurpose: { type: "string" },
                  notes: {
                    type: "array",
                    items: { type: "string" },
                  },
                  documentCategories: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        fileName: { type: "string" },
                        category: {
                          type: "string",
                          enum: [
                            "deed", "building_permit", "floor_plan",
                            "property_photo", "machinery_photo", "identity_doc", "invoice",
                            "contract", "technical_report", "location_map",
                            "spreadsheet", "archive", "other",
                          ],
                        },
                        categoryLabel: { type: "string" },
                        relevance: { type: "string", enum: ["high", "medium", "low"] },
                        extractedInfo: { type: "string" },
                      },
                      required: ["fileName", "category", "categoryLabel", "relevance"],
                    },
                  },
                  extractedNumbers: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        value: { type: "string" },
                        source: { type: "string" },
                      },
                      required: ["label", "value", "source"],
                    },
                  },
                },
                required: ["discipline", "discipline_label", "confidence", "notes", "documentCategories", "assetFields"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_valuation_data" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "تم تجاوز الحد المسموح، يرجى المحاولة لاحقاً" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "يرجى إضافة رصيد للاستمرار" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "خطأ في التحليل الذكي" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ error: "لم يتم استخراج بيانات" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    // Post-process discipline based on document categories
    const docCategories = Array.isArray(extracted.documentCategories) ? extracted.documentCategories.map((doc: { category?: string }) => doc.category) : [];
    const hasPropertyEvidence = docCategories.some((c: string) => ["deed", "building_permit", "floor_plan", "property_photo", "location_map"].includes(c));
    const hasMachineryEvidence = docCategories.some((c: string) => ["machinery_photo"].includes(c));

    if (hasMachineryEvidence && !hasPropertyEvidence) {
      extracted.discipline = "machinery";
      extracted.discipline_label = "تقييم آلات ومعدات";
    } else if (hasMachineryEvidence && hasPropertyEvidence) {
      extracted.discipline = "mixed";
      extracted.discipline_label = "تقييم مختلط";
    }

    // Metadata
    extracted.analysisMethod = hasContent ? "content_analysis" : "filename_only";
    extracted.analyzedFilesCount = visionItems.length + textExtractions.length;
    extracted.totalFilesCount = fileNames.length;
    extracted.processedFileTypes = {
      images: visionItems.filter((v) => v.mimeType.startsWith("image/")).length,
      pdfs: visionItems.filter((v) => v.mimeType === "application/pdf").length,
      spreadsheets: textExtractions.filter((t) => t.startsWith("📊")).length,
      documents: textExtractions.filter((t) => t.startsWith("📄")).length,
      archives: textExtractions.filter((t) => t.startsWith("📦")).length,
    };

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-documents error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
