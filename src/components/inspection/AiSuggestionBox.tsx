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
      const tips: string[] = [];
      if (condition === "poor") tips.push("⚠️ الحالة السيئة تتطلب توثيق مفصل للعيوب والتشققات بالصور");
      if (age > 20) tips.push("🏗️ عمر الأصل يتجاوز 20 سنة — تحقق من الإهلاك الوظيفي والاقتصادي");
      if (finishing === "shell") tips.push("📝 أصل على العظم: وثّق نسبة الإنجاز ونوع الهيكل الإنشائي");
      if (condition === "excellent" && age > 15) tips.push("🔍 حالة ممتازة مع عمر مرتفع — تأكد من وجود تجديدات حديثة");
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
      if (!ctx.positive_factors) tips.push("💡 أضف الإيجابيات: قرب من مدارس/مساجد/مراكز تجارية، عرض الشارع، واجهة تجارية");
      if (!ctx.negative_factors) tips.push("💡 أضف السلبيات إن وُجدت: ضوضاء، ازدحام، محطات كهرباء مجاورة");
      if (ctx.positive_factors && ctx.negative_factors) tips.push("✅ تم تسجيل العوامل. تأكد من ذكر تأثيرها المتوقع على القيمة.");
      return tips.length > 0 ? tips.join("\n\n") : "💡 وثّق العوامل المؤثرة على القيمة بدقة مع ذكر مدى تأثير كل عامل.";
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
