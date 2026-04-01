import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AiSuggestionBoxProps {
  context: Record<string, string | boolean | number | null>;
  sectionKey: string;
  promptHint: string;
}

export default function AiSuggestionBox({ context, sectionKey, promptHint }: AiSuggestionBoxProps) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Build a summary of non-empty fields
  const buildContextSummary = useCallback(() => {
    return Object.entries(context)
      .filter(([_, v]) => v !== null && v !== "" && v !== false)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }, [context]);

  const hasContent = Object.values(context).some(v => v !== null && v !== "" && v !== false);

  const fetchSuggestion = async () => {
    if (!hasContent) {
      toast.info("أدخل بعض البيانات أولاً للحصول على اقتراحات");
      return;
    }
    setLoading(true);
    setSuggestion(null);

    try {
      const contextSummary = buildContextSummary();
      const { data, error } = await supabase.functions.invoke("ai-inspection-suggest", {
        body: {
          section: sectionKey,
          context: contextSummary,
          hint: promptHint,
        },
      });

      if (error) throw error;
      setSuggestion(data?.suggestion || "لا توجد اقتراحات حالياً");
    } catch {
      // Fallback: generate local suggestions based on context
      const localSuggestion = generateLocalSuggestion(sectionKey, context);
      setSuggestion(localSuggestion);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("تم نسخ الاقتراح");
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="w-4 h-4" />
          <span className="text-xs font-bold">اقتراحات الذكاء الاصطناعي</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSuggestion}
          disabled={loading}
          className="h-7 text-xs gap-1"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {loading ? "جاري التحليل..." : "اقتراح"}
        </Button>
      </div>

      {suggestion && (
        <div className="bg-card rounded-md p-2.5 text-sm leading-relaxed relative group">
          <p className="text-foreground whitespace-pre-wrap">{suggestion}</p>
          <button
            onClick={handleCopy}
            className="absolute top-2 left-2 p-1 rounded bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        </div>
      )}
    </div>
  );
}

