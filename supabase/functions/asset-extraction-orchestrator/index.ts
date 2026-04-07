import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function err(msg: string, status = 500) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const { action, jobId, files, userId, requestId } = await req.json();

    // ── ACTION: create ──
    // ── ACTION: create (async, fire-and-forget) ──
    if (action === "create") {
      if (!userId || !files?.length) return err("userId and files required", 400);

      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          user_id: userId,
          request_id: requestId || null,
          status: "pending",
          total_files: files.length,
          processed_files: 0,
          current_message: "تم استلام الملفات — جارٍ تجهيز المعالجة...",
          file_manifest: files.map((f: any) => ({
            name: f.name, path: f.path, size: f.size, mimeType: f.mimeType, status: "pending",
          })),
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobErr) return err(jobErr.message);

      // Insert file classifications
      const classifications = files.map((f: any) => ({
        job_id: job.id,
        file_name: f.name,
        file_path: f.path,
        file_size: f.size,
        mime_type: f.mimeType,
        processing_status: "pending",
      }));
      await supabase.from("file_classifications").insert(classifications);

      // Fire-and-forget processing
      const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/asset-extraction-orchestrator`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ action: "process", jobId: job.id }),
      }).catch(console.error);

      return ok({ jobId: job.id, status: "pending" });
    }

    // ── ACTION: create_and_process (synchronous — waits for results) ──
    if (action === "create_and_process") {
      if (!userId || !files?.length) return err("userId and files required", 400);

      const { data: job, error: jobErr } = await supabase
        .from("processing_jobs")
        .insert({
          user_id: userId,
          request_id: requestId || null,
          status: "pending",
          total_files: files.length,
          processed_files: 0,
          current_message: "تم استلام الملفات — جارٍ المعالجة المباشرة...",
          file_manifest: files.map((f: any) => ({
            name: f.name, path: f.path, size: f.size, mimeType: f.mimeType, status: "pending",
          })),
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (jobErr) return err(jobErr.message);

      const classifications = files.map((f: any) => ({
        job_id: job.id,
        file_name: f.name,
        file_path: f.path,
        file_size: f.size,
        mime_type: f.mimeType,
        processing_status: "pending",
      }));
      await supabase.from("file_classifications").insert(classifications);

      // Process synchronously by calling extract-documents directly
      const manifest = files.map((f: any) => ({
        name: f.name, path: f.path, size: f.size, mimeType: f.mimeType,
      }));

      await updateJob(supabase, job.id, {
        status: "extracting",
        current_message: `جارٍ تحليل ${manifest.length} ملف بالذكاء الاصطناعي...`,
      });

      let extractedAssets: any[] = [];
      let discipline = "real_estate";
      let extractionError: string | null = null;

      try {
        const extractUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-documents`;
        const resp = await fetch(extractUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            fileNames: manifest.map((f: any) => f.name),
            fileDescriptions: manifest.map(() => ""),
            storagePaths: manifest.map((f: any) => ({
              path: f.path, name: f.name, mimeType: f.mimeType,
            })),
          }),
        });

        if (!resp.ok) {
          extractionError = await resp.text();
          console.error("extract-documents failed:", extractionError);
        } else {
          const result = await resp.json();
          if (result.error) {
            extractionError = result.error;
          } else {
            if (result.inventory?.length) {
              extractedAssets = result.inventory;
            }
            if (result.discipline) {
              discipline = result.discipline;
            }
          }
        }
      } catch (e) {
        extractionError = e instanceof Error ? e.message : String(e);
        console.error("extract-documents exception:", e);
      }

      // Reclassify discipline based on actual extracted assets (≥70% rule)
      if (extractedAssets.length > 0) {
        const meCount = extractedAssets.filter((a: any) => a.type === "machinery_equipment").length;
        const reCount = extractedAssets.filter((a: any) => a.type === "real_estate").length;
        const total = extractedAssets.length;
        if (meCount / total >= 0.7) discipline = "machinery_equipment";
        else if (reCount / total >= 0.7) discipline = "real_estate";
        else if (meCount > 0 && reCount > 0) discipline = "mixed";
      }

      // Store extracted assets in DB
      if (extractedAssets.length > 0) {
        const assetRows = extractedAssets.map((asset: any, idx: number) => ({
          job_id: job.id,
          asset_index: idx + 1,
          name: asset.name || `أصل ${idx + 1}`,
          asset_type: asset.type || "real_estate",
          category: asset.category,
          subcategory: asset.subcategory,
          description: generateProfessionalDescription(asset),
          quantity: asset.quantity || 1,
          condition: asset.condition || "unknown",
          confidence: Math.min(100, Math.max(0, asset.confidence || 50)),
          asset_data: { fields: asset.fields || [], original_name: asset.name },
          source_files: [{ file: asset.source }],
          source_evidence: asset.source || "تحليل ذكي",
          review_status: asset.confidence >= 70 ? "approved" : "needs_review",
          missing_fields: [],
        }));
        for (let i = 0; i < assetRows.length; i += 50) {
          await supabase.from("extracted_assets").insert(assetRows.slice(i, i + 50));
        }
      }

      const finalStatus = extractionError && extractedAssets.length === 0 ? "failed" : "ready";
      await updateJob(supabase, job.id, {
        status: finalStatus,
        current_message: extractedAssets.length > 0
          ? `اكتمل التحليل — ${extractedAssets.length} أصل مستخرج`
          : extractionError
            ? `فشل التحليل: ${extractionError.substring(0, 200)}`
            : "لم يتم استخراج أصول من الملفات",
        total_assets_found: extractedAssets.length,
        discipline,
        completed_at: new Date().toISOString(),
      });

      return ok({
        jobId: job.id,
        status: finalStatus,
        assets: extractedAssets,
        totalAssets: extractedAssets.length,
        discipline,
        error: extractionError && extractedAssets.length === 0 ? extractionError.substring(0, 300) : null,
      });
    }

    // ── ACTION: process ──
    if (action === "process") {
      if (!jobId) return err("jobId required", 400);

      const { data: job } = await supabase
        .from("processing_jobs")
        .select("*")
        .eq("id", jobId)
        .single();

      if (!job) return err("Job not found", 404);
      if (job.status === "ready" || job.status === "cancelled") return ok({ status: job.status });

      const manifest = (job.file_manifest as any[]) || [];

      // ── Smart chunking: separate by file type ──
      const imageFiles: any[] = [];
      const textFiles: any[] = [];

      for (const f of manifest) {
        const mime = f.mimeType || "";
        if (mime.startsWith("image/") || mime === "application/pdf") {
          imageFiles.push(f);
        } else {
          textFiles.push(f);
        }
      }

      // Chunk sizes: smaller for images (heavy), larger for text
      const IMAGE_CHUNK = 10;
      const TEXT_CHUNK = 20;

      const chunks: { files: any[]; type: string }[] = [];
      for (let i = 0; i < imageFiles.length; i += IMAGE_CHUNK) {
        chunks.push({ files: imageFiles.slice(i, i + IMAGE_CHUNK), type: "vision" });
      }
      for (let i = 0; i < textFiles.length; i += TEXT_CHUNK) {
        chunks.push({ files: textFiles.slice(i, i + TEXT_CHUNK), type: "text" });
      }

      if (chunks.length === 0) {
        await updateJob(supabase, jobId, {
          status: "ready",
          current_message: "لا توجد ملفات قابلة للمعالجة",
          completed_at: new Date().toISOString(),
        });
        return ok({ status: "ready", totalAssets: 0 });
      }

      await updateJob(supabase, jobId, {
        status: "classifying",
        current_message: `جارٍ تصنيف ${manifest.length} ملف (${imageFiles.length} صورة/PDF، ${textFiles.length} مستند نصي)...`,
      });

      let allAssets: any[] = [];
      let allCategories: any[] = [];
      let globalDescription = "";
      let processedCount = 0;
      let failedChunks = 0;

      // Process each chunk
      for (let ci = 0; ci < chunks.length; ci++) {
        const chunk = chunks[ci];
        const chunkFiles = chunk.files;

        await updateJob(supabase, jobId, {
          status: "extracting",
          current_message: `جارٍ تحليل الدفعة ${ci + 1} من ${chunks.length} (${chunkFiles.length} ملف ${chunk.type === "vision" ? "بصري" : "نصي"})...`,
          processed_files: processedCount,
        });

        try {
          const extractUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/extract-documents`;
          const resp = await fetch(extractUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              fileNames: chunkFiles.map((f: any) => f.name),
              fileDescriptions: chunkFiles.map(() => ""),
              storagePaths: chunkFiles.map((f: any) => ({
                path: f.path, name: f.name, mimeType: f.mimeType,
              })),
            }),
          });

          if (!resp.ok) {
            const t = await resp.text();
            console.error(`Chunk ${ci} failed:`, t);
            failedChunks++;
            for (const f of chunkFiles) {
              await supabase.from("file_classifications")
                .update({ processing_status: "failed", error_message: t.substring(0, 500) })
                .eq("job_id", jobId).eq("file_name", f.name);
            }
            processedCount += chunkFiles.length;
            continue;
          }

          const result = await resp.json();
          if (result.error) {
            console.error(`Chunk ${ci} error:`, result.error);
            failedChunks++;
            processedCount += chunkFiles.length;
            continue;
          }

          // Collect inventory
          if (result.inventory?.length) {
            allAssets.push(...result.inventory.map((a: any) => ({ ...a, _chunkIndex: ci })));
          }

          // Collect document categories
          if (result.documentCategories?.length) {
            allCategories.push(...result.documentCategories);
          }

          // Merge description
          if (result.description) {
            globalDescription += (globalDescription ? "\n\n" : "") + result.description;
          }

          // Update file classifications
          for (const cat of (result.documentCategories || [])) {
            await supabase.from("file_classifications")
              .update({
                document_category: cat.category || "other",
                relevance: cat.relevance || "medium",
                extracted_info: cat.extractedInfo,
                contains_assets: true,
                processing_status: "completed",
                confidence: Math.round((result.confidence || 50) * 100) / 100,
              })
              .eq("job_id", jobId).eq("file_name", cat.fileName);
          }

          processedCount += chunkFiles.length;
        } catch (e) {
          console.error(`Chunk ${ci} exception:`, e);
          failedChunks++;
          processedCount += chunkFiles.length;
        }

        // Small delay between chunks to avoid rate limits
        if (ci < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      }

      // ── DEDUPLICATION PHASE ──
      await updateJob(supabase, jobId, {
        status: "deduplicating",
        current_message: `جارٍ كشف التكرارات في ${allAssets.length} أصل مكتشف...`,
        processed_files: manifest.length,
      });

      const { deduplicated, duplicatesFound } = deduplicateAssets(allAssets);

      // ── DETERMINE DISCIPLINE ──
      const hasRE = deduplicated.some((a: any) => a.type === "real_estate");
      const hasME = deduplicated.some((a: any) => a.type === "machinery_equipment");
      const discipline = hasRE && hasME ? "mixed" : hasME ? "machinery_equipment" : "real_estate";

      // ── STORE ASSETS ──
      await updateJob(supabase, jobId, {
        status: "merging",
        current_message: `جارٍ بناء سجل الأصول النهائي (${deduplicated.length} أصل)...`,
      });

      let lowConfidenceCount = 0;
      let missingFieldsCount = 0;

      const REQUIRED_FIELDS_RE = ["area_sqm", "classification", "deed_number"];
      const REQUIRED_FIELDS_ME = ["manufacturer", "model", "serial_number", "year_manufactured"];

      const assetRows = deduplicated.map((asset: any, idx: number) => {
        const requiredFields = asset.type === "machinery_equipment" ? REQUIRED_FIELDS_ME : REQUIRED_FIELDS_RE;
        const fieldKeys = (asset.fields || []).map((f: any) => f.key);
        const missing = requiredFields.filter(rf => !fieldKeys.includes(rf) || !(asset.fields || []).find((f: any) => f.key === rf && f.value));

        if (asset.confidence < 60) lowConfidenceCount++;
        if (missing.length > 0) missingFieldsCount++;

        return {
          job_id: jobId,
          asset_index: idx + 1,
          name: asset.name || `أصل ${idx + 1}`,
          asset_type: asset.type || "real_estate",
          category: asset.category,
          subcategory: asset.subcategory,
          description: generateProfessionalDescription(asset),
          quantity: asset.quantity || 1,
          condition: asset.condition || "unknown",
          confidence: Math.min(100, Math.max(0, asset.confidence || 50)),
          asset_data: { fields: asset.fields || [], original_name: asset.name },
          source_files: asset._sources || [{ file: asset.source }],
          source_evidence: asset.source || "تحليل ذكي",
          duplicate_group: asset._duplicateGroup || null,
          duplicate_status: asset._isDuplicate ? "potential_duplicate" : "unique",
          review_status: asset.confidence >= 70 && missing.length === 0 ? "approved" : "needs_review",
          missing_fields: missing,
        };
      });

      // Insert in batches of 50
      for (let i = 0; i < assetRows.length; i += 50) {
        const batch = assetRows.slice(i, i + 50);
        const { error: insertErr } = await supabase.from("extracted_assets").insert(batch);
        if (insertErr) console.error("Asset insert error:", insertErr);
      }

      // ── FINALIZE ──
      await updateJob(supabase, jobId, {
        status: "ready",
        current_message: `اكتمل التحليل — ${deduplicated.length} أصل جاهز للمراجعة${failedChunks > 0 ? ` (${failedChunks} دفعة فشلت)` : ""}`,
        total_assets_found: deduplicated.length,
        duplicates_found: duplicatesFound,
        low_confidence_count: lowConfidenceCount,
        missing_fields_count: missingFieldsCount,
        discipline,
        description: globalDescription,
        completed_at: new Date().toISOString(),
        ai_summary: {
          totalChunks: chunks.length,
          failedChunks,
          totalFilesProcessed: manifest.length,
          imageFiles: imageFiles.length,
          textFiles: textFiles.length,
          categoriesFound: [...new Set(allCategories.map((c: any) => c.category))],
          assetsBeforeDedup: allAssets.length,
          assetsAfterDedup: deduplicated.length,
          modelUsed: "gemini-2.5-pro",
        },
      });

      return ok({
        status: "ready",
        totalAssets: deduplicated.length,
        duplicatesFound,
        lowConfidenceCount,
        missingFieldsCount,
        discipline,
        failedChunks,
      });
    }

    // ── ACTION: status ──
    if (action === "status") {
      if (!jobId) return err("jobId required", 400);
      const { data: job } = await supabase.from("processing_jobs").select("*").eq("id", jobId).single();
      if (!job) return err("Job not found", 404);
      return ok(job);
    }

    // ── ACTION: reprocess ──
    if (action === "reprocess") {
      if (!jobId || !files?.length) return err("jobId and files required", 400);

      const { data: job } = await supabase.from("processing_jobs").select("*").eq("id", jobId).single();
      if (!job) return err("Job not found", 404);

      const existingManifest = (job.file_manifest as any[]) || [];
      const newFiles = files.filter((f: any) =>
        !existingManifest.some((ef: any) => ef.path === f.path || ef.name === f.name)
      );

      if (newFiles.length === 0) return ok({ status: "no_new_files" });

      const updatedManifest = [...existingManifest, ...newFiles.map((f: any) => ({
        name: f.name, path: f.path, size: f.size, mimeType: f.mimeType, status: "pending",
      }))];

      await supabase.from("processing_jobs").update({
        file_manifest: updatedManifest,
        total_files: updatedManifest.length,
        status: "pending",
        current_message: `تم إضافة ${newFiles.length} ملف جديد — جارٍ المعالجة...`,
      }).eq("id", jobId);

      const newClassifications = newFiles.map((f: any) => ({
        job_id: jobId, file_name: f.name, file_path: f.path,
        file_size: f.size, mime_type: f.mimeType, processing_status: "pending",
      }));
      await supabase.from("file_classifications").insert(newClassifications);

      const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/asset-extraction-orchestrator`;
      fetch(processUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({ action: "process", jobId }),
      }).catch(console.error);

      return ok({ status: "reprocessing", newFilesCount: newFiles.length });
    }

    return err("Invalid action", 400);
  } catch (e) {
    console.error("orchestrator error:", e);
    return err(e instanceof Error ? e.message : "Unknown error");
  }
});