/** Fallback local suggestions when edge function is unavailable */
function generateLocalSuggestion(section: string, ctx: Record<string, any>): string {
  switch (section) {
    case "location": {
      const tips: string[] = [];
      if (!ctx.district_type) tips.push("💡 حدد نوع الحي (سكني/تجاري/مختلط) لتحسين دقة التقييم");
      if (ctx.district_level === "upscale" && ctx.nearby_highway === "yes") tips.push("⚠️ القرب من طريق رئيسي في حي راقي قد يؤثر سلباً بسبب الضوضاء");
      if (ctx.district_level === "popular" && ctx.nearby_mall === "yes") tips.push("📈 وجود مركز تجاري قريب في حي شعبي يرفع القيمة نسبياً");
      const noServices = ["nearby_mosque", "nearby_school", "nearby_hospital", "nearby_mall"].filter(k => ctx[k] === "no");
      if (noServices.length >= 3) tips.push("⚠️ نقص الخدمات القريبة (مسجد، مدرسة، مستشفى، مول) يؤثر سلباً على القيمة");
      if (ctx.surrounding_negatives && String(ctx.surrounding_negatives).length > 10 && (!ctx.surrounding_positives || String(ctx.surrounding_positives).length < 10))
        tips.push("📝 السلبيات أكثر من الإيجابيات — تأكد من ذكر أي إيجابيات موجودة للتوازن");
      if (ctx.access_ease === "poor") tips.push("🚧 صعوبة الوصول تؤثر مباشرة على القيمة السوقية — وثّق السبب بالصور");
      return tips.length > 0 ? tips.join("\n\n") : "✅ بيانات الموقع مكتملة. تأكد من توثيق المحيط بالصور.";
    }
    case "verification": {
      const match = ctx.matches_documents;
      if (match === "no") return "⚠️ تنبيه: عدم مطابقة الأصل للمستندات يستوجب:\n- توثيق الفروقات بالصور\n- ذكر طبيعة الاختلاف بدقة\n- التأكد من صحة رقم الصك/العقد\n- إبلاغ المقيّم المسؤول فوراً";
      if (ctx.asset_description && String(ctx.asset_description).length < 30) return "💡 الوصف قصير جداً. يُفضل تضمين:\n- نوع البناء ومواد الإنشاء\n- عدد الأدوار والوحدات\n- الاستخدام الحالي والسابق\n- أي مميزات أو عيوب بارزة";
      return "✅ البيانات تبدو مكتملة. تأكد من توثيق أي فروقات بين الواقع والمستندات.";
    }
    case "condition": {
      const condition = ctx.overall_condition;
      const age = ctx.asset_age ? Number(ctx.asset_age) : 0;
      const finishing = ctx.finishing_level;
      const maintenance = ctx.maintenance_rating;
      const tips: string[] = [];
      if (condition === "poor") tips.push("⚠️ الحالة السيئة تتطلب توثيق مفصل للعيوب والتشققات بالصور");
      if (age > 20) tips.push("🏗️ عمر الأصل يتجاوز 20 سنة — تحقق من الإهلاك الوظيفي والاقتصادي");
      if (finishing === "shell") tips.push("📝 أصل على العظم: وثّق نسبة الإنجاز ونوع الهيكل الإنشائي");
      if (condition === "excellent" && age > 15) tips.push("🔍 حالة ممتازة مع عمر مرتفع — تأكد من وجود تجديدات حديثة");
      if (maintenance === "needs_maintenance") tips.push("🔧 العقار يحتاج صيانة — وثّق بنود الصيانة المطلوبة بالتفصيل");
      if (maintenance === "poor") tips.push("⚠️ صيانة رديئة — يُتوقع تأثير سلبي كبير على القيمة");

      // Damage-based maintenance cost estimation
      const severityLabels: Record<string, string> = { minor: "بسيط", moderate: "متوسط", severe: "خطير" };
      const damages: string[] = [];
      const costEstimates: string[] = [];
      if (ctx.cracks_severity && ctx.cracks_severity !== "none") {
        damages.push(`تشققات (${severityLabels[ctx.cracks_severity as string] || ctx.cracks_severity})`);
        if (ctx.cracks_severity === "minor") costEstimates.push("تشققات بسيطة: 2,000 - 8,000 ر.س");
        else if (ctx.cracks_severity === "moderate") costEstimates.push("تشققات متوسطة: 10,000 - 30,000 ر.س");
        else costEstimates.push("تشققات خطيرة: 50,000 - 150,000+ ر.س (قد تحتاج ترميم هيكلي)");
      }
      if (ctx.moisture_severity && ctx.moisture_severity !== "none") {
        damages.push(`رطوبة (${severityLabels[ctx.moisture_severity as string] || ctx.moisture_severity})`);
        if (ctx.moisture_severity === "minor") costEstimates.push("رطوبة بسيطة: 3,000 - 10,000 ر.س");
        else if (ctx.moisture_severity === "moderate") costEstimates.push("رطوبة متوسطة: 15,000 - 40,000 ر.س");
        else costEstimates.push("رطوبة خطيرة: 40,000 - 100,000+ ر.س (عزل شامل)");
      }
      if (ctx.corrosion_severity && ctx.corrosion_severity !== "none") {
        damages.push(`تآكل (${severityLabels[ctx.corrosion_severity as string] || ctx.corrosion_severity})`);
        if (ctx.corrosion_severity === "minor") costEstimates.push("تآكل بسيط: 2,000 - 5,000 ر.س");
        else if (ctx.corrosion_severity === "moderate") costEstimates.push("تآكل متوسط: 10,000 - 25,000 ر.س");
        else costEstimates.push("تآكل خطير: 30,000 - 80,000+ ر.س");
      }
      if (ctx.fire_damage_severity && ctx.fire_damage_severity !== "none") {
        damages.push(`أضرار حريق (${severityLabels[ctx.fire_damage_severity as string] || ctx.fire_damage_severity})`);
        if (ctx.fire_damage_severity === "minor") costEstimates.push("أضرار حريق بسيطة: 5,000 - 20,000 ر.س");
        else if (ctx.fire_damage_severity === "moderate") costEstimates.push("أضرار حريق متوسطة: 30,000 - 80,000 ر.س");
        else costEstimates.push("أضرار حريق خطيرة: 100,000 - 500,000+ ر.س (إعادة بناء جزئية)");
      }
      if (ctx.structural_damage_severity && ctx.structural_damage_severity !== "none") {
        damages.push(`أضرار هيكلية (${severityLabels[ctx.structural_damage_severity as string] || ctx.structural_damage_severity})`);
        if (ctx.structural_damage_severity === "minor") costEstimates.push("أضرار هيكلية بسيطة: 10,000 - 30,000 ر.س");
        else if (ctx.structural_damage_severity === "moderate") costEstimates.push("أضرار هيكلية متوسطة: 50,000 - 150,000 ر.س");
        else costEstimates.push("أضرار هيكلية خطيرة: 200,000+ ر.س (قد يستوجب هدم وإعادة بناء)");
      }

      if (damages.length > 0) {
        tips.push(`🔍 الأضرار المكتشفة: ${damages.join("، ")}`);
        tips.push("💰 تقدير تكلفة الصيانة التقريبية:\n" + costEstimates.map(c => `  • ${c}`).join("\n"));
        if (damages.length >= 3) tips.push("⚠️ تعدد الأضرار يشير لإهمال عام — يُنصح بتقرير فني متخصص");
      }

      return tips.length > 0 ? tips.join("\n\n") : "💡 وثّق حالة التشطيبات الداخلية والخارجية بالتفصيل، خاصة أي عيوب ظاهرة.";
    }
    case "dimensions": {
      const land = ctx.land_area ? Number(ctx.land_area) : 0;
      const building = ctx.building_area ? Number(ctx.building_area) : 0;
      const tips: string[] = [];
      if (land > 0 && building > 0 && building > land * 3) tips.push("⚠️ نسبة المساحة المبنية للأرض مرتفعة جداً — تحقق من القياسات");
      if (land > 0 && building > 0) {
        const ratio = ((building / land) * 100).toFixed(0);
        tips.push(`📊 نسبة البناء: ${ratio}% من مساحة الأرض`);
      }
      if (land === 0 && building === 0) tips.push("💡 أدخل المساحات للحصول على تحليل تلقائي");
      return tips.length > 0 ? tips.join("\n\n") : "✅ المساحات مسجلة. تأكد من مطابقتها للمخطط المعتمد.";
    }
    case "value_factors": {
      const tips: string[] = [];
      const impactLabels: Record<string, string> = { weak: "ضعيف", medium: "متوسط", strong: "قوي" };
      const posLabels: Record<string, string> = { view: "إطلالة مميزة", prime_location: "موقع مميز", luxury_finish: "تشطيب راقي", modern: "حديث البناء" };
      const negLabels: Record<string, string> = { noise: "قرب ضوضاء", legal_issues: "إشكاليات قانونية", harmful_neighbor: "مجاور ضار" };
      const impactPct: Record<string, Record<string, string>> = {
        view: { weak: "+1-3%", medium: "+3-7%", strong: "+7-15%" },
        prime_location: { weak: "+2-5%", medium: "+5-12%", strong: "+12-25%" },
        luxury_finish: { weak: "+2-4%", medium: "+4-10%", strong: "+10-20%" },
        modern: { weak: "+1-3%", medium: "+3-8%", strong: "+8-15%" },
        noise: { weak: "-1-3%", medium: "-3-8%", strong: "-8-15%" },
        legal_issues: { weak: "-2-5%", medium: "-5-15%", strong: "-15-30%" },
        harmful_neighbor: { weak: "-1-4%", medium: "-4-10%", strong: "-10-20%" },
      };

      // Parse positive factors
      const posStr = ctx.positive_factors ? String(ctx.positive_factors) : "";
      const posEntries = posStr.split(",").map(s => s.trim()).filter(Boolean).map(s => { const [k, v] = s.split(":"); return [k, v] as [string, string]; });
      if (posEntries.length > 0) {
        tips.push("📈 **تأثير العوامل الإيجابية المقدّر:**");
        posEntries.forEach(([k, v]) => {
          const name = posLabels[k] || k;
          const impact = impactLabels[v] || v;
          const pct = impactPct[k]?.[v] || "+?%";
          tips.push(`  ✅ ${name} (${impact}): تأثير تقديري ${pct} على القيمة`);
        });
      }

      // Parse negative factors
      const negStr = ctx.negative_factors ? String(ctx.negative_factors) : "";
      const negEntries = negStr.split(",").map(s => s.trim()).filter(Boolean).map(s => { const [k, v] = s.split(":"); return [k, v] as [string, string]; });
      if (negEntries.length > 0) {
        tips.push("📉 **تأثير العوامل السلبية المقدّر:**");
        negEntries.forEach(([k, v]) => {
          const name = negLabels[k] || k;
          const impact = impactLabels[v] || v;
          const pct = impactPct[k]?.[v] || "-?%";
          tips.push(`  ⚠️ ${name} (${impact}): تأثير تقديري ${pct} على القيمة`);
        });
      }

      if (posEntries.length > 0 || negEntries.length > 0) {
        // Net summary
        const posCount = posEntries.filter(([_, v]) => v === "strong").length;
        const negCount = negEntries.filter(([_, v]) => v === "strong").length;
        if (posCount > negCount) tips.push("\n🟢 **الصافي:** العوامل الإيجابية القوية تفوق السلبية — متوقع تأثير إيجابي صافي على القيمة");
        else if (negCount > posCount) tips.push("\n🔴 **الصافي:** العوامل السلبية القوية تفوق الإيجابية — متوقع تأثير سلبي صافي على القيمة");
        else tips.push("\n🟡 **الصافي:** العوامل متوازنة تقريباً — التأثير الصافي محدود");
      }

      if (ctx.positive_factors_other) tips.push(`📝 عوامل إيجابية إضافية: ${ctx.positive_factors_other}`);
      if (ctx.negative_factors_other) tips.push(`📝 عوامل سلبية إضافية: ${ctx.negative_factors_other}`);

      if (tips.length === 0) {
        tips.push("💡 حدد العوامل الإيجابية والسلبية مع درجة تأثير كل عامل للحصول على تحليل مفصل");
      }
      return tips.join("\n");
    }
    case "exterior": {
      const tips: string[] = [];
      if (!ctx.facade_material) tips.push("💡 حدد مادة الواجهة الخارجية للحصول على تقييم دقيق");
      if (ctx.facade_condition === "poor") tips.push("⚠️ حالة الواجهة السيئة تؤثر مباشرة على القيمة — وثّق التشققات والتلف بالصور");
      if (ctx.roof_condition === "poor") tips.push("⚠️ حالة السقف السيئة قد تشير لمشاكل تسرب — تحقق من وجود رطوبة");
      if (ctx.fence_type === "none") tips.push("📝 عدم وجود سور يؤثر على الخصوصية والأمان — وثّق ذلك");
      if (ctx.parking === "none") tips.push("🚗 عدم وجود مواقف قد يؤثر سلباً على القيمة خاصة في الأحياء المزدحمة");
      if (ctx.facade_condition === "excellent" && ctx.roof_condition === "excellent") tips.push("✅ الحالة الخارجية ممتازة — تأكد من تطابقها مع الحالة الداخلية");
      return tips.length > 0 ? tips.join("\n\n") : "💡 وثّق جميع عناصر المبنى الخارجية بالصور مع ملاحظة أي عيوب ظاهرة.";
    }
    case "interior": {
      const tips: string[] = [];
      if (!ctx.floors_type) tips.push("💡 حدد نوع الأرضيات للحصول على تقييم دقيق للتشطيبات");
      if (ctx.floors_condition === "poor") tips.push("⚠️ حالة الأرضيات الرديئة تستوجب تقدير تكلفة الاستبدال");
      if (ctx.walls_condition === "poor") tips.push("⚠️ تحقق من أسباب تدهور الجدران (رطوبة، تسربات، إهمال)");
      if (ctx.electrical === "poor") tips.push("🔌 حالة الكهرباء الرديئة تمثل خطراً — وثّق المشاكل بالتفصيل");
      if (ctx.plumbing === "poor") tips.push("🚰 مشاكل السباكة قد تسبب أضراراً هيكلية — تحقق من تسربات المياه");
      if (ctx.ac_type === "none") tips.push("❄️ عدم وجود تكييف يؤثر على القيمة خاصة في المناطق الحارة");
      if (ctx.bathrooms_condition === "poor") tips.push("🚿 حالة دورات المياه الرديئة تحتاج توثيق التلف والتسربات");
      const poorCount = ["floors_condition", "walls_condition", "ceilings_condition", "kitchen_condition", "bathrooms_condition"].filter(k => ctx[k] === "poor").length;
      if (poorCount >= 3) tips.push("⚠️ معظم التشطيبات الداخلية بحالة رديئة — يُنصح بتقدير تكلفة تجديد شاملة");
      if (poorCount === 0 && ctx.floors_type) tips.push("✅ التشطيبات الداخلية بحالة جيدة عموماً");
      return tips.length > 0 ? tips.join("\n\n") : "💡 وثّق حالة جميع عناصر الداخل بالصور مع التركيز على العيوب.";
    }
    case "utilities": {
      const tips: string[] = [];
      if (ctx.electricity_status === "unavailable") tips.push("⚠️ الكهرباء غير متوفرة — يؤثر سلباً على القيمة بشكل كبير");
      if (ctx.electricity_status === "temporary") tips.push("⚡ كهرباء مؤقتة — وثّق مصدر التغذية المؤقت");
      if (ctx.electricity_condition === "poor") tips.push("🔌 حالة الكهرباء رديئة — تحقق من سلامة التوصيلات");
      if (ctx.water_source === "unavailable") tips.push("⚠️ المياه غير متوفرة — عامل سلبي مؤثر على القيمة");
      if (ctx.water_source === "well") tips.push("💧 مصدر المياه بئر — تحقق من جودة المياه والتصريح");
      if (ctx.water_condition === "poor") tips.push("💧 حالة المياه رديئة — وثّق المشاكل");
      if (ctx.sewage_type === "unavailable") tips.push("⚠️ الصرف الصحي غير متوفر — يؤثر على القيمة");
      if (ctx.sewage_type === "septic") tips.push("🔧 صرف بخزان امتصاص — تحقق من حالته وسعته");
      if (ctx.sewage_condition === "poor") tips.push("🔧 حالة الصرف رديئة — وثّق المشاكل");
      if (!ctx.roads_paved) tips.push("🛣️ طرق غير معبدة — يؤثر على سهولة الوصول والقيمة");
      if (tips.length === 0 && ctx.electricity_status) tips.push("✅ الخدمات الأساسية متوفرة بشكل جيد");
      if (ctx.checklist_total > 0) {
        const pct = Math.round((ctx.checklist_done / ctx.checklist_total) * 100);
        if (pct < 50) tips.push(`📋 اكتمال قائمة الفحص ${pct}% فقط — أكمل الفحص التفصيلي`);
        else if (pct < 100) tips.push(`📋 اكتمال قائمة الفحص ${pct}% — أكمل العناصر المتبقية`);
        else tips.push("📋 قائمة الفحص مكتملة 100%");
      }
      return tips.join("\n\n");
    }
    case "risks": {
      if (ctx.has_risks === "yes" && (!ctx.risk_details || String(ctx.risk_details).length < 20))
        return "⚠️ وجود مخاطر يتطلب توثيقاً مفصلاً:\n- نوع الخطر (إنشائي، بيئي، نظامي)\n- مستوى الخطورة\n- التأثير المتوقع على القيمة\n- صور داعمة إن أمكن";
      if (ctx.has_risks === "no") return "✅ لا توجد مخاطر مسجلة. تأكد من فحص:\n- السلامة الإنشائية\n- المخاطر البيئية\n- المخالفات النظامية\n- حقوق الغير أو الرهون";
      return "💡 راجع جميع جوانب المخاطر المحتملة قبل الإجابة.";
    }
    default:
      return "💡 أدخل البيانات المطلوبة وسيقوم الذكاء الاصطناعي بتحليلها وتقديم ملاحظات.";
  }
}