// ── Helpers ──

async function updateJob(supabase: any, jobId: string, updates: any) {
  await supabase.from("processing_jobs").update(updates).eq("id", jobId);
}

function generateProfessionalDescription(asset: any): string {
  const parts: string[] = [];
  const fields = asset.fields || [];
  const getField = (key: string) => fields.find((f: any) => f.key === key)?.value;

  if (asset.type === "machinery_equipment") {
    const manufacturer = getField("manufacturer");
    const model = getField("model");
    const year = getField("year_manufactured");
    const serial = getField("serial_number");
    const capacity = getField("capacity");
    const status = getField("operational_status");
    const hours = getField("operating_hours");

    parts.push(asset.name || asset.category || "آلة/معدة");
    if (manufacturer) parts.push(`الشركة المصنعة: ${manufacturer}`);
    if (model) parts.push(`موديل: ${model}`);
    if (year) parts.push(`سنة الصنع: ${year}`);
    if (serial) parts.push(`رقم تسلسلي: ${serial}`);
    if (capacity) parts.push(`السعة/القدرة: ${capacity}`);
    if (hours) parts.push(`ساعات التشغيل: ${hours}`);
    if (status) parts.push(`الحالة التشغيلية: ${status}`);
  } else {
    const area = getField("area_sqm");
    const classification = getField("classification");
    const deed = getField("deed_number");
    const floors = getField("floors_count");
    const finishing = getField("finishing_level");
    const city = getField("city");
    const district = getField("district");

    parts.push(asset.name || asset.category || "عقار");
    if (classification) parts.push(`التصنيف: ${classification}`);
    if (area) parts.push(`المساحة: ${area} م²`);
    if (deed) parts.push(`رقم الصك: ${deed}`);
    if (floors) parts.push(`عدد الطوابق: ${floors}`);
    if (finishing) parts.push(`مستوى التشطيب: ${finishing}`);
    if (city) parts.push(`المدينة: ${city}`);
    if (district) parts.push(`الحي: ${district}`);
  }

  const source = asset.source || "تحليل ذكي";
  parts.push(`المصدر: ${source}`);
  return parts.join("؛ ") + ".";
}

function deduplicateAssets(assets: any[]): { deduplicated: any[]; duplicatesFound: number } {
  if (assets.length <= 1) return { deduplicated: assets, duplicatesFound: 0 };

  let duplicatesFound = 0;
  const groups: Map<string, any[]> = new Map();

  for (const asset of assets) {
    const key = generateDedupKey(asset);
    const existing = groups.get(key);
    if (existing) existing.push(asset);
    else groups.set(key, [asset]);
  }

  const deduplicated: any[] = [];
  let groupId = 0;

  for (const [_key, group] of groups) {
    if (group.length === 1) {
      deduplicated.push(group[0]);
    } else {
      groupId++;
      duplicatesFound += group.length - 1;
      deduplicated.push(mergeAssetGroup(group, `dup_group_${groupId}`));
    }
  }

  return { deduplicated, duplicatesFound };
}

function generateDedupKey(asset: any): string {
  const fields = asset.fields || [];
  const getField = (key: string) => (fields.find((f: any) => f.key === key)?.value || "").trim().toLowerCase();

  // Priority 1: Serial number
  const serial = getField("serial_number");
  if (serial && serial.length > 3) return `serial:${serial}`;

  // Priority 2: Deed number
  const deed = getField("deed_number");
  if (deed && deed.length > 3) return `deed:${deed}`;

  // Priority 3: Chassis number
  const chassis = getField("chassis_number");
  if (chassis && chassis.length > 3) return `chassis:${chassis}`;

  // Priority 4: Plate number
  const plate = getField("plate_number");
  if (plate && plate.length > 2) return `plate:${plate}`;

  // Priority 5: Manufacturer + Model + Year
  const manufacturer = getField("manufacturer");
  const model = getField("model");
  const year = getField("year_manufactured");
  if (manufacturer && model) return `mfg:${manufacturer}:${model}${year ? `:${year}` : ""}`;

  // Priority 6: Normalized name
  const name = (asset.name || "").trim().toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s]/g, "").replace(/\s+/g, " ");
  if (name.length > 5) return `name:${name.substring(0, 50)}:${asset.type}`;

  // Unique
  return `unique:${crypto.randomUUID()}`;
}

function mergeAssetGroup(group: any[], groupLabel: string): any {
  group.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const primary = { ...group[0] };

  const allFields: Map<string, any> = new Map();
  for (const asset of group) {
    for (const field of (asset.fields || [])) {
      const existing = allFields.get(field.key);
      if (!existing || (field.confidence > existing.confidence) || (!existing.value && field.value)) {
        allFields.set(field.key, { ...field });
      }
    }
  }

  primary.fields = Array.from(allFields.values());
  primary.confidence = Math.max(...group.map((a: any) => a.confidence || 50));
  primary._duplicateGroup = groupLabel;
  primary._isDuplicate = false;
  primary._sources = group.map((a: any) => ({ file: a.source, chunk: a._chunkIndex }));
  return primary;
}
